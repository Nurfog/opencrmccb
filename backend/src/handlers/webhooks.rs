use axum::Json;
use axum::extract::{Path, State};
use axum::http::StatusCode;
use uuid::Uuid;
use validator::Validate;

use crate::AppState;
use crate::models::{CreateWebhook, UpdateWebhook, Webhook, WebhookDelivery};

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

pub async fn update_webhook(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(input): Json<UpdateWebhook>,
) -> Result<Json<Webhook>, StatusCode> {
    input
        .validate()
        .map_err(|_| StatusCode::UNPROCESSABLE_ENTITY)?;

    // Check webhook exists
    let existing = sqlx::query_as::<_, Webhook>(
        "SELECT id, url, event as \"event: WebhookEvent\", secret, active, created_at, updated_at FROM webhooks WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let existing = existing.ok_or(StatusCode::NOT_FOUND)?;

    let new_url = input.url.as_deref().unwrap_or(&existing.url);
    let new_active = input.active.unwrap_or(existing.active);
    let new_secret = if input.secret.is_some() {
        input.secret.clone()
    } else {
        existing.secret.clone()
    };

    let webhook = sqlx::query_as::<_, Webhook>(
        r#"
        UPDATE webhooks SET url = $1, active = $2, secret = $3, updated_at = NOW()
        WHERE id = $4
        RETURNING id, url, event as "event: WebhookEvent", secret, active, created_at, updated_at
        "#,
    )
    .bind(new_url)
    .bind(new_active)
    .bind(&new_secret)
    .bind(id)
    .fetch_one(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(webhook))
}

pub async fn list_deliveries(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<WebhookDelivery>>, StatusCode> {
    // Verify webhook exists
    let exists = sqlx::query_scalar::<_, i64>("SELECT 1 FROM webhooks WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if exists.is_none() {
        return Err(StatusCode::NOT_FOUND);
    }

    let deliveries = sqlx::query_as::<_, WebhookDelivery>(
        r#"
        SELECT id, webhook_id, event_type, payload, status as "status: WebhookStatus",
               attempts, next_attempt_at, response_status, response_body, created_at, updated_at
        FROM webhook_deliveries
        WHERE webhook_id = $1
        ORDER BY created_at DESC
        LIMIT 100
        "#,
    )
    .bind(id)
    .fetch_all(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(deliveries))
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
