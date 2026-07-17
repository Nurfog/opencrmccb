use axum::Json;
use axum::extract::{Path, Query, State};
use axum::http::{HeaderMap, HeaderValue, StatusCode};
use serde::Deserialize;
use uuid::Uuid;
use validator::Validate;

use crate::AppState;
use crate::middleware::auth::{Claims, UserPermissions};
use crate::models::{Contact, CreateContact, PaginatedResponse, PaginationParams, UpdateContact};
use crate::services::contact_service::ContactService;

#[derive(Debug, Deserialize)]
pub struct BulkDeleteRequest {
    pub ids: Vec<Uuid>,
}

pub async fn list_contacts(
    State(state): State<AppState>,
    perms: UserPermissions,
    Query(params): Query<PaginationParams>,
) -> Result<Json<PaginatedResponse<Contact>>, StatusCode> {
    perms
        .require("contacts.view")
        .map_err(|_| StatusCode::FORBIDDEN)?;

    let svc = ContactService::new(&state.contact_repo);
    svc.list(&params)
        .await
        .map(Json)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

pub async fn create_contact(
    State(state): State<AppState>,
    claims: axum::extract::Extension<Claims>,
    perms: UserPermissions,
    Json(input): Json<CreateContact>,
) -> Result<(StatusCode, Json<Contact>), StatusCode> {
    perms
        .require("contacts.create")
        .map_err(|_| StatusCode::FORBIDDEN)?;
    input
        .validate()
        .map_err(|_| StatusCode::UNPROCESSABLE_ENTITY)?;

    let user_id = Uuid::parse_str(&claims.sub).ok();
    let svc = ContactService::new(&state.contact_repo);
    let contact = svc
        .create(&input, &state, user_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok((StatusCode::CREATED, Json(contact)))
}

pub async fn get_contact(
    State(state): State<AppState>,
    perms: UserPermissions,
    Path(id): Path<Uuid>,
) -> Result<Json<Contact>, StatusCode> {
    perms
        .require("contacts.view")
        .map_err(|_| StatusCode::FORBIDDEN)?;

    let svc = ContactService::new(&state.contact_repo);
    svc.get(id).await.map(Json).map_err(|e| match e {
        crate::error::AppError::NotFound => StatusCode::NOT_FOUND,
        _ => StatusCode::INTERNAL_SERVER_ERROR,
    })
}

pub async fn update_contact(
    State(state): State<AppState>,
    claims: axum::extract::Extension<Claims>,
    perms: UserPermissions,
    Path(id): Path<Uuid>,
    Json(input): Json<UpdateContact>,
) -> Result<Json<Contact>, StatusCode> {
    perms
        .require("contacts.edit")
        .map_err(|_| StatusCode::FORBIDDEN)?;
    input
        .validate()
        .map_err(|_| StatusCode::UNPROCESSABLE_ENTITY)?;

    let user_id = Uuid::parse_str(&claims.sub).ok();
    let svc = ContactService::new(&state.contact_repo);
    svc.update(id, &input, &state, user_id)
        .await
        .map(Json)
        .map_err(|e| match e {
            crate::error::AppError::NotFound => StatusCode::NOT_FOUND,
            _ => StatusCode::INTERNAL_SERVER_ERROR,
        })
}

pub async fn delete_contact(
    State(state): State<AppState>,
    claims: axum::extract::Extension<Claims>,
    perms: UserPermissions,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    perms
        .require("contacts.delete")
        .map_err(|_| StatusCode::FORBIDDEN)?;

    let user_id = Uuid::parse_str(&claims.sub).ok();
    let svc = ContactService::new(&state.contact_repo);
    svc.delete(id, &state, user_id)
        .await
        .map(|_| StatusCode::NO_CONTENT)
        .map_err(|e| match e {
            crate::error::AppError::NotFound => StatusCode::NOT_FOUND,
            _ => StatusCode::INTERNAL_SERVER_ERROR,
        })
}

pub async fn export_contacts(
    State(state): State<AppState>,
    perms: UserPermissions,
    Query(params): Query<PaginationParams>,
) -> Result<(HeaderMap, String), StatusCode> {
    perms
        .require("contacts.view")
        .map_err(|_| StatusCode::FORBIDDEN)?;

    let svc = ContactService::new(&state.contact_repo);
    let csv = svc
        .export(params.search.as_deref())
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

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
    perms: UserPermissions,
    Json(input): Json<BulkDeleteRequest>,
) -> Result<Json<BulkDeleteResponse>, StatusCode> {
    perms
        .require("contacts.delete")
        .map_err(|_| StatusCode::FORBIDDEN)?;

    let svc = ContactService::new(&state.contact_repo);
    let deleted = svc
        .bulk_delete(&input.ids)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(BulkDeleteResponse { deleted }))
}

pub async fn import_contacts(
    State(state): State<AppState>,
    perms: UserPermissions,
    body: String,
) -> Result<Json<crate::models::ImportResult>, StatusCode> {
    perms
        .require("contacts.create")
        .map_err(|_| StatusCode::FORBIDDEN)?;

    let svc = ContactService::new(&state.contact_repo);
    let result = svc
        .import(&body)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(result))
}
