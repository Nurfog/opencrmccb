use axum::{
    extract::{FromRequestParts, Request, State},
    http::{StatusCode, request::Parts},
    middleware::Next,
    response::{IntoResponse, Response},
};
use jsonwebtoken::{Algorithm, DecodingKey, Validation, decode};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::OnceLock;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::AppState;

// ─── Permissions cache ─────────────────────────────────────────
// Avoid querying `profile_permissions` on every authenticated request
// (and twice on admin routes). Short TTL keeps RBAC changes visible
// within seconds while drastically cutting DB round-trips.
const PERM_TTL: Duration = Duration::from_secs(60);
const PERM_MAX_ENTRIES: usize = 10_000;

struct PermCacheEntry {
    perms: Vec<String>,
    fetched_at: Instant,
}

fn perm_cache() -> &'static Mutex<HashMap<Uuid, PermCacheEntry>> {
    static CACHE: OnceLock<Mutex<HashMap<Uuid, PermCacheEntry>>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn json_error(status: StatusCode, msg: &str) -> Response {
    (status, axum::Json(serde_json::json!({ "error": msg }))).into_response()
}

/// Load a user's permissions from the DB, using a short-lived in-memory cache.
pub(crate) async fn load_permissions(
    state: &AppState,
    user_id: Uuid,
) -> Result<Vec<String>, StatusCode> {
    {
        let guard = perm_cache().lock().await;
        if let Some(entry) = guard.get(&user_id)
            && entry.fetched_at.elapsed() < PERM_TTL
        {
            return Ok(entry.perms.clone());
        }
    }

    let perms: Vec<String> = sqlx::query_scalar(
        "SELECT pp.permission FROM profile_permissions pp \
         JOIN users u ON u.profile_id = pp.profile_id \
         WHERE u.id = $1",
    )
    .bind(user_id)
    .fetch_all(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    {
        let mut guard = perm_cache().lock().await;
        // Bound memory: evict half when full (simple LRU-ish by age).
        if guard.len() >= PERM_MAX_ENTRIES {
            let mut entries: Vec<(Uuid, Instant)> =
                guard.iter().map(|(k, v)| (*k, v.fetched_at)).collect();
            entries.sort_by_key(|(_, t)| *t);
            for (k, _) in entries.into_iter().take(PERM_MAX_ENTRIES / 2) {
                guard.remove(&k);
            }
        }
        guard.insert(
            user_id,
            PermCacheEntry {
                perms: perms.clone(),
                fetched_at: Instant::now(),
            },
        );
    }

    Ok(perms)
}

/// Invalidate cached permissions for a user. Call after profile/role changes.
pub async fn invalidate_user_permissions(user_id: &Uuid) {
    perm_cache().lock().await.remove(user_id);
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub email: String,
    #[serde(default)]
    pub role: String,
    pub exp: usize,
}

// ─── Cookie Helpers ──────────────────────────────────────────────

fn cookie_secure_flag() -> &'static str {
    // Only emit `Secure` in production (HTTPS). On plain localhost HTTP,
    // `Secure` cookies are never sent and login would silently break.
    match std::env::var("COOKIE_SECURE").as_deref() {
        Ok("true") | Ok("1") => "; Secure",
        _ => "",
    }
}

pub fn access_token_cookie(value: &str, max_age_secs: i64) -> String {
    format!(
        "access_token={value}; Path=/; HttpOnly; SameSite=Lax{}; Max-Age={max_age_secs}",
        cookie_secure_flag()
    )
}

pub fn refresh_token_cookie(value: &str, max_age_secs: i64) -> String {
    format!(
        "refresh_token={value}; Path=/api/v1/auth/refresh; HttpOnly; SameSite=Lax{}; Max-Age={max_age_secs}",
        cookie_secure_flag()
    )
}

pub fn csrf_cookie(value: &str, max_age_secs: i64) -> String {
    format!(
        "csrf_token={value}; Path=/; SameSite=Lax{}; Max-Age={max_age_secs}",
        cookie_secure_flag()
    )
}

pub fn clear_auth_cookies() -> Vec<String> {
    vec![
        format!(
            "access_token=; Path=/; HttpOnly; SameSite=Lax{}; Max-Age=0",
            cookie_secure_flag()
        ),
        format!(
            "refresh_token=; Path=/api/v1/auth/refresh; HttpOnly; SameSite=Lax{}; Max-Age=0",
            cookie_secure_flag()
        ),
        format!(
            "csrf_token=; Path=/; SameSite=Lax{}; Max-Age=0",
            cookie_secure_flag()
        ),
    ]
}

pub fn generate_csrf_token() -> String {
    Uuid::new_v4().to_string()
}

// ─── Auth Middleware ──────────────────────────────────────────────

#[allow(clippy::result_large_err)]
pub async fn auth_middleware(
    State(state): State<AppState>,
    mut request: Request,
    next: Next,
) -> Result<Response, Response> {
    // Try Authorization header first, then cookie
    let token = request
        .headers()
        .get("Authorization")
        .and_then(|header| header.to_str().ok())
        .and_then(|header| header.strip_prefix("Bearer "))
        .map(|s| s.to_string())
        .or_else(|| {
            // Fallback to access_token cookie
            request
                .headers()
                .get("cookie")
                .and_then(|header| header.to_str().ok())
                .and_then(|cookie_str| {
                    cookie_str.split(';').find_map(|c| {
                        let c = c.trim();
                        c.strip_prefix("access_token=").map(|v| v.to_string())
                    })
                })
        });

    let token = match token {
        Some(t) => t,
        None => return Err(json_error(StatusCode::UNAUTHORIZED, "Unauthorized")),
    };

    let token_data = decode::<Claims>(
        &token,
        &DecodingKey::from_secret(state.auth.jwt_secret.as_bytes()),
        &Validation::new(Algorithm::HS256),
    )
    .map_err(|_| json_error(StatusCode::UNAUTHORIZED, "Unauthorized"))?;

    // Load permissions once and attach to request extensions
    let user_id = Uuid::parse_str(&token_data.claims.sub)
        .map_err(|_| json_error(StatusCode::UNAUTHORIZED, "Unauthorized"))?;

    let permissions = load_permissions(&state, user_id)
        .await
        .map_err(|_| json_error(StatusCode::INTERNAL_SERVER_ERROR, "Internal server error"))?;

    request.extensions_mut().insert(token_data.claims);
    request
        .extensions_mut()
        .insert(UserPermissions(permissions));

    Ok(next.run(request).await)
}

// ─── CSRF Middleware ──────────────────────────────────────────────

#[allow(clippy::result_large_err)]
pub async fn csrf_middleware(request: Request, next: Next) -> Result<Response, Response> {
    let method = request.method().clone();

    // Only check CSRF on state-changing methods
    if method == axum::http::Method::GET
        || method == axum::http::Method::HEAD
        || method == axum::http::Method::OPTIONS
    {
        return Ok(next.run(request).await);
    }

    // Skip CSRF for auth endpoints (login, register, refresh, forgot/reset password)
    let path = request.uri().path().to_string();
    if path.starts_with("/api/v1/auth/login")
        || path.starts_with("/api/v1/auth/register")
        || path.starts_with("/api/v1/auth/refresh")
        || path.starts_with("/api/v1/auth/forgot-password")
        || path.starts_with("/api/v1/auth/reset-password")
        || path.starts_with("/api/v1/integrations/whatsapp/webhook")
        || (path.starts_with("/api/v1/integrations/") && path.ends_with("/callback"))
    {
        return Ok(next.run(request).await);
    }

    // Get CSRF token from header
    let header_csrf = request
        .headers()
        .get("X-CSRF-Token")
        .and_then(|h| h.to_str().ok());

    // Get CSRF token from cookie
    let cookie_csrf = request
        .headers()
        .get("cookie")
        .and_then(|header| header.to_str().ok())
        .and_then(|cookie_str| {
            cookie_str.split(';').find_map(|c| {
                let c = c.trim();
                c.strip_prefix("csrf_token=").map(|v| v.to_string())
            })
        });

    match (header_csrf, cookie_csrf) {
        (Some(header), Some(cookie)) if !header.is_empty() && header == cookie => {
            Ok(next.run(request).await)
        }
        _ => Err(json_error(StatusCode::FORBIDDEN, "CSRF validation failed")),
    }
}

// ─── Permission Extractor ───────────────────────────────────────

/// Axum extractor that loads the current user's permissions from the DB.
/// Usage: `perms: UserPermissions` in handler signature.
/// Then call `perms.require("contacts.create")?` to gate access.
#[derive(Clone)]
pub struct UserPermissions(pub Vec<String>);

impl UserPermissions {
    pub fn has(&self, permission: &str) -> bool {
        self.0.iter().any(|p| p == permission)
    }

    pub fn require(&self, permission: &str) -> Result<(), StatusCode> {
        if self.has(permission) {
            Ok(())
        } else {
            Err(StatusCode::FORBIDDEN)
        }
    }
}

impl FromRequestParts<AppState> for UserPermissions {
    type Rejection = Response;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        // Check if permissions were already loaded by admin_only_middleware
        if let Some(perms) = parts.extensions.get::<UserPermissions>() {
            return Ok(perms.clone());
        }

        let claims = parts
            .extensions
            .get::<Claims>()
            .cloned()
            .ok_or_else(|| json_error(StatusCode::UNAUTHORIZED, "Unauthorized"))?;

        let user_id = Uuid::parse_str(&claims.sub)
            .map_err(|_| json_error(StatusCode::UNAUTHORIZED, "Unauthorized"))?;

        let permissions = load_permissions(state, user_id)
            .await
            .map_err(|_| json_error(StatusCode::INTERNAL_SERVER_ERROR, "Internal server error"))?;

        Ok(UserPermissions(permissions))
    }
}
