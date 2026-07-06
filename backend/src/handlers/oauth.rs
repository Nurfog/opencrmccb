use axum::Json;
use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Redirect};
use chrono::Utc;
use rand::Rng;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::AppState;
use crate::config::OAuthProviderConfig;
use crate::middleware::auth::Claims;
use crate::services::crypto::encrypt;

#[derive(Debug, Serialize)]
pub struct IntegrationStatus {
    pub provider: String,
    pub connected: bool,
    pub connected_at: Option<String>,
    pub provider_email: Option<String>,
    pub provider_name: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CallbackQuery {
    code: Option<String>,
    state: Option<String>,
    error: Option<String>,
}

fn generate_state() -> String {
    rand::thread_rng()
        .sample_iter(&rand::distributions::Alphanumeric)
        .take(32)
        .map(char::from)
        .collect()
}

fn get_provider_config<'a>(
    state: &'a AppState,
    provider: &str,
) -> Result<&'a OAuthProviderConfig, StatusCode> {
    match provider {
        "google" => state.oauth.google.as_ref(),
        "microsoft" => state.oauth.microsoft.as_ref(),
        _ => None,
    }
    .ok_or(StatusCode::NOT_FOUND)
}

/// Authenticated endpoint: returns the OAuth authorize URL for a provider
pub async fn connect(
    State(state): State<AppState>,
    claims: axum::extract::Extension<Claims>,
    Path(provider): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let cfg = get_provider_config(&state, &provider)?;
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;

    let state_val = generate_state();
    let redirect_uri = format!(
        "{}/api/v1/integrations/{}/callback",
        state.frontend_url, provider
    );

    {
        let mut store = state.oauth.state_store.write().await;
        store.insert(
            state_val.clone(),
            crate::OAuthPendingState {
                provider: provider.clone(),
                user_id,
                created_at: Utc::now(),
            },
        );
    }

    let auth_url = format!(
        "{}?client_id={}&redirect_uri={}&response_type=code&scope={}&state={}&access_type=offline&prompt=consent",
        cfg.auth_url,
        cfg.client_id,
        urlencode(&redirect_uri),
        urlencode(&cfg.scope),
        state_val,
    );

    Ok(Json(serde_json::json!({ "auth_url": auth_url })))
}

/// Public callback: OAuth provider redirects here after user authorizes
pub async fn callback(
    State(state): State<AppState>,
    Path(provider): Path<String>,
    Query(query): Query<CallbackQuery>,
) -> Result<impl IntoResponse, StatusCode> {
    let cfg = get_provider_config(&state, &provider)?;

    if let Some(err) = &query.error {
        let redirect = format!(
            "{}/settings?integration={}&status=error&reason={}",
            state.frontend_url, provider, err
        );
        return Ok(Redirect::to(&redirect).into_response());
    }

    let code = query.code.as_ref().ok_or(StatusCode::BAD_REQUEST)?;
    let state_param = query.state.as_ref().ok_or(StatusCode::BAD_REQUEST)?;

    // Verify state and recover user_id
    let user_id = {
        let mut store = state.oauth.state_store.write().await;
        let pending = store.remove(state_param).ok_or(StatusCode::UNAUTHORIZED)?;
        if pending.provider != provider {
            return Err(StatusCode::UNAUTHORIZED);
        }
        pending.user_id
    };

    // Exchange code for tokens
    let redirect_uri = format!(
        "{}/api/v1/integrations/{}/callback",
        state.frontend_url, provider
    );

    let client = reqwest::Client::new();
    let token_params = [
        ("client_id", &cfg.client_id),
        ("client_secret", &cfg.client_secret),
        ("code", code),
        ("redirect_uri", &redirect_uri),
        ("grant_type", &"authorization_code".to_string()),
    ];

    let token_resp = client
        .post(&cfg.token_url)
        .form(&token_params)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|_| StatusCode::BAD_GATEWAY)?;

    let token_body: serde_json::Value = token_resp
        .json()
        .await
        .map_err(|_| StatusCode::BAD_GATEWAY)?;

    let access_token = token_body["access_token"]
        .as_str()
        .ok_or(StatusCode::BAD_GATEWAY)?
        .to_string();
    let refresh_token = token_body["refresh_token"].as_str().map(|s| s.to_string());
    let expires_in = token_body["expires_in"].as_i64();

    // Fetch user info from provider
    let userinfo_resp = client
        .get(&cfg.userinfo_url)
        .header("Authorization", format!("Bearer {}", access_token))
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|_| StatusCode::BAD_GATEWAY)?;

    let userinfo: serde_json::Value = userinfo_resp
        .json()
        .await
        .map_err(|_| StatusCode::BAD_GATEWAY)?;

    let provider_email = userinfo["email"].as_str().map(|s| s.to_string());
    let provider_name = userinfo["name"].as_str().map(|s| s.to_string());

    let expires_at = expires_in.map(|secs| Utc::now() + chrono::Duration::seconds(secs));

    let key = state.auth.token_encryption_key.as_deref();
    let enc_access = encrypt(&access_token, key);
    let enc_refresh = refresh_token.as_ref().map(|t| encrypt(t, key));

    // Upsert integration in database
    sqlx::query(
        r#"
        INSERT INTO user_integrations (user_id, provider, access_token, refresh_token, token_expires_at, provider_email, provider_name)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (user_id, provider)
        DO UPDATE SET
            access_token = EXCLUDED.access_token,
            refresh_token = COALESCE(EXCLUDED.refresh_token, user_integrations.refresh_token),
            token_expires_at = EXCLUDED.token_expires_at,
            provider_email = EXCLUDED.provider_email,
            provider_name = EXCLUDED.provider_name,
            updated_at = NOW()
        "#,
    )
    .bind(user_id)
    .bind(&provider)
    .bind(&enc_access)
    .bind(&enc_refresh)
    .bind(expires_at)
    .bind(&provider_email)
    .bind(&provider_name)
    .execute(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let redirect = format!(
        "{}/settings?integration={}&status=connected",
        state.frontend_url, provider
    );
    Ok(Redirect::to(&redirect).into_response())
}

/// Authenticated: list connected integrations for the current user
pub async fn list_integrations(
    State(state): State<AppState>,
    claims: axum::extract::Extension<Claims>,
) -> Result<Json<Vec<IntegrationStatus>>, StatusCode> {
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;

    let rows = sqlx::query_as::<_, IntegrationRow>(
        "SELECT provider, created_at, provider_email, provider_name FROM user_integrations WHERE user_id = $1 ORDER BY provider"
    )
    .bind(user_id)
    .fetch_all(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let configured = [("google", false), ("microsoft", false)];
    let mut result: Vec<IntegrationStatus> = configured
        .iter()
        .map(|(p, _)| IntegrationStatus {
            provider: p.to_string(),
            connected: false,
            connected_at: None,
            provider_email: None,
            provider_name: None,
        })
        .collect();

    for row in rows {
        if let Some(item) = result.iter_mut().find(|r| r.provider == row.provider) {
            item.connected = true;
            item.connected_at = Some(row.created_at.format("%Y-%m-%dT%H:%M:%SZ").to_string());
            item.provider_email = row.provider_email;
            item.provider_name = row.provider_name;
        }
    }

    Ok(Json(result))
}

/// Authenticated: disconnect an integration
pub async fn disconnect(
    State(state): State<AppState>,
    claims: axum::extract::Extension<Claims>,
    Path(provider): Path<String>,
) -> Result<StatusCode, StatusCode> {
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;

    let result = sqlx::query("DELETE FROM user_integrations WHERE user_id = $1 AND provider = $2")
        .bind(user_id)
        .bind(&provider)
        .execute(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    Ok(StatusCode::NO_CONTENT)
}

#[derive(Debug, sqlx::FromRow)]
struct IntegrationRow {
    provider: String,
    created_at: chrono::DateTime<Utc>,
    provider_email: Option<String>,
    provider_name: Option<String>,
}

fn urlencode(s: &str) -> String {
    let mut result = String::with_capacity(s.len());
    for byte in s.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                result.push(byte as char);
            }
            _ => {
                result.push_str(&format!("%{:02X}", byte));
            }
        }
    }
    result
}
