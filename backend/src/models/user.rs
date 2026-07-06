use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct User {
    pub id: Uuid,
    pub email: String,
    pub password_hash: String,
    pub first_name: String,
    pub last_name: String,
    pub profile_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Safe user struct without password_hash — use in queries that don't need it
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct UserSafe {
    pub id: Uuid,
    pub email: String,
    pub first_name: String,
    pub last_name: String,
    pub profile_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct RefreshToken {
    pub id: Uuid,
    pub user_id: Uuid,
    pub token_hash: String,
    pub expires_at: DateTime<Utc>,
    pub revoked: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateUser {
    #[validate(email(message = "Email must be valid"))]
    pub email: String,

    #[validate(length(min = 6, message = "Password must be at least 6 characters"))]
    pub password: String,

    #[validate(length(min = 1, max = 50, message = "First name must be 1-50 characters"))]
    pub first_name: String,

    #[validate(length(min = 1, max = 50, message = "Last name must be 1-50 characters"))]
    pub last_name: String,
}

#[derive(Debug, Deserialize, Validate)]
pub struct LoginRequest {
    #[validate(email(message = "Email must be valid"))]
    pub email: String,

    #[validate(length(min = 1, message = "Password is required"))]
    pub password: String,
}

#[derive(Debug, Deserialize, Validate)]
pub struct RefreshTokenRequest {
    #[validate(length(min = 1, message = "Refresh token is required"))]
    pub refresh_token: String,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateProfile {
    #[validate(email(message = "Email must be valid"))]
    pub email: Option<String>,

    #[validate(length(min = 1, max = 50, message = "First name must be 1-50 characters"))]
    pub first_name: Option<String>,

    #[validate(length(min = 1, max = 50, message = "Last name must be 1-50 characters"))]
    pub last_name: Option<String>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct ChangePassword {
    #[validate(length(min = 1, message = "Current password is required"))]
    pub current_password: String,

    #[validate(length(min = 6, message = "New password must be at least 6 characters"))]
    pub new_password: String,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_in: i64,
    pub user: UserResponse,
}

#[derive(Debug, Serialize)]
pub struct UserResponse {
    pub id: Uuid,
    pub email: String,
    pub first_name: String,
    pub last_name: String,
    pub profile_id: Option<Uuid>,
    pub permissions: Vec<String>,
}
