use axum::Json;
use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::AppState;
use crate::error::AppError;
use crate::middleware::auth::{Claims, UserPermissions};
use crate::models::{
    CalendarConnectionStatus, CalendarEvent, CalendarQuery, CreateCalendarEvent,
    UpdateCalendarEvent,
};
use crate::services::crypto::{decrypt, encrypt};

// Get connection status
pub async fn connection_status(
    State(state): State<AppState>,
    perms: UserPermissions,
) -> Result<Json<CalendarConnectionStatus>, AppError> {
    perms
        .require("calendar.view")
        .map_err(|_| AppError::Forbidden)?;
    let google = state.oauth.google.is_some();
    let microsoft = state.oauth.microsoft.is_some();

    Ok(Json(CalendarConnectionStatus { google, microsoft }))
}

// Google Calendar OAuth callback
pub async fn google_callback(
    State(state): State<AppState>,
    claims: axum::extract::Extension<Claims>,
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
    perms: UserPermissions,
) -> Result<StatusCode, AppError> {
    perms
        .require("calendar.create")
        .map_err(|_| AppError::Forbidden)?;
    let user_id = Uuid::parse_str(&claims.sub)?;
    let code = params
        .get("code")
        .ok_or_else(|| AppError::BadRequest("Missing code".into()))?;

    // Exchange code for tokens — credentials come from AppState.oauth
    // (config::load_oauth, OAUTH_GOOGLE_*), not raw std::env vars.
    let (client_id, client_secret, token_url) = match &state.oauth.google {
        Some(cfg) => (
            cfg.client_id.clone(),
            cfg.client_secret.clone(),
            cfg.token_url.clone(),
        ),
        None => {
            tracing::error!("google oauth not configured");
            return Err(AppError::Internal("internal error".into()));
        }
    };
    let redirect_uri = format!(
        "{}/api/v1/calendar/google/callback",
        state.backend_url.trim_end_matches('/')
    );

    let token_response = state
        .http_client
        .post(&token_url)
        .form(&[
            ("code", code.as_str()),
            ("client_id", &client_id),
            ("client_secret", &client_secret),
            ("redirect_uri", &redirect_uri),
            ("grant_type", "authorization_code"),
        ])
        .send()
        .await?;

    let tokens: serde_json::Value = token_response.json().await?;

    let access_token = tokens["access_token"].as_str().ok_or_else(|| {
        tracing::error!("google token response missing access_token");
        AppError::Internal("internal error".into())
    })?;
    let refresh_token = tokens["refresh_token"].as_str();
    let expires_in = tokens["expires_in"].as_i64().unwrap_or(3600);
    let expires_at = Utc::now() + chrono::Duration::seconds(expires_in);

    let key = state.auth.token_encryption_key.as_deref();
    let enc_access = encrypt(access_token, key);
    let enc_refresh = refresh_token.map(|t| encrypt(t, key));

    // Store tokens (user_id would come from session/JWT in production)
    // For now, using a placeholder
    sqlx::query(
        "INSERT INTO calendar_tokens (user_id, provider, access_token, refresh_token, expires_at)
         VALUES ($1, 'google', $2, $3, $4)
         ON CONFLICT (user_id, provider) DO UPDATE SET
            access_token = EXCLUDED.access_token,
            refresh_token = COALESCE(EXCLUDED.refresh_token, calendar_tokens.refresh_token),
            expires_at = EXCLUDED.expires_at,
            updated_at = NOW()",
    )
    .bind(user_id)
    .bind(&enc_access)
    .bind(&enc_refresh)
    .bind(expires_at)
    .execute(&state.db)
    .await?;

    Ok(StatusCode::OK)
}

// Microsoft Calendar OAuth callback
pub async fn microsoft_callback(
    State(state): State<AppState>,
    claims: axum::extract::Extension<Claims>,
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
    perms: UserPermissions,
) -> Result<StatusCode, AppError> {
    perms
        .require("calendar.create")
        .map_err(|_| AppError::Forbidden)?;
    let user_id = Uuid::parse_str(&claims.sub)?;
    let code = params
        .get("code")
        .ok_or_else(|| AppError::BadRequest("Missing code".into()))?;

    // Credentials from AppState.oauth (config::load_oauth, OAUTH_MICROSOFT_*).
    let (client_id, client_secret, token_url) = match &state.oauth.microsoft {
        Some(cfg) => (
            cfg.client_id.clone(),
            cfg.client_secret.clone(),
            cfg.token_url.clone(),
        ),
        None => {
            tracing::error!("microsoft oauth not configured");
            return Err(AppError::Internal("internal error".into()));
        }
    };
    let redirect_uri = format!(
        "{}/api/v1/calendar/microsoft/callback",
        state.backend_url.trim_end_matches('/')
    );

    let token_response = state
        .http_client
        .post(&token_url)
        .form(&[
            ("code", code.as_str()),
            ("client_id", &client_id),
            ("client_secret", &client_secret),
            ("redirect_uri", &redirect_uri),
            ("grant_type", "authorization_code"),
        ])
        .send()
        .await?;

    let tokens: serde_json::Value = token_response.json().await?;

    let access_token = tokens["access_token"].as_str().ok_or_else(|| {
        tracing::error!("microsoft token response missing access_token");
        AppError::Internal("internal error".into())
    })?;
    let refresh_token = tokens["refresh_token"].as_str();
    let expires_in = tokens["expires_in"].as_i64().unwrap_or(3600);
    let expires_at = Utc::now() + chrono::Duration::seconds(expires_in);

    let key = state.auth.token_encryption_key.as_deref();
    let enc_access = encrypt(access_token, key);
    let enc_refresh = refresh_token.map(|t| encrypt(t, key));

    sqlx::query(
        "INSERT INTO calendar_tokens (user_id, provider, access_token, refresh_token, expires_at)
         VALUES ($1, 'microsoft', $2, $3, $4)
         ON CONFLICT (user_id, provider) DO UPDATE SET
            access_token = EXCLUDED.access_token,
            refresh_token = COALESCE(EXCLUDED.refresh_token, calendar_tokens.refresh_token),
            expires_at = EXCLUDED.expires_at,
            updated_at = NOW()",
    )
    .bind(user_id)
    .bind(&enc_access)
    .bind(&enc_refresh)
    .bind(expires_at)
    .execute(&state.db)
    .await?;

    Ok(StatusCode::OK)
}

// Get OAuth URLs for connecting
pub async fn get_auth_url(
    State(state): State<AppState>,
    Path(provider): Path<String>,
    perms: UserPermissions,
) -> Result<Json<serde_json::Value>, AppError> {
    perms
        .require("calendar.view")
        .map_err(|_| AppError::Forbidden)?;
    match provider.as_str() {
        "google" => {
            let cfg = state.oauth.google.as_ref().ok_or_else(|| {
                tracing::error!("google oauth not configured");
                AppError::Internal("internal error".into())
            })?;
            let redirect_uri = format!(
                "{}/api/v1/calendar/google/callback",
                state.backend_url.trim_end_matches('/')
            );
            let url = format!(
                "{}?client_id={}&redirect_uri={}&response_type=code&scope={}&access_type=offline&prompt=consent",
                cfg.auth_url,
                cfg.client_id,
                redirect_uri,
                "https://www.googleapis.com/auth/calendar"
            );
            Ok(Json(serde_json::json!({ "url": url })))
        }
        "microsoft" => {
            let cfg = state.oauth.microsoft.as_ref().ok_or_else(|| {
                tracing::error!("microsoft oauth not configured");
                AppError::Internal("internal error".into())
            })?;
            let redirect_uri = format!(
                "{}/api/v1/calendar/microsoft/callback",
                state.backend_url.trim_end_matches('/')
            );
            let url = format!(
                "{}?client_id={}&redirect_uri={}&response_type=code&scope=https://graph.microsoft.com/Calendars.ReadWrite&response_mode=query",
                cfg.auth_url, cfg.client_id, redirect_uri
            );
            Ok(Json(serde_json::json!({ "url": url })))
        }
        _ => Err(AppError::BadRequest("Unknown provider".into())),
    }
}

// List calendar events
pub async fn list_events(
    State(state): State<AppState>,
    claims: axum::extract::Extension<Claims>,
    Query(params): Query<CalendarQuery>,
    perms: UserPermissions,
) -> Result<Json<Vec<CalendarEvent>>, AppError> {
    perms
        .require("calendar.view")
        .map_err(|_| AppError::Forbidden)?;
    let user_id = Uuid::parse_str(&claims.sub)?;
    let start = params
        .start
        .unwrap_or_else(|| Utc::now() - chrono::Duration::days(30));
    let end = params
        .end
        .unwrap_or_else(|| Utc::now() + chrono::Duration::days(60));

    let events = if let Some(ref provider) = params.provider {
        sqlx::query_as::<_, CalendarEvent>(
            "SELECT id, user_id, provider, external_id, title, description, location, start_time, end_time, all_day, attendees, entity_type, entity_id, created_at, updated_at
             FROM calendar_events WHERE user_id = $1 AND start_time >= $2 AND end_time <= $3 AND provider = $4 ORDER BY start_time",
        )
        .bind(user_id)
        .bind(start)
        .bind(end)
        .bind(provider)
        .fetch_all(&state.db)
        .await?
    } else {
        sqlx::query_as::<_, CalendarEvent>(
            "SELECT id, user_id, provider, external_id, title, description, location, start_time, end_time, all_day, attendees, entity_type, entity_id, created_at, updated_at
             FROM calendar_events WHERE user_id = $1 AND start_time >= $2 AND end_time <= $3 ORDER BY start_time",
        )
        .bind(user_id)
        .bind(start)
        .bind(end)
        .fetch_all(&state.db)
        .await?
    };

    Ok(Json(events))
}

// Create calendar event
pub async fn create_event(
    State(state): State<AppState>,
    claims: axum::extract::Extension<Claims>,
    perms: UserPermissions,
    Json(input): Json<CreateCalendarEvent>,
) -> Result<(StatusCode, Json<CalendarEvent>), AppError> {
    perms
        .require("calendar.create")
        .map_err(|_| AppError::Forbidden)?;
    let user_id = Uuid::parse_str(&claims.sub)?;
    let event = sqlx::query_as::<_, CalendarEvent>(
        "INSERT INTO calendar_events (user_id, provider, title, description, location, start_time, end_time, all_day, attendees, entity_type, entity_id)
         VALUES ($1, 'local', $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id, user_id, provider, external_id, title, description, location, start_time, end_time, all_day, attendees, entity_type, entity_id, created_at, updated_at",
    )
    .bind(user_id)
    .bind(&input.title)
    .bind(&input.description)
    .bind(&input.location)
    .bind(input.start_time)
    .bind(input.end_time)
    .bind(input.all_day.unwrap_or(false))
    .bind(input.attendees.map(|a| serde_json::json!(a)))
    .bind(&input.entity_type)
    .bind(input.entity_id)
    .fetch_one(&state.db)
    .await?;

    Ok((StatusCode::CREATED, Json(event)))
}

// Update calendar event
pub async fn update_event(
    State(state): State<AppState>,
    claims: axum::extract::Extension<Claims>,
    Path(id): Path<Uuid>,
    perms: UserPermissions,
    Json(input): Json<UpdateCalendarEvent>,
) -> Result<Json<CalendarEvent>, AppError> {
    perms
        .require("calendar.edit")
        .map_err(|_| AppError::Forbidden)?;
    let user_id = Uuid::parse_str(&claims.sub)?;
    let event = sqlx::query_as::<_, CalendarEvent>(
        "UPDATE calendar_events SET
            title = COALESCE($3, title),
            description = COALESCE($4, description),
            location = COALESCE($5, location),
            start_time = COALESCE($6, start_time),
            end_time = COALESCE($7, end_time),
            all_day = COALESCE($8, all_day),
            attendees = COALESCE($9, attendees),
            updated_at = NOW()
         WHERE id = $1 AND user_id = $2
         RETURNING id, user_id, provider, external_id, title, description, location, start_time, end_time, all_day, attendees, entity_type, entity_id, created_at, updated_at",
    )
    .bind(id)
    .bind(user_id)
    .bind(&input.title)
    .bind(&input.description)
    .bind(&input.location)
    .bind(input.start_time)
    .bind(input.end_time)
    .bind(input.all_day)
    .bind(input.attendees.map(|a| serde_json::json!(a)))
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(Json(event))
}

// Delete calendar event
pub async fn delete_event(
    State(state): State<AppState>,
    claims: axum::extract::Extension<Claims>,
    Path(id): Path<Uuid>,
    perms: UserPermissions,
) -> Result<StatusCode, AppError> {
    perms
        .require("calendar.delete")
        .map_err(|_| AppError::Forbidden)?;
    let user_id = Uuid::parse_str(&claims.sub)?;
    let result = sqlx::query("DELETE FROM calendar_events WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(user_id)
        .execute(&state.db)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(StatusCode::NO_CONTENT)
}

// Sync events from Google Calendar
pub async fn sync_google(
    State(state): State<AppState>,
    claims: axum::extract::Extension<Claims>,
    perms: UserPermissions,
) -> Result<Json<serde_json::Value>, AppError> {
    perms
        .require("calendar.create")
        .map_err(|_| AppError::Forbidden)?;
    let user_id = Uuid::parse_str(&claims.sub)?;
    // Get token
    let token = sqlx::query_as::<_, crate::models::CalendarToken>(
        "SELECT id, user_id, provider, access_token, refresh_token, expires_at, calendar_id, created_at, updated_at
         FROM calendar_tokens WHERE provider = 'google' AND user_id = $1 LIMIT 1",
    )
    .bind(user_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    let access_token = decrypt(
        &token.access_token,
        state.auth.token_encryption_key.as_deref(),
    );

    // Fetch events from Google Calendar API
    let now = Utc::now();
    let min_time = (now - chrono::Duration::days(90)).to_rfc3339();
    let max_time = (now + chrono::Duration::days(90)).to_rfc3339();

    let response = state
        .http_client
        .get("https://www.googleapis.com/calendar/v3/calendars/primary/events")
        .bearer_auth(&access_token)
        .query(&[
            ("timeMin", &min_time),
            ("timeMax", &max_time),
            ("singleEvents", &"true".to_string()),
            ("orderBy", &"startTime".to_string()),
            ("maxResults", &"250".to_string()),
        ])
        .send()
        .await?;

    let data: serde_json::Value = response.json().await?;

    let items = data["items"].as_array().ok_or_else(|| {
        tracing::error!("google calendar sync: missing items array");
        AppError::Internal("internal error".into())
    })?;
    let mut synced = 0;

    for item in items {
        let external_id = item["id"].as_str().unwrap_or("");
        let title = item["summary"].as_str().unwrap_or("Untitled");
        let description = item["description"].as_str();
        let location = item["location"].as_str();

        let start = item["start"]["dateTime"]
            .as_str()
            .or_else(|| item["start"]["date"].as_str())
            .and_then(|s| s.parse::<DateTime<Utc>>().ok());
        let end = item["end"]["dateTime"]
            .as_str()
            .or_else(|| item["end"]["date"].as_str())
            .and_then(|s| s.parse::<DateTime<Utc>>().ok());

        if let (Some(start_time), Some(end_time)) = (start, end) {
            sqlx::query(
                "INSERT INTO calendar_events (user_id, provider, external_id, title, description, location, start_time, end_time, all_day)
                 VALUES ($1, 'google', $2, $3, $4, $5, $6, $7, $8)
                 ON CONFLICT DO NOTHING",
            )
            .bind(user_id)
            .bind(external_id)
            .bind(title)
            .bind(description)
            .bind(location)
            .bind(start_time)
            .bind(end_time)
            .bind(item["start"]["date"].as_str().is_some())
            .execute(&state.db)
            .await
            .ok();
            synced += 1;
        }
    }

    Ok(Json(serde_json::json!({ "synced": synced })))
}
