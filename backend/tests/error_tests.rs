use axum::body::to_bytes;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use crm_backend::error::AppError;

async fn status_and_body(err: AppError) -> (StatusCode, String) {
    let response = err.into_response();
    let status = response.status();
    let bytes = to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("failed to read body");
    let body: serde_json::Value = serde_json::from_slice(&bytes).expect("body is not valid JSON");
    (status, body["error"].as_str().unwrap_or("").to_string())
}

#[tokio::test]
async fn not_found_returns_404() {
    let (status, _) = status_and_body(AppError::NotFound).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn unauthorized_returns_401() {
    let (status, _) = status_and_body(AppError::Unauthorized).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn forbidden_returns_403() {
    let (status, _) = status_and_body(AppError::Forbidden).await;
    assert_eq!(status, StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn bad_request_returns_400_with_message() {
    let (status, msg) = status_and_body(AppError::BadRequest("missing field".into())).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(msg, "missing field");
}

#[tokio::test]
async fn validation_returns_422_with_message() {
    let (status, msg) = status_and_body(AppError::Validation("invalid email".into())).await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(msg, "invalid email");
}

#[tokio::test]
async fn conflict_returns_409_with_message() {
    let (status, msg) = status_and_body(AppError::Conflict("already exists".into())).await;
    assert_eq!(status, StatusCode::CONFLICT);
    assert_eq!(msg, "already exists");
}

#[tokio::test]
async fn internal_returns_500_with_message() {
    let (status, msg) = status_and_body(AppError::Internal("oops".into())).await;
    assert_eq!(status, StatusCode::INTERNAL_SERVER_ERROR);
    assert_eq!(msg, "oops");
}

#[tokio::test]
async fn response_json_has_error_key() {
    let response = AppError::NotFound.into_response();
    let bytes = to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("failed to read body");
    let body: serde_json::Value = serde_json::from_slice(&bytes).expect("body is not valid JSON");
    assert!(body.is_object());
    assert!(body.get("error").is_some());
}

#[tokio::test]
async fn from_sqlx_error_converts_to_internal() {
    let sqlx_err = sqlx::Error::RowNotFound;
    let app_err: AppError = sqlx_err.into();
    let (status, msg) = status_and_body(app_err).await;
    assert_eq!(status, StatusCode::INTERNAL_SERVER_ERROR);
    assert_eq!(msg, "Database error");
}

#[tokio::test]
async fn from_uuid_error_converts_to_bad_request() {
    let uuid_err = "not-a-uuid".parse::<uuid::Uuid>().unwrap_err();
    let app_err: AppError = uuid_err.into();
    let (status, msg) = status_and_body(app_err).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(msg, "Invalid UUID");
}
