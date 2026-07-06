use axum::Json;
use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use uuid::Uuid;

use crate::AppState;
use crate::middleware::auth::UserPermissions;
use crate::models::{AuditFilter, AuditLog};

pub async fn insert_audit_log(
    state: &AppState,
    user_id: Option<Uuid>,
    action: &str,
    entity_type: &str,
    entity_id: Uuid,
    old_values: Option<serde_json::Value>,
    new_values: Option<serde_json::Value>,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_values, new_values)
        VALUES ($1, $2, $3, $4, $5, $6)
        "#,
    )
    .bind(user_id)
    .bind(action)
    .bind(entity_type)
    .bind(entity_id)
    .bind(old_values)
    .bind(new_values)
    .execute(&state.db)
    .await?;
    Ok(())
}

pub async fn list_audit_logs(
    State(state): State<AppState>,
    Query(params): Query<AuditFilter>,
    perms: UserPermissions,
) -> Result<Json<Vec<AuditLog>>, StatusCode> {
    perms
        .require("audit.view")
        .map_err(|_| StatusCode::FORBIDDEN)?;
    let per_page = params.pagination.per_page();
    let offset = params.pagination.offset();

    let logs = sqlx::query_as::<_, AuditLog>(
        "SELECT id, user_id, action, entity_type, entity_id, old_values, new_values, ip_address::text, created_at FROM audit_log
         WHERE ($1::text IS NULL OR entity_type = $1)
           AND ($2::uuid IS NULL OR entity_id = $2)
           AND ($3::uuid IS NULL OR user_id = $3)
         ORDER BY created_at DESC LIMIT $4 OFFSET $5"
    )
    .bind(&params.entity_type)
    .bind(params.entity_id)
    .bind(params.user_id)
    .bind(per_page)
    .bind(offset)
    .fetch_all(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(logs))
}

pub async fn get_entity_history(
    State(state): State<AppState>,
    Path((entity_type, entity_id)): Path<(String, Uuid)>,
    perms: UserPermissions,
) -> Result<Json<Vec<AuditLog>>, StatusCode> {
    perms
        .require("audit.view")
        .map_err(|_| StatusCode::FORBIDDEN)?;
    let logs = sqlx::query_as::<_, AuditLog>(
        "SELECT id, user_id, action, entity_type, entity_id, old_values, new_values, ip_address::text, created_at FROM audit_log WHERE entity_type = $1 AND entity_id = $2 ORDER BY created_at DESC"
    )
    .bind(&entity_type)
    .bind(entity_id)
    .fetch_all(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(logs))
}
