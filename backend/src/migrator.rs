//! Idempotent database migration runner.
//!
//! Applies `*.sql` files from the migrations directory in lexicographic order
//! and records each applied file in `schema_migrations`, so reboots and
//! re-runs are no-ops.
//!
//! This exists because the `database` image only copies migrations into
//! `docker-entrypoint-initdb.d`, which runs solely on first init: any
//! pre-existing `pgdata` volume would never receive new migrations.
//! Every migration file must be re-runnable (guarded with `IF NOT EXISTS` /
//! `DO $$` blocks) so adoption on an existing database converges instead of
//! failing halfway.

use std::collections::HashSet;

/// Find the migrations directory: explicit `MIGRATIONS_DIR` env, otherwise the
/// first candidate that exists (Compose mount, repo-root, or backend-relative).
pub fn migration_dir() -> String {
    if let Ok(dir) = std::env::var("MIGRATIONS_DIR")
        && !dir.is_empty()
    {
        return dir;
    }
    for candidate in [
        "./migrations",
        "database/migrations",
        "../database/migrations",
    ] {
        if std::path::Path::new(candidate).is_dir() {
            return candidate.to_string();
        }
    }
    "./migrations".to_string()
}

pub fn run_migrations_enabled() -> bool {
    std::env::var("RUN_MIGRATIONS")
        .map(|v| v != "0" && !v.eq_ignore_ascii_case("false"))
        .unwrap_or(true)
}

/// Apply all pending `*.sql` files from `dir`. Returns the number applied.
/// Safe under concurrent boots via a session-level advisory lock.
pub async fn run_pending_migrations(pool: &sqlx::PgPool, dir: &str) -> Result<usize, String> {
    let mut conn = pool.acquire().await.map_err(|e| e.to_string())?;

    sqlx::query("SELECT pg_advisory_lock(hashtext('crm_schema_migrations'))")
        .execute(&mut *conn)
        .await
        .map_err(|e| e.to_string())?;

    let result = run_inner(&mut conn, dir).await;

    let _ = sqlx::query("SELECT pg_advisory_unlock(hashtext('crm_schema_migrations'))")
        .execute(&mut *conn)
        .await;

    result
}

async fn run_inner(conn: &mut sqlx::PgConnection, dir: &str) -> Result<usize, String> {
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            version TEXT PRIMARY KEY,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )",
    )
    .execute(&mut *conn)
    .await
    .map_err(|e| format!("creating schema_migrations: {e}"))?;

    let applied_rows: Vec<String> = sqlx::query_scalar("SELECT version FROM schema_migrations")
        .fetch_all(&mut *conn)
        .await
        .map_err(|e| format!("reading schema_migrations: {e}"))?;
    let applied: HashSet<String> = applied_rows.into_iter().collect();

    let mut files: Vec<String> = std::fs::read_dir(dir)
        .map_err(|e| format!("reading migrations dir '{dir}': {e}"))?
        .filter_map(|e| e.ok())
        .map(|e| e.file_name().to_string_lossy().into_owned())
        .filter(|n| n.ends_with(".sql"))
        .collect();
    files.sort();

    let mut count = 0;
    for file in files {
        if applied.contains(&file) {
            continue;
        }
        let path = format!("{dir}/{file}");
        let sql = std::fs::read_to_string(&path).map_err(|e| format!("reading {file}: {e}"))?;
        if sql.trim().is_empty() {
            continue;
        }

        // One explicit transaction per file: with the simple protocol,
        // `BEGIN; <file>; COMMIT;` is atomic (no migration uses
        // non-transactional statements like CONCURRENTLY/VACUUM).
        let wrapped = format!("BEGIN; {sql} COMMIT;");
        if let Err(e) = sqlx::raw_sql(&wrapped).execute(&mut *conn).await {
            let _ = sqlx::raw_sql("ROLLBACK;").execute(&mut *conn).await;
            return Err(format!("applying {file}: {e}"));
        }
        sqlx::query("INSERT INTO schema_migrations (version) VALUES ($1)")
            .bind(&file)
            .execute(&mut *conn)
            .await
            .map_err(|e| format!("recording {file}: {e}"))?;
        tracing::info!("Applied migration {file}");
        count += 1;
    }
    Ok(count)
}
