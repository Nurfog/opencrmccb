use axum::Json;
use axum::extract::{Path, State};
use axum::http::StatusCode;
use uuid::Uuid;

use crate::AppState;
use crate::middleware::auth::UserPermissions;
use crate::models::Notification;

pub async fn list_notifications(
    State(state): State<AppState>,
    claims: axum::extract::Extension<crate::middleware::auth::Claims>,
) -> Result<Json<Vec<Notification>>, StatusCode> {
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;

    let notifications = sqlx::query_as::<_, Notification>(
        "SELECT id, user_id, title, message, entity_type, entity_id, read, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50"
    )
    .bind(user_id)
    .fetch_all(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(notifications))
}

pub async fn get_unread_count(
    State(state): State<AppState>,
    claims: axum::extract::Extension<crate::middleware::auth::Claims>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;

    let count: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND read = FALSE")
            .bind(user_id)
            .fetch_one(&state.db)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(serde_json::json!({ "count": count.0 })))
}

pub async fn mark_as_read(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    claims: axum::extract::Extension<crate::middleware::auth::Claims>,
) -> Result<StatusCode, StatusCode> {
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;

    let result = sqlx::query("UPDATE notifications SET read = TRUE WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(user_id)
        .execute(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    Ok(StatusCode::OK)
}

pub async fn mark_all_as_read(
    State(state): State<AppState>,
    claims: axum::extract::Extension<crate::middleware::auth::Claims>,
) -> Result<StatusCode, StatusCode> {
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;

    sqlx::query("UPDATE notifications SET read = TRUE WHERE user_id = $1 AND read = FALSE")
        .bind(user_id)
        .execute(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(StatusCode::OK)
}

pub async fn delete_notification(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    claims: axum::extract::Extension<crate::middleware::auth::Claims>,
) -> Result<StatusCode, StatusCode> {
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;

    let result = sqlx::query("DELETE FROM notifications WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(user_id)
        .execute(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    Ok(StatusCode::NO_CONTENT)
}

pub async fn send_test_email(
    State(state): State<AppState>,
    _claims: axum::extract::Extension<crate::middleware::auth::Claims>,
    perms: UserPermissions,
    Json(payload): Json<serde_json::Value>,
) -> Result<StatusCode, StatusCode> {
    perms
        .require("notifications.manage")
        .map_err(|_| StatusCode::FORBIDDEN)?;

    let to = payload["to"].as_str().ok_or(StatusCode::BAD_REQUEST)?;
    let subject = payload["subject"].as_str().unwrap_or("Test Email");
    let body = payload["body"].as_str().unwrap_or("This is a test email.");

    crate::services::email::send_email(
        &state.smtp.host,
        state.smtp.port,
        &state.smtp.user,
        &state.smtp.password,
        &state.smtp.from,
        to,
        subject,
        body,
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(StatusCode::OK)
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct NotificationPreferences {
    pub user_id: Uuid,
    pub email_enabled: bool,
    pub push_enabled: bool,
    pub weekly_digest: bool,
    pub marketing_emails: bool,
}

pub async fn get_notification_preferences(
    State(state): State<AppState>,
    claims: axum::extract::Extension<crate::middleware::auth::Claims>,
) -> Result<Json<NotificationPreferences>, StatusCode> {
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;

    let prefs = sqlx::query_as::<_, (bool, bool, bool, bool)>(
        "SELECT email_enabled, push_enabled, weekly_digest, marketing_emails \
         FROM notification_preferences WHERE user_id = $1",
    )
    .bind(user_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .unwrap_or((true, true, false, false));

    Ok(Json(NotificationPreferences {
        user_id,
        email_enabled: prefs.0,
        push_enabled: prefs.1,
        weekly_digest: prefs.2,
        marketing_emails: prefs.3,
    }))
}

#[derive(serde::Deserialize)]
pub struct UpdateNotificationPreferencesInput {
    pub email_enabled: Option<bool>,
    pub push_enabled: Option<bool>,
    pub weekly_digest: Option<bool>,
    pub marketing_emails: Option<bool>,
}

pub async fn update_notification_preferences(
    State(state): State<AppState>,
    claims: axum::extract::Extension<crate::middleware::auth::Claims>,
    Json(input): Json<UpdateNotificationPreferencesInput>,
) -> Result<StatusCode, StatusCode> {
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;

    // Get current values or defaults
    let current = sqlx::query_as::<_, (bool, bool, bool, bool)>(
        "SELECT email_enabled, push_enabled, weekly_digest, marketing_emails \
         FROM notification_preferences WHERE user_id = $1",
    )
    .bind(user_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .unwrap_or((true, true, false, false));

    sqlx::query(
        "INSERT INTO notification_preferences (user_id, email_enabled, push_enabled, weekly_digest, marketing_emails) \
         VALUES ($1, $2, $3, $4, $5) \
         ON CONFLICT (user_id) DO UPDATE SET \
            email_enabled = EXCLUDED.email_enabled, \
            push_enabled = EXCLUDED.push_enabled, \
            weekly_digest = EXCLUDED.weekly_digest, \
            marketing_emails = EXCLUDED.marketing_emails, \
            updated_at = NOW()"
    )
    .bind(user_id)
    .bind(input.email_enabled.unwrap_or(current.0))
    .bind(input.push_enabled.unwrap_or(current.1))
    .bind(input.weekly_digest.unwrap_or(current.2))
    .bind(input.marketing_emails.unwrap_or(current.3))
    .execute(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(StatusCode::OK)
}
