use axum::body::Body;
use axum::http::{Request, StatusCode};
use sqlx::postgres::PgPoolOptions;
use tower::ServiceExt;

// Helper to create test app state
async fn setup_test_db() -> sqlx::PgPool {
    let database_url = std::env::var("TEST_DATABASE_URL")
        .unwrap_or_else(|_| "postgres://crm_user:password@localhost:5432/crm_db_test".into());

    PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
        .expect("Failed to connect to test database")
}

async fn run_migrations(pool: &sqlx::PgPool) {
    sqlx::migrate!("../database/migrations")
        .run(pool)
        .await
        .expect("Failed to run migrations");
}

#[tokio::test]
async fn test_health_check() {
    let pool = setup_test_db().await;
    run_migrations(&pool).await;

    let state = crm_backend::AppState {
        db: pool,
        auth: crm_backend::AuthConfig {
            jwt_secret: "test-secret-test-secret-test-secret".into(),
            refresh_token_secret: "test-refresh-test-refresh-test-refresh".into(),
            token_encryption_key: None,
            access_token_expiry_minutes: 15,
            refresh_token_expiry_days: 30,
        },
        smtp: crm_backend::SmtpConfig {
            host: "localhost".into(),
            port: 587,
            user: String::new(),
            password: String::new(),
            from: "test@test.com".into(),
            enabled: false,
        },
        upload: crm_backend::UploadConfig {
            dir: "./test-uploads".into(),
            max_file_size_mb: 10,
        },
        frontend_url: "http://localhost:3000".into(),
        oauth: crm_backend::OAuthConfig {
            google: None,
            microsoft: None,
            github: None,
            state_store: std::sync::Arc::new(tokio::sync::RwLock::new(
                std::collections::HashMap::new(),
            )),
        },
    };

    let app = crm_backend::routes::public_routes().with_state(state);

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/v1/health")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn test_register_first_user() {
    let pool = setup_test_db().await;
    run_migrations(&pool).await;

    // Clean users table
    sqlx::query("DELETE FROM users")
        .execute(&pool)
        .await
        .unwrap();

    let state = crm_backend::AppState {
        db: pool,
        auth: crm_backend::AuthConfig {
            jwt_secret: "test-secret-test-secret-test-secret".into(),
            refresh_token_secret: "test-refresh-test-refresh-test-refresh".into(),
            token_encryption_key: None,
            access_token_expiry_minutes: 15,
            refresh_token_expiry_days: 30,
        },
        smtp: crm_backend::SmtpConfig {
            host: "localhost".into(),
            port: 587,
            user: String::new(),
            password: String::new(),
            from: "test@test.com".into(),
            enabled: false,
        },
        upload: crm_backend::UploadConfig {
            dir: "./test-uploads".into(),
            max_file_size_mb: 10,
        },
        frontend_url: "http://localhost:3000".into(),
        oauth: crm_backend::OAuthConfig {
            google: None,
            microsoft: None,
            github: None,
            state_store: std::sync::Arc::new(tokio::sync::RwLock::new(
                std::collections::HashMap::new(),
            )),
        },
    };

    let app = crm_backend::routes::register_routes().with_state(state);

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/auth/register")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::json!({
                        "email": "admin@test.com",
                        "password": "secure123",
                        "first_name": "Admin",
                        "last_name": "User"
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::CREATED);
}

#[tokio::test]
async fn test_register_second_user_forbidden() {
    let pool = setup_test_db().await;
    run_migrations(&pool).await;

    // Ensure there's already a user
    let existing = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM users")
        .fetch_one(&pool)
        .await
        .unwrap();

    if existing == 0 {
        // Create first user
        sqlx::query("INSERT INTO users (email, password_hash, first_name, last_name, role) VALUES ($1, $2, $3, $4, $5)")
            .bind("existing@test.com")
            .bind("$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ12")
            .bind("Existing")
            .bind("User")
            .bind("admin")
            .execute(&pool)
            .await
            .unwrap();
    }

    let state = crm_backend::AppState {
        db: pool,
        auth: crm_backend::AuthConfig {
            jwt_secret: "test-secret-test-secret-test-secret".into(),
            refresh_token_secret: "test-refresh-test-refresh-test-refresh".into(),
            token_encryption_key: None,
            access_token_expiry_minutes: 15,
            refresh_token_expiry_days: 30,
        },
        smtp: crm_backend::SmtpConfig {
            host: "localhost".into(),
            port: 587,
            user: String::new(),
            password: String::new(),
            from: "test@test.com".into(),
            enabled: false,
        },
        upload: crm_backend::UploadConfig {
            dir: "./test-uploads".into(),
            max_file_size_mb: 10,
        },
        frontend_url: "http://localhost:3000".into(),
        oauth: crm_backend::OAuthConfig {
            google: None,
            microsoft: None,
            github: None,
            state_store: std::sync::Arc::new(tokio::sync::RwLock::new(
                std::collections::HashMap::new(),
            )),
        },
    };

    let app = crm_backend::routes::register_routes().with_state(state);

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/auth/register")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::json!({
                        "email": "new@test.com",
                        "password": "secure123",
                        "first_name": "New",
                        "last_name": "User"
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::FORBIDDEN);
}
