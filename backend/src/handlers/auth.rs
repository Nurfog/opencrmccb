use axum::Json;
use axum::body::Body;
use axum::extract::{Path, State};
use axum::http::{StatusCode, header::SET_COOKIE};
use axum::response::Response;
use bcrypt::{DEFAULT_COST, hash, verify};
use jsonwebtoken::{DecodingKey, EncodingKey, Header, Validation, decode, encode};
use sha2::{Digest, Sha256};
use uuid::Uuid;
use validator::Validate;

use crate::AppState;
use crate::error::AppError;
use crate::middleware::auth::{
    access_token_cookie, clear_auth_cookies, csrf_cookie, generate_csrf_token, refresh_token_cookie,
};
use crate::models::{
    AuthResponse, ChangePassword, CreateUser, LoginRequest, RefreshToken, RefreshTokenRequest,
    UpdateProfile, User, UserResponse, UserSafe,
};

// ─── Token Helpers ────────────────────────────────────────────────

fn hash_token(token: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(token.as_bytes());
    format!("{:x}", hasher.finalize())
}

pub fn create_access_token(
    user_id: &Uuid,
    email: &str,
    role: &str,
    secret: &str,
    expiry_minutes: i64,
) -> Result<String, jsonwebtoken::errors::Error> {
    let claims = serde_json::json!({
        "sub": user_id.to_string(),
        "email": email,
        "role": role,
        "exp": (chrono::Utc::now() + chrono::Duration::minutes(expiry_minutes)).timestamp(),
    });
    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
}

pub fn create_refresh_token_string(
    user_id: &Uuid,
    secret: &str,
    expiry_days: i64,
) -> Result<String, jsonwebtoken::errors::Error> {
    let claims = serde_json::json!({
        "sub": user_id.to_string(),
        "type": "refresh",
        "exp": (chrono::Utc::now() + chrono::Duration::days(expiry_days)).timestamp(),
    });
    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
}

pub async fn store_refresh_token(
    state: &AppState,
    user_id: Uuid,
    token: &str,
) -> Result<RefreshToken, sqlx::Error> {
    let token_hash = hash_token(token);
    let expires_at =
        chrono::Utc::now() + chrono::Duration::days(state.auth.refresh_token_expiry_days);

    sqlx::query_as::<_, RefreshToken>(
        r#"
        INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
        VALUES ($1, $2, $3)
        RETURNING id, user_id, token_hash, expires_at, revoked, created_at
        "#,
    )
    .bind(user_id)
    .bind(&token_hash)
    .bind(expires_at)
    .fetch_one(&state.db)
    .await
}

async fn fetch_user_role(state: &AppState, user_id: Uuid) -> String {
    sqlx::query_scalar::<_, Option<String>>(
        "SELECT p.name FROM profiles p JOIN users u ON u.profile_id = p.id WHERE u.id = $1",
    )
    .bind(user_id)
    .fetch_optional(&state.db)
    .await
    .ok()
    .flatten()
    .flatten()
    .unwrap_or_default()
}

// ─── Auth Handlers ────────────────────────────────────────────────

pub async fn register(
    State(state): State<AppState>,
    Json(input): Json<CreateUser>,
) -> Result<Response, AppError> {
    input.validate()?;

    let mut tx = state
        .db
        .begin()
        .await
        .map_err(|_| AppError::Internal("Database error".into()))?;

    // Atomically check if any users exist inside a transaction
    let existing: Option<(Uuid,)> = sqlx::query_as("SELECT id FROM users LIMIT 1")
        .fetch_optional(&mut *tx)
        .await?;

    if existing.is_some() {
        tx.rollback()
            .await
            .map_err(|_| AppError::Internal("Database error".into()))?;
        return Err(AppError::Forbidden);
    }

    // First user gets the Administrador profile
    let admin_profile_id: Option<Uuid> =
        sqlx::query_scalar("SELECT id FROM profiles WHERE name = 'Administrador' LIMIT 1")
            .fetch_optional(&mut *tx)
            .await?;

    let password_hash =
        hash(&input.password, DEFAULT_COST).map_err(|e| AppError::Internal(e.to_string()))?;

    let user = sqlx::query_as::<_, User>(
        r#"
        INSERT INTO users (email, password_hash, first_name, last_name, profile_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, email, password_hash, first_name, last_name, profile_id, created_at, updated_at
        "#,
    )
    .bind(&input.email)
    .bind(&password_hash)
    .bind(&input.first_name)
    .bind(&input.last_name)
    .bind(admin_profile_id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| {
        if let Some(db_err) = e.as_database_error()
            && db_err.code().as_deref() == Some("23505") {
            return AppError::Conflict("Email already exists".into());
        }
        AppError::Internal(e.to_string())
    })?;

    tx.commit()
        .await
        .map_err(|_| AppError::Internal("Database error".into()))?;

    let role = fetch_user_role(&state, user.id).await;

    let access_token = create_access_token(
        &user.id,
        &user.email,
        &role,
        &state.auth.jwt_secret,
        state.auth.access_token_expiry_minutes,
    )?;
    let refresh_token_str = create_refresh_token_string(
        &user.id,
        &state.auth.refresh_token_secret,
        state.auth.refresh_token_expiry_days,
    )?;

    store_refresh_token(&state, user.id, &refresh_token_str).await?;

    let csrf = generate_csrf_token();
    let access_max = state.auth.access_token_expiry_minutes * 60;
    let refresh_max = state.auth.refresh_token_expiry_days * 86400;

    // Fetch user permissions
    let permissions: Vec<String> = sqlx::query_scalar(
        "SELECT pp.permission FROM profile_permissions pp \
         JOIN users u ON u.profile_id = pp.profile_id \
         WHERE u.id = $1",
    )
    .bind(user.id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let body = serde_json::to_string(&AuthResponse {
        access_token: access_token.clone(),
        refresh_token: refresh_token_str.clone(),
        expires_in: access_max,
        user: UserResponse {
            id: user.id,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            profile_id: None,
            permissions,
        },
    })
    .map_err(|e| AppError::Internal(e.to_string()))?;

    let response = Response::builder()
        .status(StatusCode::CREATED)
        .header("content-type", "application/json")
        .header(SET_COOKIE, access_token_cookie(&access_token, access_max))
        .header(
            SET_COOKIE,
            refresh_token_cookie(&refresh_token_str, refresh_max),
        )
        .header(SET_COOKIE, csrf_cookie(&csrf, access_max))
        .body(Body::from(body))
        .map_err(|e| AppError::Internal(e.to_string()))?;

    Ok(response)
}

pub async fn login(
    State(state): State<AppState>,
    Json(input): Json<LoginRequest>,
) -> Result<Response, AppError> {
    input.validate()?;

    let user = sqlx::query_as::<_, User>(
        "SELECT id, email, password_hash, first_name, last_name, profile_id, created_at, updated_at FROM users WHERE email = $1"
    )
    .bind(&input.email)
    .fetch_optional(&state.db)
    .await?;

    let user = match user {
        Some(u) => u,
        None => {
            tracing::warn!("Failed login attempt for non-existent email");
            return Err(AppError::Unauthorized);
        }
    };

    let valid = verify(&input.password, &user.password_hash).map_err(|_| AppError::Unauthorized)?;

    if !valid {
        tracing::warn!("Failed login attempt (invalid password)");
        return Err(AppError::Unauthorized);
    }

    tracing::info!("Successful login");

    let role = fetch_user_role(&state, user.id).await;

    let access_token = create_access_token(
        &user.id,
        &user.email,
        &role,
        &state.auth.jwt_secret,
        state.auth.access_token_expiry_minutes,
    )?;
    let refresh_token_str = create_refresh_token_string(
        &user.id,
        &state.auth.refresh_token_secret,
        state.auth.refresh_token_expiry_days,
    )?;

    store_refresh_token(&state, user.id, &refresh_token_str).await?;

    let csrf = generate_csrf_token();
    let access_max = state.auth.access_token_expiry_minutes * 60;
    let refresh_max = state.auth.refresh_token_expiry_days * 86400;

    // Fetch user permissions
    let permissions: Vec<String> = sqlx::query_scalar(
        "SELECT pp.permission FROM profile_permissions pp \
         JOIN users u ON u.profile_id = pp.profile_id \
         WHERE u.id = $1",
    )
    .bind(user.id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let body = serde_json::to_string(&AuthResponse {
        access_token: access_token.clone(),
        refresh_token: refresh_token_str.clone(),
        expires_in: access_max,
        user: UserResponse {
            id: user.id,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            profile_id: user.profile_id,
            permissions,
        },
    })
    .map_err(|e| AppError::Internal(e.to_string()))?;

    let response = Response::builder()
        .header("content-type", "application/json")
        .header(SET_COOKIE, access_token_cookie(&access_token, access_max))
        .header(
            SET_COOKIE,
            refresh_token_cookie(&refresh_token_str, refresh_max),
        )
        .header(SET_COOKIE, csrf_cookie(&csrf, access_max))
        .body(Body::from(body))
        .map_err(|e| AppError::Internal(e.to_string()))?;

    Ok(response)
}

pub async fn refresh_token(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    Json(input): Json<RefreshTokenRequest>,
) -> Result<Response, AppError> {
    // Try cookie first, then body
    let refresh_token_str = headers
        .get("cookie")
        .and_then(|h| h.to_str().ok())
        .and_then(|cookie_str| {
            cookie_str.split(';').find_map(|c| {
                let c = c.trim();
                c.strip_prefix("refresh_token=").map(|v| v.to_string())
            })
        })
        .or_else(|| {
            if input.refresh_token.is_empty() {
                None
            } else {
                Some(input.refresh_token.clone())
            }
        })
        .ok_or(AppError::Unauthorized)?;

    let token_data = decode::<serde_json::Value>(
        &refresh_token_str,
        &DecodingKey::from_secret(state.auth.refresh_token_secret.as_bytes()),
        &Validation::default(),
    )?;

    let user_id = token_data.claims["sub"]
        .as_str()
        .and_then(|s| Uuid::parse_str(s).ok())
        .ok_or(AppError::Unauthorized)?;

    let token_hash = hash_token(&refresh_token_str);

    let stored_token = sqlx::query_as::<_, RefreshToken>(
        "SELECT id, user_id, token_hash, expires_at, revoked, created_at FROM refresh_tokens WHERE token_hash = $1 AND user_id = $2"
    )
    .bind(&token_hash)
    .bind(user_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::Unauthorized)?;

    if stored_token.revoked {
        tracing::warn!(
            "Attempted use of revoked refresh token for user: {}",
            user_id
        );
        sqlx::query("UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1")
            .bind(user_id)
            .execute(&state.db)
            .await
            .map_err(|_| AppError::Internal("Database error".into()))?;
        return Err(AppError::Unauthorized);
    }

    if stored_token.expires_at < chrono::Utc::now() {
        return Err(AppError::Unauthorized);
    }

    let user = sqlx::query_as::<_, UserSafe>(
        "SELECT id, email, first_name, last_name, profile_id, created_at, updated_at FROM users WHERE id = $1"
    )
    .bind(user_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::Unauthorized)?;

    let mut tx = state
        .db
        .begin()
        .await
        .map_err(|_| AppError::Internal("Database error".into()))?;

    sqlx::query("UPDATE refresh_tokens SET revoked = TRUE WHERE token_hash = $1")
        .bind(&token_hash)
        .execute(&mut *tx)
        .await
        .map_err(|_| AppError::Internal("Database error".into()))?;

    let new_refresh_token = create_refresh_token_string(
        &user.id,
        &state.auth.refresh_token_secret,
        state.auth.refresh_token_expiry_days,
    )?;

    let new_refresh_token_hash = hash_token(&new_refresh_token);
    let new_refresh_token_expires_at =
        chrono::Utc::now() + chrono::Duration::days(state.auth.refresh_token_expiry_days);

    sqlx::query("INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)")
        .bind(user.id)
        .bind(&new_refresh_token_hash)
        .bind(new_refresh_token_expires_at)
        .execute(&mut *tx)
        .await
        .map_err(|_| AppError::Internal("Database error".into()))?;

    tx.commit()
        .await
        .map_err(|_| AppError::Internal("Database error".into()))?;

    let role = fetch_user_role(&state, user.id).await;

    let new_access_token = create_access_token(
        &user.id,
        &user.email,
        &role,
        &state.auth.jwt_secret,
        state.auth.access_token_expiry_minutes,
    )?;

    let csrf = generate_csrf_token();
    let access_max = state.auth.access_token_expiry_minutes * 60;
    let refresh_max = state.auth.refresh_token_expiry_days * 86400;

    // Fetch user permissions
    let permissions: Vec<String> = sqlx::query_scalar(
        "SELECT pp.permission FROM profile_permissions pp \
         JOIN users u ON u.profile_id = pp.profile_id \
         WHERE u.id = $1",
    )
    .bind(user.id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let body = serde_json::to_string(&AuthResponse {
        access_token: new_access_token.clone(),
        refresh_token: new_refresh_token.clone(),
        expires_in: access_max,
        user: UserResponse {
            id: user.id,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            profile_id: user.profile_id,
            permissions,
        },
    })
    .map_err(|e| AppError::Internal(e.to_string()))?;

    let response = Response::builder()
        .header("content-type", "application/json")
        .header(
            SET_COOKIE,
            access_token_cookie(&new_access_token, access_max),
        )
        .header(
            SET_COOKIE,
            refresh_token_cookie(&new_refresh_token, refresh_max),
        )
        .header(SET_COOKIE, csrf_cookie(&csrf, access_max))
        .body(Body::from(body))
        .map_err(|e| AppError::Internal(e.to_string()))?;

    Ok(response)
}

// ─── Profile Handlers ─────────────────────────────────────────────

pub async fn get_profile(
    State(state): State<AppState>,
    claims: axum::extract::Extension<crate::middleware::auth::Claims>,
) -> Result<Json<UserResponse>, AppError> {
    let user_id = Uuid::parse_str(&claims.sub)?;

    let user = sqlx::query_as::<_, UserSafe>(
        "SELECT id, email, first_name, last_name, profile_id, created_at, updated_at FROM users WHERE id = $1"
    )
    .bind(user_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    let permissions: Vec<String> = sqlx::query_scalar(
        "SELECT pp.permission FROM profile_permissions pp \
         JOIN users u ON u.profile_id = pp.profile_id \
         WHERE u.id = $1",
    )
    .bind(user_id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    Ok(Json(UserResponse {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        profile_id: user.profile_id,
        permissions,
    }))
}

pub async fn update_profile(
    State(state): State<AppState>,
    claims: axum::extract::Extension<crate::middleware::auth::Claims>,
    Json(input): Json<UpdateProfile>,
) -> Result<Json<UserResponse>, AppError> {
    input.validate()?;

    let user_id = Uuid::parse_str(&claims.sub)?;

    let user = sqlx::query_as::<_, UserSafe>(
        r#"
        UPDATE users
        SET email = COALESCE($2, email),
            first_name = COALESCE($3, first_name),
            last_name = COALESCE($4, last_name),
            updated_at = NOW()
        WHERE id = $1
        RETURNING id, email, first_name, last_name, profile_id, created_at, updated_at
        "#,
    )
    .bind(user_id)
    .bind(&input.email)
    .bind(&input.first_name)
    .bind(&input.last_name)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        if let Some(db_err) = e.as_database_error()
            && db_err.code().as_deref() == Some("23505")
        {
            return AppError::Conflict("Email already exists".into());
        }
        AppError::Internal(e.to_string())
    })?
    .ok_or(AppError::NotFound)?;

    let permissions: Vec<String> = sqlx::query_scalar(
        "SELECT pp.permission FROM profile_permissions pp \
         JOIN users u ON u.profile_id = pp.profile_id \
         WHERE u.id = $1",
    )
    .bind(user_id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    Ok(Json(UserResponse {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        profile_id: user.profile_id,
        permissions,
    }))
}

pub async fn change_password(
    State(state): State<AppState>,
    claims: axum::extract::Extension<crate::middleware::auth::Claims>,
    Json(input): Json<ChangePassword>,
) -> Result<StatusCode, AppError> {
    input.validate()?;

    let user_id = Uuid::parse_str(&claims.sub)?;

    let user = sqlx::query_as::<_, User>(
        "SELECT id, email, password_hash, first_name, last_name, profile_id, created_at, updated_at FROM users WHERE id = $1"
    )
    .bind(user_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    let valid =
        verify(&input.current_password, &user.password_hash).map_err(|_| AppError::Unauthorized)?;

    if !valid {
        return Err(AppError::Unauthorized);
    }

    let new_hash =
        hash(&input.new_password, DEFAULT_COST).map_err(|e| AppError::Internal(e.to_string()))?;

    sqlx::query("UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1")
        .bind(user_id)
        .bind(&new_hash)
        .execute(&state.db)
        .await?;

    sqlx::query("UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1 AND revoked = FALSE")
        .bind(user_id)
        .execute(&state.db)
        .await?;

    Ok(StatusCode::OK)
}

pub async fn logout(
    claims: axum::extract::Extension<crate::middleware::auth::Claims>,
    State(state): State<AppState>,
) -> Result<Response, AppError> {
    let user_id = Uuid::parse_str(&claims.sub)?;

    sqlx::query("UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1 AND revoked = FALSE")
        .bind(user_id)
        .execute(&state.db)
        .await?;

    let mut builder = Response::builder().status(StatusCode::OK);
    for cookie in clear_auth_cookies() {
        builder = builder.header(SET_COOKIE, cookie);
    }
    let response = builder
        .body(Body::from(""))
        .map_err(|e| AppError::Internal(e.to_string()))?;
    Ok(response)
}

pub async fn create_user(
    State(state): State<AppState>,
    Json(input): Json<CreateUser>,
) -> Result<(StatusCode, Json<UserResponse>), AppError> {
    input.validate()?;

    let password_hash =
        hash(&input.password, DEFAULT_COST).map_err(|e| AppError::Internal(e.to_string()))?;

    // Default new users to Vendedor profile
    let default_profile_id: Option<Uuid> =
        sqlx::query_scalar("SELECT id FROM profiles WHERE name = 'Vendedor' LIMIT 1")
            .fetch_optional(&state.db)
            .await?;

    let user = sqlx::query_as::<_, UserSafe>(
        r#"
        INSERT INTO users (email, password_hash, first_name, last_name, profile_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, email, first_name, last_name, profile_id, created_at, updated_at
        "#,
    )
    .bind(&input.email)
    .bind(&password_hash)
    .bind(&input.first_name)
    .bind(&input.last_name)
    .bind(default_profile_id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        if let Some(db_err) = e.as_database_error()
            && db_err.code().as_deref() == Some("23505")
        {
            return AppError::Conflict("Email already exists".into());
        }
        AppError::Internal(e.to_string())
    })?;

    let permissions: Vec<String> = sqlx::query_scalar(
        "SELECT pp.permission FROM profile_permissions pp \
         JOIN users u ON u.profile_id = pp.profile_id \
         WHERE u.id = $1",
    )
    .bind(user.id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    Ok((
        StatusCode::CREATED,
        Json(UserResponse {
            id: user.id,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            profile_id: user.profile_id,
            permissions,
        }),
    ))
}

// ─── Admin Handlers ───────────────────────────────────────────────

#[derive(sqlx::FromRow)]
#[allow(dead_code)]
struct UserWithPermissionsRow {
    pub id: Uuid,
    pub email: String,
    pub first_name: String,
    pub last_name: String,
    pub profile_id: Option<Uuid>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub permissions: Vec<String>,
}

pub async fn list_users(
    State(state): State<AppState>,
) -> Result<Json<Vec<UserResponse>>, AppError> {
    let rows = sqlx::query_as::<_, UserWithPermissionsRow>(
        r#"
        SELECT u.id, u.email, u.first_name, u.last_name, u.profile_id, u.created_at, u.updated_at,
               COALESCE(array_agg(pp.permission) FILTER (WHERE pp.permission IS NOT NULL), ARRAY[]::text[]) AS permissions
        FROM users u
        LEFT JOIN profile_permissions pp ON pp.profile_id = u.profile_id
        GROUP BY u.id
        ORDER BY u.created_at DESC
        "#,
    )
    .fetch_all(&state.db)
    .await?;

    let result = rows
        .into_iter()
        .map(|r| UserResponse {
            id: r.id,
            email: r.email,
            first_name: r.first_name,
            last_name: r.last_name,
            profile_id: r.profile_id,
            permissions: r.permissions,
        })
        .collect();

    Ok(Json(result))
}

pub async fn delete_user(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    claims: axum::extract::Extension<crate::middleware::auth::Claims>,
) -> Result<StatusCode, AppError> {
    let current_user_id = Uuid::parse_str(&claims.sub)?;

    if id == current_user_id {
        return Err(AppError::BadRequest("Cannot delete yourself".into()));
    }

    let result = sqlx::query("DELETE FROM users WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(StatusCode::NO_CONTENT)
}

pub async fn update_user_profile(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(input): Json<serde_json::Value>,
) -> Result<Json<UserResponse>, AppError> {
    let profile_id_str = input["profile_id"]
        .as_str()
        .ok_or_else(|| AppError::BadRequest("profile_id is required".into()))?;

    let profile_id = Uuid::parse_str(profile_id_str)
        .map_err(|_| AppError::BadRequest("Invalid profile_id".into()))?;

    // Verify profile exists
    let profile_exists: bool =
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM profiles WHERE id = $1)")
            .bind(profile_id)
            .fetch_one(&state.db)
            .await?;

    if !profile_exists {
        return Err(AppError::BadRequest("Profile not found".into()));
    }

    let user = sqlx::query_as::<_, UserSafe>(
        "UPDATE users SET profile_id = $2, updated_at = NOW() WHERE id = $1 RETURNING id, email, first_name, last_name, profile_id, created_at, updated_at"
    )
    .bind(id)
    .bind(profile_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    let permissions: Vec<String> = sqlx::query_scalar(
        "SELECT pp.permission FROM profile_permissions pp \
         JOIN users u ON u.profile_id = pp.profile_id \
         WHERE u.id = $1",
    )
    .bind(id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    Ok(Json(UserResponse {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        profile_id: user.profile_id,
        permissions,
    }))
}

// ─── Password Reset ──────────────────────────────────────────────

#[derive(Debug, serde::Deserialize)]
pub struct ForgotPasswordRequest {
    pub email: String,
}

#[derive(Debug, serde::Deserialize)]
pub struct ResetPasswordRequest {
    pub token: String,
    pub password: String,
}

pub async fn forgot_password(
    State(state): State<AppState>,
    Json(input): Json<ForgotPasswordRequest>,
) -> Result<StatusCode, AppError> {
    let user = sqlx::query_as::<_, UserSafe>(
        "SELECT id, email, first_name, last_name, profile_id, created_at, updated_at FROM users WHERE email = $1"
    )
    .bind(&input.email)
    .fetch_optional(&state.db)
    .await?;

    // Always return OK to prevent email enumeration
    if user.is_none() {
        return Ok(StatusCode::OK);
    }

    let user = user.unwrap();
    let token = format!("{}", Uuid::new_v4());
    let token_hash = hash_token(&token);
    let expires_at = chrono::Utc::now() + chrono::Duration::hours(1);

    sqlx::query(
        "INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)",
    )
    .bind(user.id)
    .bind(&token_hash)
    .bind(expires_at)
    .execute(&state.db)
    .await?;

    // Send reset email
    if state.smtp.enabled {
        let reset_url = format!("{}/reset-password?token={}", state.frontend_url, token);
        let _ = crate::services::email::send_email(
            &state.smtp.host,
            state.smtp.port,
            &state.smtp.user,
            &state.smtp.password,
            &state.smtp.from,
            &user.email,
            "Password Reset Request",
            &format!(
                "Hello {},\n\nYou requested a password reset. Click the link below to reset your password:\n\n{}\n\nThis link expires in 1 hour.\n\nIf you didn't request this, ignore this email.",
                user.first_name, reset_url
            ),
        ).await;
    }

    Ok(StatusCode::OK)
}

pub async fn reset_password(
    State(state): State<AppState>,
    Json(input): Json<ResetPasswordRequest>,
) -> Result<StatusCode, AppError> {
    let token_hash = hash_token(&input.token);

    let reset_token: Option<ResetTokenRow> = sqlx::query_as(
        "SELECT id, user_id, token_hash, expires_at, used FROM password_reset_tokens WHERE token_hash = $1"
    )
    .bind(&token_hash)
    .fetch_optional(&state.db)
    .await?;

    let reset_token = match reset_token {
        Some(t) => t,
        None => return Err(AppError::BadRequest("Invalid or expired token".into())),
    };

    if reset_token.used {
        return Err(AppError::BadRequest("Token already used".into()));
    }

    if reset_token.expires_at < chrono::Utc::now() {
        return Err(AppError::BadRequest("Token expired".into()));
    }

    let new_hash =
        hash(&input.password, DEFAULT_COST).map_err(|e| AppError::Internal(e.to_string()))?;

    let mut tx = state
        .db
        .begin()
        .await
        .map_err(|_| AppError::Internal("Database error".into()))?;

    sqlx::query("UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1")
        .bind(reset_token.user_id)
        .bind(&new_hash)
        .execute(&mut *tx)
        .await
        .map_err(|_| AppError::Internal("Database error".into()))?;

    sqlx::query("UPDATE password_reset_tokens SET used = TRUE WHERE token_hash = $1")
        .bind(&token_hash)
        .execute(&mut *tx)
        .await
        .map_err(|_| AppError::Internal("Database error".into()))?;

    sqlx::query("UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1 AND revoked = FALSE")
        .bind(reset_token.user_id)
        .execute(&mut *tx)
        .await
        .map_err(|_| AppError::Internal("Database error".into()))?;

    tx.commit()
        .await
        .map_err(|_| AppError::Internal("Database error".into()))?;

    Ok(StatusCode::OK)
}

#[derive(sqlx::FromRow)]
pub struct ResetTokenRow {
    pub id: Uuid,
    pub user_id: Uuid,
    pub token_hash: String,
    pub expires_at: chrono::DateTime<chrono::Utc>,
    pub used: bool,
}
