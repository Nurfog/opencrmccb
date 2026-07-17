use axum::Json;
use axum::extract::{Path, Query, State};
use axum::http::{HeaderMap, HeaderValue, StatusCode};
use uuid::Uuid;
use validator::Validate;

use crate::AppState;
use crate::handlers::audit::insert_audit_log;
use crate::middleware::auth::{Claims, UserPermissions};
use crate::models::{
    CreateDeal, Deal, DealStage, PaginatedResponse, PaginationParams, UpdateDeal, UpdateDealStage,
    WebhookEvent,
};
use crate::models::{ImportResult, escape_csv, parse_csv_rows, parse_deal_import_row};
use crate::services::webhook_worker::enqueue_event;

pub async fn list_deals(
    State(state): State<AppState>,
    perms: UserPermissions,
    Query(params): Query<PaginationParams>,
) -> Result<Json<PaginatedResponse<Deal>>, StatusCode> {
    perms
        .require("deals.view")
        .map_err(|_| StatusCode::FORBIDDEN)?;

    let page = params.page();
    let per_page = params.per_page();
    let offset = params.offset();
    let sort_col = match params.sort_by.as_deref() {
        Some("title") => "title",
        Some("value") => "value",
        Some("stage") => "stage",
        Some("created_at") => "created_at",
        _ => "created_at",
    };
    let sort_dir = params.sort_direction();

    let search_filter = params
        .search
        .as_ref()
        .map(|s| format!("%{}%", crate::models::escape_like(s)));

    let count_query = if search_filter.is_some() {
        crate::queries::deal_queries::DEAL_COUNT_SEARCH
    } else {
        crate::queries::deal_queries::DEAL_COUNT
    };

    let base_select = crate::queries::deal_queries::DEAL_SELECT;

    let data_query = if search_filter.is_some() {
        format!(
            "{base_select} WHERE d.title ILIKE $1 ESCAPE '\\' ORDER BY d.{sort_col} {sort_dir} LIMIT $2 OFFSET $3"
        )
    } else {
        format!("{base_select} ORDER BY d.{sort_col} {sort_dir} LIMIT $1 OFFSET $2")
    };

    let total: (i64,) = if let Some(ref search) = search_filter {
        sqlx::query_as(count_query)
            .bind(search)
            .fetch_one(&state.db)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    } else {
        sqlx::query_as(count_query)
            .fetch_one(&state.db)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    };

    let deals = if let Some(ref search) = search_filter {
        sqlx::query_as::<_, Deal>(&data_query)
            .bind(search)
            .bind(per_page)
            .bind(offset)
            .fetch_all(&state.db)
            .await
            .map_err(|e| {
                tracing::error!("deals list error: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?
    } else {
        sqlx::query_as::<_, Deal>(&data_query)
            .bind(per_page)
            .bind(offset)
            .fetch_all(&state.db)
            .await
            .map_err(|e| {
                tracing::error!("deals list error: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?
    };

    Ok(Json(PaginatedResponse::new(deals, total.0, page, per_page)))
}

pub async fn create_deal(
    State(state): State<AppState>,
    claims: axum::extract::Extension<Claims>,
    perms: UserPermissions,
    Json(input): Json<CreateDeal>,
) -> Result<(StatusCode, Json<Deal>), StatusCode> {
    perms
        .require("deals.create")
        .map_err(|_| StatusCode::FORBIDDEN)?;
    input
        .validate()
        .map_err(|_| StatusCode::UNPROCESSABLE_ENTITY)?;

    let stage = input.stage.unwrap_or(DealStage::Lead);
    let currency = input.currency.unwrap_or_else(|| "USD".to_string());

    let deal = state
        .deal_repo
        .create(
            &input.title,
            input.value,
            &currency,
            stage,
            input.contact_id,
            input.company_id,
            input.expected_close_date,
            input.notes.as_deref(),
        )
        .await
        .map_err(|e| {
            tracing::error!("create_deal error: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let user_id = Uuid::parse_str(&claims.sub).ok();
    let _ = insert_audit_log(
        &state.db,
        user_id,
        "created",
        "deal",
        deal.id,
        None,
        Some(serde_json::to_value(&deal).unwrap_or_default()),
    )
    .await;

    if let Err(e) = enqueue_event(
        &state.db,
        WebhookEvent::DealCreated,
        serde_json::to_value(&deal).unwrap_or_default(),
    )
    .await
    {
        tracing::warn!("Failed to enqueue DealCreated webhook: {e}");
    }

    Ok((StatusCode::CREATED, Json(deal)))
}

pub async fn get_deal(
    State(state): State<AppState>,
    perms: UserPermissions,
    Path(id): Path<Uuid>,
) -> Result<Json<Deal>, StatusCode> {
    perms
        .require("deals.view")
        .map_err(|_| StatusCode::FORBIDDEN)?;

    state
        .deal_repo
        .find_by_id(id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}

pub async fn update_deal(
    State(state): State<AppState>,
    claims: axum::extract::Extension<Claims>,
    perms: UserPermissions,
    Path(id): Path<Uuid>,
    Json(input): Json<UpdateDeal>,
) -> Result<Json<Deal>, StatusCode> {
    perms
        .require("deals.edit")
        .map_err(|_| StatusCode::FORBIDDEN)?;
    input
        .validate()
        .map_err(|_| StatusCode::UNPROCESSABLE_ENTITY)?;

    let old = state
        .deal_repo
        .find_by_id(id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    let deal = state
        .deal_repo
        .update(id, &input)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    let user_id = Uuid::parse_str(&claims.sub).ok();
    let _ = insert_audit_log(
        &state.db,
        user_id,
        "updated",
        "deal",
        deal.id,
        Some(serde_json::to_value(&old).unwrap_or_default()),
        Some(serde_json::to_value(&deal).unwrap_or_default()),
    )
    .await;

    if let Err(e) = enqueue_event(
        &state.db,
        WebhookEvent::DealUpdated,
        serde_json::to_value(&deal).unwrap_or_default(),
    )
    .await
    {
        tracing::warn!("Failed to enqueue DealUpdated webhook: {e}");
    }

    Ok(Json(deal))
}

pub async fn delete_deal(
    State(state): State<AppState>,
    claims: axum::extract::Extension<Claims>,
    perms: UserPermissions,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    perms
        .require("deals.delete")
        .map_err(|_| StatusCode::FORBIDDEN)?;

    let old = state
        .deal_repo
        .delete(id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    let user_id = Uuid::parse_str(&claims.sub).ok();
    let _ = insert_audit_log(
        &state.db,
        user_id,
        "deleted",
        "deal",
        old.id,
        Some(serde_json::to_value(&old).unwrap_or_default()),
        None,
    )
    .await;

    if let Err(e) = enqueue_event(
        &state.db,
        WebhookEvent::DealDeleted,
        serde_json::to_value(&old).unwrap_or_default(),
    )
    .await
    {
        tracing::warn!("Failed to enqueue DealDeleted webhook: {e}");
    }

    Ok(StatusCode::NO_CONTENT)
}

pub async fn export_deals(
    State(state): State<AppState>,
    perms: UserPermissions,
    Query(params): Query<PaginationParams>,
) -> Result<(HeaderMap, String), StatusCode> {
    perms
        .require("deals.view")
        .map_err(|_| StatusCode::FORBIDDEN)?;

    let deals = state
        .deal_repo
        .find_all_for_export(params.search.as_deref())
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut csv = String::from(
        "title,value,currency,stage,contact_id,company_id,expected_close_date,notes\n",
    );
    for d in &deals {
        csv.push_str(&format!(
            "{},{},{},{},{},{},{},{}\n",
            escape_csv(&d.title),
            d.value,
            escape_csv(&d.currency),
            serde_json::from_value::<String>(serde_json::json!(&d.stage))
                .unwrap_or_else(|_| "lead".into()),
            d.contact_id.map(|id| id.to_string()).unwrap_or_default(),
            d.company_id.map(|id| id.to_string()).unwrap_or_default(),
            d.expected_close_date
                .map(|dt| dt.format("%Y-%m-%dT%H:%M:%SZ").to_string())
                .unwrap_or_default(),
            escape_csv(d.notes.as_deref().unwrap_or(""))
        ));
    }

    let mut headers = HeaderMap::new();
    headers.insert(
        "Content-Type",
        HeaderValue::from_static("text/csv; charset=utf-8"),
    );
    headers.insert(
        "Content-Disposition",
        HeaderValue::from_static("attachment; filename=\"deals.csv\""),
    );

    Ok((headers, csv))
}

pub async fn import_deals(
    State(state): State<AppState>,
    perms: UserPermissions,
    body: String,
) -> Result<Json<ImportResult>, StatusCode> {
    perms
        .require("deals.create")
        .map_err(|_| StatusCode::FORBIDDEN)?;
    let rows = parse_csv_rows(&body);

    let mut imported = 0;
    let mut errors = Vec::new();

    for (row_num, fields) in rows.iter().enumerate() {
        let row = match parse_deal_import_row(fields) {
            Ok(row) => row,
            Err(message) => {
                errors.push(format!("Línea {}: {}", row_num + 2, message));
                continue;
            }
        };

        match state
            .deal_repo
            .create(
                &row.title,
                row.value,
                &row.currency,
                row.stage,
                row.contact_id,
                row.company_id,
                row.expected_close_date,
                row.notes.as_deref(),
            )
            .await
        {
            Ok(_) => imported += 1,
            Err(e) => errors.push(format!("Línea {}: {}", row_num + 2, e)),
        }
    }

    Ok(Json(ImportResult { imported, errors }))
}

pub async fn update_deal_stage(
    State(state): State<AppState>,
    claims: axum::extract::Extension<Claims>,
    perms: UserPermissions,
    Path(id): Path<Uuid>,
    Json(input): Json<UpdateDealStage>,
) -> Result<Json<Deal>, StatusCode> {
    perms
        .require("deals.edit")
        .map_err(|_| StatusCode::FORBIDDEN)?;

    let old = state
        .deal_repo
        .find_by_id(id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    let deal = state
        .deal_repo
        .update_stage(id, input.stage, input.position)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    let user_id = Uuid::parse_str(&claims.sub).ok();
    let _ = insert_audit_log(
        &state.db,
        user_id,
        "stage_updated",
        "deal",
        deal.id,
        Some(serde_json::to_value(&old).unwrap_or_default()),
        Some(serde_json::to_value(&deal).unwrap_or_default()),
    )
    .await;

    if let Err(e) = enqueue_event(
        &state.db,
        WebhookEvent::DealUpdated,
        serde_json::to_value(&deal).unwrap_or_default(),
    )
    .await
    {
        tracing::warn!("Failed to enqueue DealUpdated webhook: {e}");
    }

    Ok(Json(deal))
}
