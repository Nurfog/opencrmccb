#![allow(clippy::unnecessary_cast, clippy::let_and_return)]

pub mod config;
pub mod db;
pub mod envelope;
pub mod error;
pub mod handlers;
pub mod middleware;
pub mod models;
pub mod routes;
pub mod services;

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

pub type OAuthStateStore = Arc<RwLock<HashMap<String, OAuthPendingState>>>;

#[derive(Clone)]
pub struct OAuthPendingState {
    pub provider: String,
    pub user_id: Uuid,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Clone)]
pub struct AuthConfig {
    pub jwt_secret: String,
    pub refresh_token_secret: String,
    pub token_encryption_key: Option<Vec<u8>>,
    pub access_token_expiry_minutes: i64,
    pub refresh_token_expiry_days: i64,
}

#[derive(Clone)]
pub struct SmtpConfig {
    pub host: String,
    pub port: u16,
    pub user: String,
    pub password: String,
    pub from: String,
    pub enabled: bool,
}

#[derive(Clone)]
pub struct UploadConfig {
    pub dir: String,
    pub max_file_size_mb: u64,
}

#[derive(Clone)]
pub struct OAuthConfig {
    pub google: Option<config::OAuthProviderConfig>,
    pub microsoft: Option<config::OAuthProviderConfig>,
    pub github: Option<config::OAuthProviderConfig>,
    pub state_store: OAuthStateStore,
}

#[derive(Clone)]
pub struct AppState {
    pub db: sqlx::PgPool,
    pub auth: AuthConfig,
    pub smtp: SmtpConfig,
    pub upload: UploadConfig,
    pub frontend_url: String,
    pub oauth: OAuthConfig,
}
