use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use crm_backend::config;
use crm_backend::db;
use crm_backend::middleware::metrics::{Metrics, track_metrics};
use crm_backend::middleware::rate_limit::RateLimiter;
use crm_backend::repositories::contact_repo::PgContactRepo;
use crm_backend::repositories::deal_repo::PgDealRepo;
use crm_backend::routes;
use crm_backend::{AppState, AuthConfig, OAuthConfig, SmtpConfig, UploadConfig};

#[tokio::main]
async fn main() {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "crm_backend=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config = config::Config::from_env();
    let cors_origins = config.parse_cors_origins();
    let pool = db::create_pool(&config.database.url).await;
    tokio::spawn(crm_backend::services::webhook_worker::start_worker(
        pool.clone(),
    ));

    let contact_repo = PgContactRepo::new(pool.clone());
    let deal_repo = PgDealRepo::new(pool.clone());

    let state = AppState {
        db: pool,
        auth: AuthConfig {
            jwt_secret: config.auth.jwt_secret.clone(),
            refresh_token_secret: config.auth.refresh_token_secret.clone(),
            token_encryption_key: config.auth.token_encryption_key.clone(),
            access_token_expiry_minutes: config.auth.access_token_expiry_minutes,
            refresh_token_expiry_days: config.auth.refresh_token_expiry_days,
        },
        smtp: SmtpConfig {
            host: config.smtp.host.clone(),
            port: config.smtp.port,
            user: config.smtp.user.clone(),
            password: config.smtp.password.clone(),
            from: config.smtp.from.clone(),
            enabled: config.smtp.enabled,
        },
        upload: UploadConfig {
            dir: config.upload.dir.clone(),
            max_file_size_mb: config.upload.max_file_size_mb,
        },
        frontend_url: config.server.frontend_url.clone(),
        oauth: OAuthConfig {
            google: config.oauth.google.clone(),
            microsoft: config.oauth.microsoft.clone(),
            github: config.oauth.github.clone(),
            state_store: Arc::new(RwLock::new(HashMap::new())),
        },
        contact_repo: Arc::new(contact_repo),
        deal_repo: Arc::new(deal_repo),
    };

    let rate_limiter = if let Ok(redis_url) = std::env::var("REDIS_URL") {
        RateLimiter::with_redis(&redis_url).await
    } else {
        RateLimiter::new()
    };
    let metrics = Arc::new(Metrics::new());

    let origin_headers: Vec<axum::http::HeaderValue> = cors_origins
        .iter()
        .filter_map(|origin| axum::http::HeaderValue::from_str(origin).ok())
        .collect();

    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::list(origin_headers))
        .allow_credentials(true)
        .allow_methods([
            axum::http::Method::GET,
            axum::http::Method::POST,
            axum::http::Method::PUT,
            axum::http::Method::DELETE,
            axum::http::Method::PATCH,
            axum::http::Method::OPTIONS,
        ])
        .allow_headers([
            axum::http::header::CONTENT_TYPE,
            axum::http::header::AUTHORIZATION,
            axum::http::header::ACCEPT,
            axum::http::header::HeaderName::from_static("x-csrf-token"),
            axum::http::header::HeaderName::from_static("cookie"),
        ]);

    let app = routes::public_routes()
        .merge(routes::whatsapp_webhook_routes().layer(rate_limiter.layer()))
        .merge(routes::integration_callback_routes())
        .merge(routes::login_routes().layer(rate_limiter.layer()))
        .merge(routes::register_routes().layer(rate_limiter.layer()))
        .merge(routes::refresh_routes().layer(rate_limiter.layer()))
        .merge(
            routes::auth_routes()
                .layer(axum::middleware::from_fn(
                    crm_backend::middleware::auth::csrf_middleware,
                ))
                .layer(axum::middleware::from_fn_with_state(
                    state.clone(),
                    crm_backend::middleware::auth::auth_middleware,
                )),
        )
        .merge(
            routes::admin_routes()
                .layer(axum::middleware::from_fn(
                    crm_backend::middleware::auth::csrf_middleware,
                ))
                .layer(axum::middleware::from_fn_with_state(
                    state.clone(),
                    crm_backend::routes::admin_only_middleware,
                ))
                .layer(axum::middleware::from_fn_with_state(
                    state.clone(),
                    crm_backend::middleware::auth::auth_middleware,
                )),
        )
        .layer(cors)
        .layer(axum::middleware::from_fn(track_metrics))
        .layer(axum::extract::Extension(metrics))
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let addr = format!("{}:{}", config.server.host, config.server.port);
    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .unwrap_or_else(|e| panic!("Failed to bind to {}: {}", addr, e));

    tracing::info!("CRM Backend starting on {}", addr);

    // Graceful shutdown
    let shutdown_signal = async {
        let ctrl_c = tokio::signal::ctrl_c();
        #[cfg(unix)]
        let terminate = async {
            tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
                .expect("failed to install signal handler")
                .recv()
                .await;
        };
        #[cfg(not(unix))]
        let terminate = std::future::pending::<()>();

        tokio::select! {
            _ = ctrl_c => {},
            _ = terminate => {},
        }
        tracing::info!("Shutdown signal received, starting graceful shutdown");
    };

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal)
        .await
        .unwrap_or_else(|e| panic!("Server error: {}", e));

    tracing::info!("Server shutdown complete");
}
