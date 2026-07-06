use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use serde::Serialize;
use validator::ValidationErrors;

#[derive(Debug, Serialize)]
pub struct ValidationError {
    pub errors: Vec<FieldError>,
}

#[derive(Debug, Serialize)]
pub struct FieldError {
    pub field: String,
    pub message: String,
}

impl From<ValidationErrors> for ValidationError {
    fn from(errors: ValidationErrors) -> Self {
        let field_errors: Vec<FieldError> = errors
            .field_errors()
            .into_iter()
            .flat_map(|(field, errs)| {
                errs.iter().map(move |err| {
                    let message = err
                        .message
                        .clone()
                        .map(|m| m.to_string())
                        .unwrap_or_else(|| "Invalid value".to_string());
                    FieldError {
                        field: field.to_string(),
                        message,
                    }
                })
            })
            .collect();

        ValidationError {
            errors: field_errors,
        }
    }
}

impl IntoResponse for ValidationError {
    fn into_response(self) -> Response {
        (StatusCode::UNPROCESSABLE_ENTITY, axum::Json(self)).into_response()
    }
}
