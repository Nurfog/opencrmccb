use axum::Json;
use axum::extract::{Path, State};
use axum::http::StatusCode;
use uuid::Uuid;
use validator::Validate;

use crate::AppState;
use crate::error::AppError;
use crate::middleware::auth::UserPermissions;
use crate::models::{CreateWebhook, UpdateWebhook, Webhook, WebhookDelivery};

pub async fn list_webhooks(
    State(state): State<AppState>,
    perms: UserPermissions,
) -> Result<Json<Vec<Webhook>>, AppError> {
    perms
        .require("webhooks.view")
        .map_err(|_| AppError::Forbidden)?;
    let webhooks = sqlx::query_as::<_, Webhook>(
        "SELECT id, url, event, secret, active, created_at, updated_at FROM webhooks ORDER BY created_at DESC",
    )
    .fetch_all(&state.db)
    .await?;

    Ok(Json(webhooks))
}

pub async fn create_webhook(
    State(state): State<AppState>,
    perms: UserPermissions,
    Json(input): Json<CreateWebhook>,
) -> Result<(StatusCode, Json<Webhook>), AppError> {
    perms
        .require("webhooks.manage")
        .map_err(|_| AppError::Forbidden)?;
    input
        .validate()
        .map_err(|_| AppError::Validation("Invalid webhook data".into()))?;
    // Fail fast at creation: the dispatcher (webhook_worker) would refuse
    // non-public URLs anyway (SSRF guard). Rejecting here avoids storing
    // webhooks that can never fire (e.g. metadata IPs, loopback, RFC1918).
    if !crate::services::webhook_worker::is_webhook_url_allowed(&input.url) {
        return Err(AppError::Validation(
            "Webhook URL must be a public http(s) URL".into(),
        ));
    }

    let webhook = sqlx::query_as::<_, Webhook>(
        r#"
        INSERT INTO webhooks (url, event, secret)
        VALUES ($1, $2, $3)
        RETURNING id, url, event, secret, active, created_at, updated_at
        "#,
    )
    .bind(&input.url)
    .bind(input.event)
    .bind(&input.secret)
    .fetch_one(&state.db)
    .await?;

    Ok((StatusCode::CREATED, Json(webhook)))
}

pub async fn update_webhook(
    State(state): State<AppState>,
    perms: UserPermissions,
    Path(id): Path<Uuid>,
    Json(input): Json<UpdateWebhook>,
) -> Result<Json<Webhook>, AppError> {
    perms
        .require("webhooks.manage")
        .map_err(|_| AppError::Forbidden)?;
    input
        .validate()
        .map_err(|_| AppError::Validation("Invalid webhook data".into()))?;
    // Same SSRF guard as creation, but only when the URL actually changes:
    // legacy rows with non-public URLs can still be edited (e.g. rotating
    // the secret) without being locked out.
    if let Some(url) = input.url.as_deref()
        && !crate::services::webhook_worker::is_webhook_url_allowed(url)
    {
        return Err(AppError::Validation(
            "Webhook URL must be a public http(s) URL".into(),
        ));
    }

    // Check webhook exists
    let existing = sqlx::query_as::<_, Webhook>(
        "SELECT id, url, event, secret, active, created_at, updated_at FROM webhooks WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?;

    let existing = existing.ok_or(AppError::NotFound)?;

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
        RETURNING id, url, event, secret, active, created_at, updated_at
        "#,
    )
    .bind(new_url)
    .bind(new_active)
    .bind(&new_secret)
    .bind(id)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(webhook))
}

pub async fn list_deliveries(
    State(state): State<AppState>,
    perms: UserPermissions,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<WebhookDelivery>>, AppError> {
    perms
        .require("webhooks.view")
        .map_err(|_| AppError::Forbidden)?;
    // Verify webhook exists (`SELECT 1` yields INT4, hence i32).
    let exists = sqlx::query_scalar::<_, i32>("SELECT 1 FROM webhooks WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await?;

    if exists.is_none() {
        return Err(AppError::NotFound);
    }

    let deliveries = sqlx::query_as::<_, WebhookDelivery>(
        r#"
        SELECT id, webhook_id, event_type, payload, status,
               attempts, next_attempt_at, response_status, response_body, created_at, updated_at
        FROM webhook_deliveries
        WHERE webhook_id = $1
        ORDER BY created_at DESC
        LIMIT 100
        "#,
    )
    .bind(id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(deliveries))
}

pub async fn delete_webhook(
    State(state): State<AppState>,
    perms: UserPermissions,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    perms
        .require("webhooks.manage")
        .map_err(|_| AppError::Forbidden)?;
    let result = sqlx::query("DELETE FROM webhooks WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(StatusCode::NO_CONTENT)
}
