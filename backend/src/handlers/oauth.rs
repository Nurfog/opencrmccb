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
use crate::error::AppError;
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
) -> Result<&'a OAuthProviderConfig, AppError> {
    match provider {
        "google" => state.oauth.google.as_ref(),
        "microsoft" => state.oauth.microsoft.as_ref(),
        "github" => state.oauth.github.as_ref(),
        _ => None,
    }
    .ok_or(AppError::NotFound)
}

const OAUTH_STATE_TTL: chrono::Duration = chrono::Duration::minutes(10);
const OAUTH_STATE_MAX_ENTRIES: usize = 1000;

/// OAuth callbacks must hit the backend API (BACKEND_URL/API_URL), not the
/// frontend SPA. Falls back to `state.backend_url`.
fn oauth_redirect_uri(state: &AppState, provider: &str) -> String {
    let base = if state.backend_url.trim().is_empty() {
        std::env::var("BACKEND_URL")
            .or_else(|_| std::env::var("API_URL"))
            .unwrap_or_else(|_| "http://localhost:8000".into())
    } else {
        state.backend_url.clone()
    };
    format!(
        "{}/api/v1/integrations/{}/callback",
        base.trim_end_matches('/'),
        provider
    )
}

/// Authenticated endpoint: returns the OAuth authorize URL for a provider
pub async fn connect(
    State(state): State<AppState>,
    claims: axum::extract::Extension<Claims>,
    Path(provider): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    let cfg = get_provider_config(&state, &provider)?;
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| AppError::Unauthorized)?;

    let state_val = generate_state();
    let redirect_uri = oauth_redirect_uri(&state, &provider);

    {
        let mut store = state.oauth.state_store.write().await;
        // Opportunistic purge of expired entries to bound memory.
        let now = Utc::now();
        store.retain(|_, v| now.signed_duration_since(v.created_at) < OAUTH_STATE_TTL);
        // Hard cap at 1000 entries: evict oldest first if still overfull.
        // TODO: move to Redis for shared, TTL-native, bounded state across replicas.
        if store.len() >= OAUTH_STATE_MAX_ENTRIES {
            let mut oldest: Vec<(String, chrono::DateTime<Utc>)> = store
                .iter()
                .map(|(k, v)| (k.clone(), v.created_at))
                .collect();
            oldest.sort_by_key(|(_, t)| *t);
            let to_evict = store.len().saturating_sub(OAUTH_STATE_MAX_ENTRIES - 1);
            for (k, _) in oldest.into_iter().take(to_evict) {
                store.remove(&k);
            }
        }
        store.insert(
            state_val.clone(),
            crate::OAuthPendingState {
                provider: provider.clone(),
                user_id,
                created_at: now,
            },
        );
    }

    let consent_params = if provider == "google" {
        "&access_type=offline&prompt=consent"
    } else {
        ""
    };

    let auth_url = format!(
        "{}?client_id={}&redirect_uri={}&response_type=code&scope={}&state={}{}",
        cfg.auth_url,
        cfg.client_id,
        urlencode(&redirect_uri),
        urlencode(&cfg.scope),
        state_val,
        consent_params,
    );

    Ok(Json(serde_json::json!({ "auth_url": auth_url })))
}

/// Public callback: OAuth provider redirects here after user authorizes
pub async fn callback(
    State(state): State<AppState>,
    Path(provider): Path<String>,
    Query(query): Query<CallbackQuery>,
) -> Result<impl IntoResponse, AppError> {
    let cfg = get_provider_config(&state, &provider)?;

    if let Some(err) = &query.error {
        let redirect = format!(
            "{}/settings?integration={}&status=error&reason={}",
            state.frontend_url, provider, err
        );
        return Ok(Redirect::to(&redirect).into_response());
    }

    let code = query
        .code
        .as_ref()
        .ok_or_else(|| AppError::BadRequest("Missing code".into()))?;
    let state_param = query
        .state
        .as_ref()
        .ok_or_else(|| AppError::BadRequest("Missing state".into()))?;

    // Verify state (single-use) and recover user_id
    let user_id = {
        let mut store = state.oauth.state_store.write().await;
        let pending = store.remove(state_param).ok_or(AppError::Unauthorized)?;
        if pending.provider != provider {
            return Err(AppError::Unauthorized);
        }
        if Utc::now().signed_duration_since(pending.created_at) >= OAUTH_STATE_TTL {
            return Err(AppError::Unauthorized);
        }
        pending.user_id
    };

    // Exchange code for tokens (backend callback URL, not frontend).
    let redirect_uri = oauth_redirect_uri(&state, &provider);

    // GitHub's token endpoint does not use `grant_type`; send it only for
    // providers that require OAuth2 `authorization_code` grant.
    let auth_code = "authorization_code".to_string();
    let mut form_params: Vec<(&str, &String)> = vec![
        ("client_id", &cfg.client_id),
        ("client_secret", &cfg.client_secret),
        ("code", code),
        ("redirect_uri", &redirect_uri),
    ];
    if provider != "github" {
        form_params.push(("grant_type", &auth_code));
    }

    let token_resp = state
        .http_client
        .post(&cfg.token_url)
        .form(&form_params)
        .header("Accept", "application/json")
        .send()
        .await?;

    let token_body: serde_json::Value = token_resp.json().await?;

    let access_token = token_body["access_token"]
        .as_str()
        .ok_or_else(|| {
            tracing::error!("oauth token response missing access_token for {provider}");
            AppError::Internal("internal error".into())
        })?
        .to_string();
    let refresh_token = token_body["refresh_token"].as_str().map(|s| s.to_string());
    let expires_in = token_body["expires_in"].as_i64();

    // Fetch user info from provider
    let userinfo_resp = state
        .http_client
        .get(&cfg.userinfo_url)
        .header("Authorization", format!("Bearer {}", access_token))
        .header("Accept", "application/json")
        .send()
        .await?;

    let userinfo: serde_json::Value = userinfo_resp.json().await?;

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
    .await?;

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
) -> Result<Json<Vec<IntegrationStatus>>, AppError> {
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| AppError::Unauthorized)?;

    let rows = sqlx::query_as::<_, IntegrationRow>(
        "SELECT provider, created_at, provider_email, provider_name FROM user_integrations WHERE user_id = $1 ORDER BY provider"
    )
    .bind(user_id)
    .fetch_all(&state.db)
    .await?;

    let configured = [("google", false), ("microsoft", false), ("github", false)];
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
) -> Result<StatusCode, AppError> {
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| AppError::Unauthorized)?;

    let result = sqlx::query("DELETE FROM user_integrations WHERE user_id = $1 AND provider = $2")
        .bind(user_id)
        .bind(&provider)
        .execute(&state.db)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
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
