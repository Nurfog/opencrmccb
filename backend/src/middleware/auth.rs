use axum::{
    extract::{FromRequestParts, Request, State},
    http::{StatusCode, request::Parts},
    middleware::Next,
    response::Response,
};
use jsonwebtoken::{Algorithm, DecodingKey, Validation, decode};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::AppState;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub email: String,
    #[serde(default)]
    pub role: String,
    pub exp: usize,
}

// ─── Cookie Helpers ──────────────────────────────────────────────

pub fn access_token_cookie(value: &str, max_age_secs: i64) -> String {
    format!("access_token={value}; Path=/; HttpOnly; SameSite=Strict; Max-Age={max_age_secs}")
}

pub fn refresh_token_cookie(value: &str, max_age_secs: i64) -> String {
    format!(
        "refresh_token={value}; Path=/api/v1/auth/refresh; HttpOnly; SameSite=Strict; Max-Age={max_age_secs}"
    )
}

pub fn csrf_cookie(value: &str, max_age_secs: i64) -> String {
    format!("csrf_token={value}; Path=/; SameSite=Strict; Max-Age={max_age_secs}")
}

pub fn clear_auth_cookies() -> Vec<String> {
    vec![
        "access_token=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0".to_string(),
        "refresh_token=; Path=/api/v1/auth/refresh; HttpOnly; SameSite=Strict; Max-Age=0"
            .to_string(),
        "csrf_token=; Path=/; SameSite=Strict; Max-Age=0".to_string(),
    ]
}

pub fn generate_csrf_token() -> String {
    Uuid::new_v4().to_string()
}

// ─── Auth Middleware ──────────────────────────────────────────────

pub async fn auth_middleware(
    State(state): State<AppState>,
    mut request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
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
        None => return Err(StatusCode::UNAUTHORIZED),
    };

    let token_data = decode::<Claims>(
        &token,
        &DecodingKey::from_secret(state.auth.jwt_secret.as_bytes()),
        &Validation::new(Algorithm::HS256),
    )
    .map_err(|_| StatusCode::UNAUTHORIZED)?;

    // Load permissions once and attach to request extensions
    let user_id = Uuid::parse_str(&token_data.claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;

    let permissions: Vec<String> = sqlx::query_scalar(
        "SELECT pp.permission FROM profile_permissions pp \
         JOIN users u ON u.profile_id = pp.profile_id \
         WHERE u.id = $1",
    )
    .bind(user_id)
    .fetch_all(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    request.extensions_mut().insert(token_data.claims);
    request
        .extensions_mut()
        .insert(UserPermissions(permissions));

    Ok(next.run(request).await)
}

// ─── CSRF Middleware ──────────────────────────────────────────────

pub async fn csrf_middleware(request: Request, next: Next) -> Result<Response, StatusCode> {
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
        || path.starts_with("/api/v1/integrations/") && path.ends_with("/callback")
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
        (Some(header), Some(cookie)) if header == cookie => Ok(next.run(request).await),
        _ => Err(StatusCode::FORBIDDEN),
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
    type Rejection = StatusCode;

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
            .ok_or(StatusCode::UNAUTHORIZED)?;

        let user_id = Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;

        let permissions: Vec<String> = sqlx::query_scalar(
            "SELECT pp.permission FROM profile_permissions pp \
             JOIN users u ON u.profile_id = pp.profile_id \
             WHERE u.id = $1",
        )
        .bind(user_id)
        .fetch_all(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        Ok(UserPermissions(permissions))
    }
}
