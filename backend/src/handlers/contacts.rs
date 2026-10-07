use axum::Json;
use axum::extract::{Path, Query, State};
use axum::http::{HeaderMap, HeaderValue, StatusCode};
use serde::Deserialize;
use uuid::Uuid;
use validator::Validate;

use crate::AppState;
use crate::error::AppError;
use crate::middleware::auth::{Claims, UserPermissions};
use crate::models::{
    Contact, ContactFilters, CreateContact, PaginatedResponse, PaginationParams, UpdateContact,
};
use crate::services::contact_service::ContactService;

#[derive(Debug, Deserialize, Validate)]
pub struct BulkDeleteRequest {
    #[validate(length(max = 100, message = "Cannot delete more than 100 contacts at once"))]
    pub ids: Vec<Uuid>,
}

pub async fn list_contacts(
    State(state): State<AppState>,
    perms: UserPermissions,
    Query(params): Query<PaginationParams>,
    Query(filters): Query<ContactFilters>,
) -> Result<Json<PaginatedResponse<Contact>>, AppError> {
    perms
        .require("contacts.view")
        .map_err(|_| AppError::Forbidden)?;
    filters
        .validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;

    let svc = ContactService::new(&state.contact_repo);
    Ok(Json(svc.list(&params, &filters).await?))
}

pub async fn create_contact(
    State(state): State<AppState>,
    claims: axum::extract::Extension<Claims>,
    perms: UserPermissions,
    Json(input): Json<CreateContact>,
) -> Result<(StatusCode, Json<Contact>), AppError> {
    perms
        .require("contacts.create")
        .map_err(|_| AppError::Forbidden)?;
    input.validate()?;

    let user_id = Uuid::parse_str(&claims.sub).ok();
    let svc = ContactService::new(&state.contact_repo);
    let contact = svc.create(&input, &state, user_id).await?;

    Ok((StatusCode::CREATED, Json(contact)))
}

pub async fn get_contact(
    State(state): State<AppState>,
    perms: UserPermissions,
    Path(id): Path<Uuid>,
) -> Result<Json<Contact>, AppError> {
    perms
        .require("contacts.view")
        .map_err(|_| AppError::Forbidden)?;

    let svc = ContactService::new(&state.contact_repo);
    Ok(Json(svc.get(id).await?))
}

pub async fn update_contact(
    State(state): State<AppState>,
    claims: axum::extract::Extension<Claims>,
    perms: UserPermissions,
    Path(id): Path<Uuid>,
    Json(input): Json<UpdateContact>,
) -> Result<Json<Contact>, AppError> {
    perms
        .require("contacts.edit")
        .map_err(|_| AppError::Forbidden)?;
    input.validate()?;

    let user_id = Uuid::parse_str(&claims.sub).ok();
    let svc = ContactService::new(&state.contact_repo);
    Ok(Json(svc.update(id, &input, &state, user_id).await?))
}

pub async fn delete_contact(
    State(state): State<AppState>,
    claims: axum::extract::Extension<Claims>,
    perms: UserPermissions,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    perms
        .require("contacts.delete")
        .map_err(|_| AppError::Forbidden)?;

    let user_id = Uuid::parse_str(&claims.sub).ok();
    let svc = ContactService::new(&state.contact_repo);
    svc.delete(id, &state, user_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn export_contacts(
    State(state): State<AppState>,
    perms: UserPermissions,
    Query(params): Query<PaginationParams>,
) -> Result<(HeaderMap, String), AppError> {
    perms
        .require("contacts.view")
        .map_err(|_| AppError::Forbidden)?;

    let svc = ContactService::new(&state.contact_repo);
    let csv = svc.export(params.search.as_deref()).await?;

    let mut headers = HeaderMap::new();
    headers.insert(
        "Content-Type",
        HeaderValue::from_static("text/csv; charset=utf-8"),
    );
    headers.insert(
        "Content-Disposition",
        HeaderValue::from_static("attachment; filename=\"contacts.csv\""),
    );

    Ok((headers, csv))
}

#[derive(Debug, serde::Serialize)]
pub struct BulkDeleteResponse {
    pub deleted: usize,
}

pub async fn bulk_delete_contacts(
    State(state): State<AppState>,
    claims: axum::extract::Extension<Claims>,
    perms: UserPermissions,
    Json(input): Json<BulkDeleteRequest>,
) -> Result<Json<BulkDeleteResponse>, AppError> {
    use validator::Validate;
    perms
        .require("contacts.delete")
        .map_err(|_| AppError::Forbidden)?;
    input.validate()?;

    let user_id = Uuid::parse_str(&claims.sub).ok();
    let svc = ContactService::new(&state.contact_repo);
    let deleted = svc.bulk_delete(&input.ids, &state, user_id).await?;

    Ok(Json(BulkDeleteResponse { deleted }))
}

pub async fn import_contacts(
    State(state): State<AppState>,
    perms: UserPermissions,
    body: axum::body::Bytes,
) -> Result<Json<crate::models::ImportResult>, AppError> {
    perms
        .require("contacts.create")
        .map_err(|_| AppError::Forbidden)?;
    // Bytes (not String): accepts any content-type (the JS client sends
    // text/csv); reject non-UTF8 explicitly instead of axum's 415.
    let body = String::from_utf8(body.to_vec())
        .map_err(|_| AppError::BadRequest("Import body must be UTF-8 text".into()))?;
    // 2MB cap validated here too (defense in depth; global RequestBodyLimitLayer enforces it).
    if body.len() > 2 * 1024 * 1024 {
        return Err(AppError::BadRequest(
            "Import body too large (max 2MB)".into(),
        ));
    }

    let svc = ContactService::new(&state.contact_repo);
    let result = svc.import(&body).await?;

    Ok(Json(result))
}
