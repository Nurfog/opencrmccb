use axum::Json;
use axum::extract::{Path, Query, State};
use axum::http::{HeaderMap, HeaderValue, StatusCode};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

use crate::AppState;
use crate::handlers::audit::insert_audit_log;
use crate::middleware::auth::{Claims, UserPermissions};
use crate::models::{
    Contact, CreateContact, PaginatedResponse, PaginationParams, UpdateContact, WebhookEvent,
};
use crate::models::{ImportResult, escape_csv, escape_like, parse_csv_rows};
use crate::services::webhook_worker::enqueue_event;

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
    let page = params.page();
    let per_page = params.per_page();
    let offset = params.offset();
    let sort_col = params.sort_column();
    let sort_dir = params.sort_direction();

    let search_filter = params
        .search
        .as_ref()
        .map(|s| format!("%{}%", escape_like(s)));

    let count_query = if let Some(ref _search) = search_filter {
        "SELECT COUNT(*) FROM contacts WHERE first_name ILIKE $1 ESCAPE '\\' OR last_name ILIKE $1 ESCAPE '\\' OR email ILIKE $1 ESCAPE '\\'".to_string()
    } else {
        "SELECT COUNT(*) FROM contacts".to_string()
    };

    let data_query = if let Some(ref _search) = search_filter {
        format!(
            "SELECT id, first_name, last_name, email, phone, company_id, position, notes, created_at, updated_at
             FROM contacts
             WHERE first_name ILIKE $1 ESCAPE '\\' OR last_name ILIKE $1 ESCAPE '\\' OR email ILIKE $1 ESCAPE '\\'
             ORDER BY {} {}
             LIMIT $2 OFFSET $3",
            sort_col, sort_dir
        )
    } else {
        format!(
            "SELECT id, first_name, last_name, email, phone, company_id, position, notes, created_at, updated_at
             FROM contacts
             ORDER BY {} {}
             LIMIT $1 OFFSET $2",
            sort_col, sort_dir
        )
    };

    let total: (i64,) = if let Some(ref search) = search_filter {
        sqlx::query_as(&count_query)
            .bind(search)
            .fetch_one(&state.db)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    } else {
        sqlx::query_as(&count_query)
            .fetch_one(&state.db)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    };

    let contacts = if let Some(ref search) = search_filter {
        sqlx::query_as::<_, Contact>(&data_query)
            .bind(search)
            .bind(per_page)
            .bind(offset)
            .fetch_all(&state.db)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    } else {
        sqlx::query_as::<_, Contact>(&data_query)
            .bind(per_page)
            .bind(offset)
            .fetch_all(&state.db)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    };

    Ok(Json(PaginatedResponse::new(
        contacts, total.0, page, per_page,
    )))
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

    let contact = sqlx::query_as::<_, Contact>(
        r#"
        INSERT INTO contacts (first_name, last_name, email, phone, company_id, position, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, first_name, last_name, email, phone, company_id, position, notes, created_at, updated_at
        "#,
    )
    .bind(&input.first_name)
    .bind(&input.last_name)
    .bind(&input.email)
    .bind(&input.phone)
    .bind(input.company_id)
    .bind(&input.position)
    .bind(&input.notes)
    .fetch_one(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let user_id = Uuid::parse_str(&claims.sub).ok();
    let _ = insert_audit_log(
        &state,
        user_id,
        "created",
        "contact",
        contact.id,
        None,
        Some(serde_json::to_value(&contact).unwrap_or_default()),
    )
    .await;

    if let Err(e) = enqueue_event(
        &state.db,
        WebhookEvent::ContactCreated,
        serde_json::to_value(&contact).unwrap_or_default(),
    )
    .await
    {
        tracing::warn!("Failed to enqueue ContactCreated webhook: {e}");
    }

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
    let contact = sqlx::query_as::<_, Contact>(
        "SELECT id, first_name, last_name, email, phone, company_id, position, notes, created_at, updated_at FROM contacts WHERE id = $1"
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(contact))
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

    let old = sqlx::query_as::<_, Contact>(
        "SELECT id, first_name, last_name, email, phone, company_id, position, notes, created_at, updated_at FROM contacts WHERE id = $1"
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .ok_or(StatusCode::NOT_FOUND)?;

    let contact = sqlx::query_as::<_, Contact>(
        r#"
        UPDATE contacts
        SET first_name = COALESCE($2, first_name),
            last_name = COALESCE($3, last_name),
            email = COALESCE($4, email),
            phone = COALESCE($5, phone),
            company_id = COALESCE($6, company_id),
            position = COALESCE($7, position),
            notes = COALESCE($8, notes),
            updated_at = NOW()
        WHERE id = $1
        RETURNING id, first_name, last_name, email, phone, company_id, position, notes, created_at, updated_at
        "#,
    )
    .bind(id)
    .bind(&input.first_name)
    .bind(&input.last_name)
    .bind(&input.email)
    .bind(&input.phone)
    .bind(input.company_id)
    .bind(&input.position)
    .bind(&input.notes)
    .fetch_optional(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .ok_or(StatusCode::NOT_FOUND)?;

    let user_id = Uuid::parse_str(&claims.sub).ok();
    let _ = insert_audit_log(
        &state,
        user_id,
        "updated",
        "contact",
        contact.id,
        Some(serde_json::to_value(&old).unwrap_or_default()),
        Some(serde_json::to_value(&contact).unwrap_or_default()),
    )
    .await;

    if let Err(e) = enqueue_event(
        &state.db,
        WebhookEvent::ContactUpdated,
        serde_json::to_value(&contact).unwrap_or_default(),
    )
    .await
    {
        tracing::warn!("Failed to enqueue ContactUpdated webhook: {e}");
    }

    Ok(Json(contact))
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
    let old = sqlx::query_as::<_, Contact>(
        "SELECT id, first_name, last_name, email, phone, company_id, position, notes, created_at, updated_at FROM contacts WHERE id = $1"
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let result = sqlx::query("DELETE FROM contacts WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    if let Some(contact) = old {
        let user_id = Uuid::parse_str(&claims.sub).ok();
        let _ = insert_audit_log(
            &state,
            user_id,
            "deleted",
            "contact",
            contact.id,
            Some(serde_json::to_value(&contact).unwrap_or_default()),
            None,
        )
        .await;

        if let Err(e) = enqueue_event(
            &state.db,
            WebhookEvent::ContactDeleted,
            serde_json::to_value(&contact).unwrap_or_default(),
        )
        .await
        {
            tracing::warn!("Failed to enqueue ContactDeleted webhook: {e}");
        }
    }

    Ok(StatusCode::NO_CONTENT)
}

pub async fn export_contacts(
    State(state): State<AppState>,
    perms: UserPermissions,
    Query(params): Query<PaginationParams>,
) -> Result<(HeaderMap, String), StatusCode> {
    perms
        .require("contacts.view")
        .map_err(|_| StatusCode::FORBIDDEN)?;
    let search_filter = params
        .search
        .as_ref()
        .map(|s| format!("%{}%", escape_like(s)));

    let contacts = if let Some(ref search) = search_filter {
        sqlx::query_as::<_, Contact>(
            "SELECT id, first_name, last_name, email, phone, company_id, position, notes, created_at, updated_at FROM contacts WHERE first_name ILIKE $1 ESCAPE '\\' OR last_name ILIKE $1 ESCAPE '\\' OR email ILIKE $1 ESCAPE '\\' ORDER BY created_at DESC LIMIT 100000"
        )
        .bind(search)
        .fetch_all(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    } else {
        sqlx::query_as::<_, Contact>(
            "SELECT id, first_name, last_name, email, phone, company_id, position, notes, created_at, updated_at FROM contacts ORDER BY created_at DESC LIMIT 100000"
        )
        .fetch_all(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    };

    let mut csv = String::from("first_name,last_name,email,phone,position,company_id,notes\n");
    for c in &contacts {
        csv.push_str(&format!(
            "{},{},{},{},{},{},{}\n",
            escape_csv(&c.first_name),
            escape_csv(&c.last_name),
            escape_csv(c.email.as_deref().unwrap_or("")),
            escape_csv(c.phone.as_deref().unwrap_or("")),
            escape_csv(c.position.as_deref().unwrap_or("")),
            c.company_id.map(|id| id.to_string()).unwrap_or_default(),
            escape_csv(c.notes.as_deref().unwrap_or(""))
        ));
    }

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

#[derive(Debug, Serialize)]
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
    if input.ids.is_empty() {
        return Ok(Json(BulkDeleteResponse { deleted: 0 }));
    }

    let result = sqlx::query("DELETE FROM contacts WHERE id = ANY($1)")
        .bind(&input.ids)
        .execute(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let deleted = result.rows_affected() as usize;

    Ok(Json(BulkDeleteResponse { deleted }))
}

pub async fn import_contacts(
    State(state): State<AppState>,
    perms: UserPermissions,
    body: String,
) -> Result<Json<ImportResult>, StatusCode> {
    perms
        .require("contacts.create")
        .map_err(|_| StatusCode::FORBIDDEN)?;
    let rows = parse_csv_rows(&body);

    let mut imported = 0;
    let mut errors = Vec::new();

    for (row_num, fields) in rows.iter().enumerate() {
        if fields.len() < 2 {
            errors.push(format!("Línea {}: formato inválido", row_num + 2));
            continue;
        }

        let first_name = fields[0].trim().to_string();
        let last_name = fields[1].trim().to_string();
        let email = fields
            .get(2)
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());
        let phone = fields
            .get(3)
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());
        let position = fields
            .get(4)
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());

        let result = sqlx::query_as::<_, Contact>(
            r#"
            INSERT INTO contacts (first_name, last_name, email, phone, position)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, first_name, last_name, email, phone, company_id, position, notes, created_at, updated_at
            "#,
        )
        .bind(&first_name)
        .bind(&last_name)
        .bind(&email)
        .bind(&phone)
        .bind(&position)
        .fetch_one(&state.db)
        .await;

        match result {
            Ok(_) => imported += 1,
            Err(e) => errors.push(format!("Línea {}: {}", row_num + 2, e)),
        }
    }

    Ok(Json(ImportResult { imported, errors }))
}
