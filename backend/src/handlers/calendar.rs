use axum::Json;
use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Redirect};
use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::AppState;
use crate::middleware::auth::{Claims, UserPermissions};
use crate::models::{
    CalendarConnectionStatus, CalendarEvent, CalendarQuery, CreateCalendarEvent,
    UpdateCalendarEvent,
};
use crate::services::crypto::{decrypt, encrypt};

// Whether the current user has connected each calendar provider.
pub async fn connection_status(
    State(state): State<AppState>,
    claims: axum::extract::Extension<Claims>,
    perms: UserPermissions,
) -> Result<Json<CalendarConnectionStatus>, StatusCode> {
    perms
        .require("calendar.view")
        .map_err(|_| StatusCode::FORBIDDEN)?;
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;

    let providers =
        sqlx::query_scalar::<_, String>("SELECT provider FROM calendar_tokens WHERE user_id = $1")
            .bind(user_id)
            .fetch_all(&state.db)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(CalendarConnectionStatus {
        google: providers.iter().any(|p| p == "google"),
        microsoft: providers.iter().any(|p| p == "microsoft"),
    }))
}

fn generate_state() -> String {
    use rand::Rng;
    rand::thread_rng()
        .sample_iter(&rand::distributions::Alphanumeric)
        .take(32)
        .map(char::from)
        .collect()
}

fn urlencode(s: &str) -> String {
    let mut result = String::with_capacity(s.len());
    for byte in s.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                result.push(byte as char);
            }
            _ => result.push_str(&format!("%{:02X}", byte)),
        }
    }
    result
}

struct CalendarOAuthConfig {
    client_id: String,
    client_secret: String,
    token_url: &'static str,
}

/// Client credentials from the canonical `OAUTH_*` config, falling back to
/// the legacy `GOOGLE_*/MICROSOFT_*` variables.
fn calendar_oauth_config(
    state: &AppState,
    provider: &str,
) -> Result<CalendarOAuthConfig, StatusCode> {
    let token_url = match provider {
        "google" => "https://oauth2.googleapis.com/token",
        "microsoft" => "https://login.microsoftonline.com/common/oauth2/v2.0/token",
        _ => return Err(StatusCode::NOT_FOUND),
    };
    let from_state = match provider {
        "google" => state.oauth.google.as_ref(),
        "microsoft" => state.oauth.microsoft.as_ref(),
        _ => None,
    };
    if let Some(cfg) = from_state {
        return Ok(CalendarOAuthConfig {
            client_id: cfg.client_id.clone(),
            client_secret: cfg.client_secret.clone(),
            token_url,
        });
    }
    let (id_var, secret_var) = match provider {
        "google" => ("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"),
        _ => ("MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET"),
    };
    Ok(CalendarOAuthConfig {
        client_id: std::env::var(id_var).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
        client_secret: std::env::var(secret_var).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
        token_url,
    })
}

fn calendar_redirect_uri(state: &AppState, provider: &str) -> String {
    let base = state.backend_public_url.trim_end_matches('/');
    format!("{}/api/v1/calendar/{}/callback", base, provider)
}

#[derive(Debug, serde::Deserialize)]
pub struct CalendarCallbackQuery {
    pub code: Option<String>,
    pub state: Option<String>,
    pub error: Option<String>,
}

/// Public callback: the OAuth provider redirects the user's browser here
/// without any JWT (cookies are SameSite and top-level navigation carries no
/// Authorization header). The `state` parameter links the request to the
/// user who started the flow in `get_auth_url`.
pub async fn calendar_callback(
    State(state): State<AppState>,
    Path(provider): Path<String>,
    Query(params): Query<CalendarCallbackQuery>,
) -> Result<impl IntoResponse, StatusCode> {
    if provider != "google" && provider != "microsoft" {
        return Err(StatusCode::NOT_FOUND);
    }
    let done = |status: &str| {
        Redirect::to(&format!(
            "{}/settings?integration={}&status={}",
            state.frontend_url, provider, status
        ))
    };

    if params.error.is_some() {
        return Ok(done("error"));
    }
    let code = params.code.as_ref().ok_or(StatusCode::BAD_REQUEST)?;
    let state_param = params.state.as_ref().ok_or(StatusCode::BAD_REQUEST)?;

    // Verify state and recover the user who started the flow.
    let user_id = {
        let mut store = state.oauth.state_store.write().await;
        let pending = store.remove(state_param).ok_or(StatusCode::UNAUTHORIZED)?;
        if pending.provider != format!("calendar:{provider}") {
            return Err(StatusCode::UNAUTHORIZED);
        }
        pending.user_id
    };

    let cfg = calendar_oauth_config(&state, &provider)?;
    let redirect_uri = calendar_redirect_uri(&state, &provider);

    // Exchange code for tokens
    let token_response = state
        .http_client
        .post(cfg.token_url)
        .form(&[
            ("code", code.as_str()),
            ("client_id", cfg.client_id.as_str()),
            ("client_secret", cfg.client_secret.as_str()),
            ("redirect_uri", redirect_uri.as_str()),
            ("grant_type", "authorization_code"),
        ])
        .send()
        .await
        .map_err(|_| StatusCode::BAD_GATEWAY)?;

    let tokens: serde_json::Value = token_response
        .json()
        .await
        .map_err(|_| StatusCode::BAD_GATEWAY)?;

    let access_token = tokens["access_token"]
        .as_str()
        .ok_or(StatusCode::BAD_GATEWAY)?;
    let refresh_token = tokens["refresh_token"].as_str();
    let expires_in = tokens["expires_in"].as_i64().unwrap_or(3600);
    let expires_at = Utc::now() + chrono::Duration::seconds(expires_in);

    let key = state.auth.token_encryption_key.as_deref();
    let enc_access = encrypt(access_token, key);
    let enc_refresh = refresh_token.map(|t| encrypt(t, key));

    sqlx::query(
        "INSERT INTO calendar_tokens (user_id, provider, access_token, refresh_token, expires_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id, provider) DO UPDATE SET
            access_token = EXCLUDED.access_token,
            refresh_token = COALESCE(EXCLUDED.refresh_token, calendar_tokens.refresh_token),
            expires_at = EXCLUDED.expires_at,
            updated_at = NOW()",
    )
    .bind(user_id)
    .bind(&provider)
    .bind(&enc_access)
    .bind(&enc_refresh)
    .bind(expires_at)
    .execute(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(done("connected"))
}

// Authenticated: OAuth URLs for connecting (starts the `state` flow
// completed by the public `calendar_callback`).
pub async fn get_auth_url(
    State(state): State<AppState>,
    claims: axum::extract::Extension<Claims>,
    Path(provider): Path<String>,
    perms: UserPermissions,
) -> Result<Json<serde_json::Value>, StatusCode> {
    perms
        .require("calendar.view")
        .map_err(|_| StatusCode::FORBIDDEN)?;
    if provider != "google" && provider != "microsoft" {
        return Err(StatusCode::BAD_REQUEST);
    }
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;
    let cfg = calendar_oauth_config(&state, &provider)?;
    let redirect_uri = calendar_redirect_uri(&state, &provider);

    let state_val = generate_state();
    {
        let mut store = state.oauth.state_store.write().await;
        store.insert(
            state_val.clone(),
            crate::OAuthPendingState {
                provider: format!("calendar:{provider}"),
                user_id,
                created_at: Utc::now(),
            },
        );
    }

    let url = match provider.as_str() {
        "google" => format!(
            "https://accounts.google.com/o/oauth2/v2/auth?client_id={}&redirect_uri={}&response_type=code&scope=https://www.googleapis.com/auth/calendar&access_type=offline&prompt=consent&state={}",
            urlencode(&cfg.client_id),
            urlencode(&redirect_uri),
            state_val
        ),
        _ => format!(
            "https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id={}&redirect_uri={}&response_type=code&scope=https://graph.microsoft.com/Calendars.ReadWrite&response_mode=query&state={}",
            urlencode(&cfg.client_id),
            urlencode(&redirect_uri),
            state_val
        ),
    };
    Ok(Json(serde_json::json!({ "url": url })))
}

// List calendar events (scoped to the current user)
pub async fn list_events(
    State(state): State<AppState>,
    claims: axum::extract::Extension<Claims>,
    Query(params): Query<CalendarQuery>,
    perms: UserPermissions,
) -> Result<Json<Vec<CalendarEvent>>, StatusCode> {
    perms
        .require("calendar.view")
        .map_err(|_| StatusCode::FORBIDDEN)?;
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;
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
        .await
    } else {
        sqlx::query_as::<_, CalendarEvent>(
            "SELECT id, user_id, provider, external_id, title, description, location, start_time, end_time, all_day, attendees, entity_type, entity_id, created_at, updated_at
             FROM calendar_events WHERE user_id = $1 AND start_time >= $2 AND end_time <= $3 ORDER BY start_time",
        )
        .bind(user_id)
        .bind(start)
        .bind(end)
        .fetch_all(&state.db)
        .await
    };

    let events = events.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(events))
}

// Create calendar event
pub async fn create_event(
    State(state): State<AppState>,
    claims: axum::extract::Extension<Claims>,
    perms: UserPermissions,
    Json(input): Json<CreateCalendarEvent>,
) -> Result<(StatusCode, Json<CalendarEvent>), StatusCode> {
    perms
        .require("calendar.create")
        .map_err(|_| StatusCode::FORBIDDEN)?;
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;
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
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok((StatusCode::CREATED, Json(event)))
}

// Update calendar event (only the owner's events)
pub async fn update_event(
    State(state): State<AppState>,
    claims: axum::extract::Extension<Claims>,
    Path(id): Path<Uuid>,
    perms: UserPermissions,
    Json(input): Json<UpdateCalendarEvent>,
) -> Result<Json<CalendarEvent>, StatusCode> {
    perms
        .require("calendar.edit")
        .map_err(|_| StatusCode::FORBIDDEN)?;
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;
    let event = sqlx::query_as::<_, CalendarEvent>(
        "UPDATE calendar_events SET
            title = COALESCE($2, title),
            description = COALESCE($3, description),
            location = COALESCE($4, location),
            start_time = COALESCE($5, start_time),
            end_time = COALESCE($6, end_time),
            all_day = COALESCE($7, all_day),
            attendees = COALESCE($8, attendees),
            updated_at = NOW()
         WHERE id = $1 AND user_id = $9
         RETURNING id, user_id, provider, external_id, title, description, location, start_time, end_time, all_day, attendees, entity_type, entity_id, created_at, updated_at",
    )
    .bind(id)
    .bind(&input.title)
    .bind(&input.description)
    .bind(&input.location)
    .bind(input.start_time)
    .bind(input.end_time)
    .bind(input.all_day)
    .bind(input.attendees.map(|a| serde_json::json!(a)))
    .bind(user_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(event))
}

// Delete calendar event (only the owner's events)
pub async fn delete_event(
    State(state): State<AppState>,
    claims: axum::extract::Extension<Claims>,
    Path(id): Path<Uuid>,
    perms: UserPermissions,
) -> Result<StatusCode, StatusCode> {
    perms
        .require("calendar.delete")
        .map_err(|_| StatusCode::FORBIDDEN)?;
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;
    let result = sqlx::query("DELETE FROM calendar_events WHERE id = $1 AND user_id = $2")
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

// Sync events from Google Calendar
pub async fn sync_google(
    State(state): State<AppState>,
    claims: axum::extract::Extension<Claims>,
    perms: UserPermissions,
) -> Result<Json<serde_json::Value>, StatusCode> {
    perms
        .require("calendar.create")
        .map_err(|_| StatusCode::FORBIDDEN)?;
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;
    // Get token
    let token = sqlx::query_as::<_, crate::models::CalendarToken>(
        "SELECT id, user_id, provider, access_token, refresh_token, expires_at, calendar_id, created_at, updated_at
         FROM calendar_tokens WHERE provider = 'google' AND user_id = $1 LIMIT 1",
    )
    .bind(user_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .ok_or(StatusCode::NOT_FOUND)?;

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
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let items = data["items"]
        .as_array()
        .ok_or(StatusCode::INTERNAL_SERVER_ERROR)?;
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
