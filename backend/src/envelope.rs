use axum::Json;
use serde::Serialize;

#[derive(Serialize)]
pub struct ApiResponse<T: Serialize> {
    pub data: T,
}

impl<T: Serialize> ApiResponse<T> {
    pub fn new(data: T) -> Self {
        Self { data }
    }

    /// Wrap `data` in the standard `{ "data": T }` envelope as `Json`.
    pub fn ok(data: T) -> Json<Self> {
        Json(Self::new(data))
    }
}

/// Shortcut for `Json(ApiResponse::new(data))` — standard success envelope.
pub fn ok<T: Serialize>(data: T) -> Json<ApiResponse<T>> {
    Json(ApiResponse::new(data))
}
