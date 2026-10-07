use sqlx::postgres::{PgConnectOptions, PgPool, PgPoolOptions};
use std::str::FromStr;
use tracing::{info, warn};

pub async fn create_pool(database_url: &str) -> PgPool {
    info!("Connecting to database...");

    // Parse URL into connect options so we can set statement_timeout
    // (bounds any runaway query) without changing the URL itself.
    let connect_opts = PgConnectOptions::from_str(database_url)
        .unwrap_or_else(|e| panic!("Invalid DATABASE_URL: {e}"));
    let connect_opts = connect_opts.options([("statement_timeout", "30s")]);

    let mut attempts = 0;
    loop {
        attempts += 1;
        match PgPoolOptions::new()
            .max_connections(10)
            .min_connections(2)
            .acquire_timeout(std::time::Duration::from_secs(5))
            .idle_timeout(std::time::Duration::from_secs(600))
            .max_lifetime(std::time::Duration::from_secs(1800))
            .connect_with(connect_opts.clone())
            .await
        {
            Ok(pool) => return pool,
            Err(e) => {
                // Clear message + retry log instead of bare `.expect()`.
                // Fail after 5 attempts so misconfig surfaces fast in prod.
                warn!("Failed to create database pool (attempt {attempts}/5): {e}");
                if attempts >= 5 {
                    panic!(
                        "Failed to create database pool after {attempts} attempts: {e}. Check DATABASE_URL and that Postgres is reachable."
                    );
                }
                tokio::time::sleep(std::time::Duration::from_secs(2)).await;
            }
        }
    }
}
