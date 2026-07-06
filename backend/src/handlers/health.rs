use axum::Json;
use axum::extract::State;
use axum::http::StatusCode;
use serde_json::{Value, json};

use crate::AppState;

pub async fn health_check(State(state): State<AppState>) -> (StatusCode, Json<Value>) {
    let db_ok = sqlx::query("SELECT 1").fetch_one(&state.db).await.is_ok();

    let status = if db_ok { "healthy" } else { "degraded" };
    let status_code = if db_ok {
        StatusCode::OK
    } else {
        StatusCode::SERVICE_UNAVAILABLE
    };

    (
        status_code,
        Json(json!({
            "status": status,
            "service": "crm-backend",
            "database": if db_ok { "connected" } else { "disconnected" },
        })),
    )
}
