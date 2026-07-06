use axum::Json;
use axum::extract::{Path, State};
use axum::http::StatusCode;
use uuid::Uuid;
use validator::Validate;

use crate::AppState;
use crate::models::{CreateWebhook, Webhook};

pub async fn list_webhooks(
    State(state): State<AppState>,
) -> Result<Json<Vec<Webhook>>, StatusCode> {
    let webhooks = sqlx::query_as::<_, Webhook>(
        "SELECT id, url, event as \"event: WebhookEvent\", secret, active, created_at, updated_at FROM webhooks ORDER BY created_at DESC",
    )
    .fetch_all(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(webhooks))
}

pub async fn create_webhook(
    State(state): State<AppState>,
    Json(input): Json<CreateWebhook>,
) -> Result<(StatusCode, Json<Webhook>), StatusCode> {
    input
        .validate()
        .map_err(|_| StatusCode::UNPROCESSABLE_ENTITY)?;

    let webhook = sqlx::query_as::<_, Webhook>(
        r#"
        INSERT INTO webhooks (url, event, secret)
        VALUES ($1, $2, $3)
        RETURNING id, url, event as "event: WebhookEvent", secret, active, created_at, updated_at
        "#,
    )
    .bind(&input.url)
    .bind(input.event)
    .bind(&input.secret)
    .fetch_one(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok((StatusCode::CREATED, Json(webhook)))
}

pub async fn delete_webhook(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    let result = sqlx::query("DELETE FROM webhooks WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    Ok(StatusCode::NO_CONTENT)
}
