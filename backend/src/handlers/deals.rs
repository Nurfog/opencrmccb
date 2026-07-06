use axum::Json;
use axum::extract::{Path, Query, State};
use axum::http::{HeaderMap, HeaderValue, StatusCode};
use sqlx::Row;
use uuid::Uuid;
use validator::Validate;

use crate::AppState;
use crate::handlers::audit::insert_audit_log;
use crate::middleware::auth::{Claims, UserPermissions};
use crate::models::{
    CreateDeal, Deal, DealStage, PaginatedResponse, PaginationParams, UpdateDeal, UpdateDealStage,
};
use crate::models::{ImportResult, escape_csv, escape_like, parse_csv_rows, parse_deal_import_row};

fn map_deal_row(row: sqlx::postgres::PgRow) -> Deal {
    Deal {
        id: row.get("id"),
        title: row.get("title"),
        value: row.get("value"),
        currency: row.get("currency"),
        stage: row.get("stage"),
        position: row.get("position"),
        contact_id: row.get("contact_id"),
        company_id: row.get("company_id"),
        pipeline_id: row.get("pipeline_id"),
        pipeline_stage_id: row.get("pipeline_stage_id"),
        expected_close_date: row.get("expected_close_date"),
        notes: row.get("notes"),
        contact_name: row.get("contact_name"),
        company_name: row.get("company_name"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }
}

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
        .map(|s| format!("%{}%", escape_like(s)));

    let count_query = if let Some(ref _search) = search_filter {
        "SELECT COUNT(*) FROM deals WHERE title ILIKE $1 ESCAPE '\\'".to_string()
    } else {
        "SELECT COUNT(*) FROM deals".to_string()
    };

    let base_select = "SELECT d.id, d.title, d.value, d.currency, d.stage, d.position, d.contact_id, d.company_id, d.pipeline_id, d.pipeline_stage_id, d.expected_close_date, d.notes, CONCAT(c.first_name, ' ', c.last_name) as contact_name, co.name as company_name, d.created_at, d.updated_at FROM deals d LEFT JOIN contacts c ON d.contact_id = c.id LEFT JOIN companies co ON d.company_id = co.id";

    let data_query = if let Some(ref _search) = search_filter {
        format!(
            "{} WHERE d.title ILIKE $1 ESCAPE '\\' ORDER BY d.{} {} LIMIT $2 OFFSET $3",
            base_select, sort_col, sort_dir
        )
    } else {
        format!(
            "{} ORDER BY d.{} {} LIMIT $1 OFFSET $2",
            base_select, sort_col, sort_dir
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

    let row = sqlx::query(
        "INSERT INTO deals (title, value, currency, stage, contact_id, company_id, expected_close_date, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, title, value, currency, stage, position, contact_id, company_id, expected_close_date, notes, (SELECT CONCAT(c.first_name, ' ', c.last_name) FROM contacts c WHERE c.id = contact_id) as contact_name, (SELECT co.name FROM companies co WHERE co.id = company_id) as company_name, created_at, updated_at"
    )
    .bind(&input.title)
    .bind(input.value)
    .bind(&currency)
    .bind(stage)
    .bind(input.contact_id)
    .bind(input.company_id)
    .bind(input.expected_close_date)
    .bind(&input.notes)
    .fetch_one(&state.db)
    .await
    .map_err(|e| { tracing::error!("create_deal error: {}", e); StatusCode::INTERNAL_SERVER_ERROR })?;

    let deal = map_deal_row(row);

    let user_id = Uuid::parse_str(&claims.sub).ok();
    let _ = insert_audit_log(
        &state,
        user_id,
        "created",
        "deal",
        deal.id,
        None,
        Some(serde_json::to_value(&deal).unwrap_or_default()),
    )
    .await;

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
    let deal = sqlx::query_as::<_, Deal>(
        "SELECT d.id, d.title, d.value, d.currency, d.stage, d.position, d.contact_id, d.company_id, d.pipeline_id, d.pipeline_stage_id, d.expected_close_date, d.notes, CONCAT(c.first_name, ' ', c.last_name) as contact_name, co.name as company_name, d.created_at, d.updated_at FROM deals d LEFT JOIN contacts c ON d.contact_id = c.id LEFT JOIN companies co ON d.company_id = co.id WHERE d.id = $1"
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(deal))
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

    let old = sqlx::query_as::<_, Deal>(
        "SELECT d.id, d.title, d.value, d.currency, d.stage, d.position, d.contact_id, d.company_id, d.pipeline_id, d.pipeline_stage_id, d.expected_close_date, d.notes, CONCAT(c.first_name, ' ', c.last_name) as contact_name, co.name as company_name, d.created_at, d.updated_at FROM deals d LEFT JOIN contacts c ON d.contact_id = c.id LEFT JOIN companies co ON d.company_id = co.id WHERE d.id = $1"
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .ok_or(StatusCode::NOT_FOUND)?;

    let row = sqlx::query(
        "UPDATE deals SET title = COALESCE($2, title), value = COALESCE($3, value), currency = COALESCE($4, currency), stage = COALESCE($5, stage), contact_id = COALESCE($6, contact_id), company_id = COALESCE($7, company_id), expected_close_date = COALESCE($8, expected_close_date), notes = COALESCE($9, notes), updated_at = NOW() WHERE id = $1 RETURNING id, title, value, currency, stage, position, contact_id, company_id, expected_close_date, notes, (SELECT CONCAT(c.first_name, ' ', c.last_name) FROM contacts c WHERE c.id = contact_id) as contact_name, (SELECT co.name FROM companies co WHERE co.id = company_id) as company_name, created_at, updated_at"
    )
    .bind(id)
    .bind(&input.title)
    .bind(input.value)
    .bind(&input.currency)
    .bind(input.stage)
    .bind(input.contact_id)
    .bind(input.company_id)
    .bind(input.expected_close_date)
    .bind(&input.notes)
    .fetch_optional(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .ok_or(StatusCode::NOT_FOUND)?;

    let deal = map_deal_row(row);

    let user_id = Uuid::parse_str(&claims.sub).ok();
    let _ = insert_audit_log(
        &state,
        user_id,
        "updated",
        "deal",
        deal.id,
        Some(serde_json::to_value(&old).unwrap_or_default()),
        Some(serde_json::to_value(&deal).unwrap_or_default()),
    )
    .await;

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
    let old = sqlx::query_as::<_, Deal>(
        "SELECT d.id, d.title, d.value, d.currency, d.stage, d.position, d.contact_id, d.company_id, d.pipeline_id, d.pipeline_stage_id, d.expected_close_date, d.notes, CONCAT(c.first_name, ' ', c.last_name) as contact_name, co.name as company_name, d.created_at, d.updated_at FROM deals d LEFT JOIN contacts c ON d.contact_id = c.id LEFT JOIN companies co ON d.company_id = co.id WHERE d.id = $1"
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let result = sqlx::query("DELETE FROM deals WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    if let Some(deal) = old {
        let user_id = Uuid::parse_str(&claims.sub).ok();
        let _ = insert_audit_log(
            &state,
            user_id,
            "deleted",
            "deal",
            deal.id,
            Some(serde_json::to_value(&deal).unwrap_or_default()),
            None,
        )
        .await;
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
    let search_filter = params
        .search
        .as_ref()
        .map(|s| format!("%{}%", escape_like(s)));

    let deals = if let Some(ref search) = search_filter {
        sqlx::query_as::<_, Deal>(
            "SELECT d.id, d.title, d.value, d.currency, d.stage, d.position, d.contact_id, d.company_id, d.pipeline_id, d.pipeline_stage_id, d.expected_close_date, d.notes, CONCAT(c.first_name, ' ', c.last_name) as contact_name, co.name as company_name, d.created_at, d.updated_at FROM deals d LEFT JOIN contacts c ON d.contact_id = c.id LEFT JOIN companies co ON d.company_id = co.id WHERE d.title ILIKE $1 ESCAPE '\\' ORDER BY d.created_at DESC LIMIT 100000"
        )
        .bind(search)
        .fetch_all(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    } else {
        sqlx::query_as::<_, Deal>(
            "SELECT d.id, d.title, d.value, d.currency, d.stage, d.position, d.contact_id, d.company_id, d.pipeline_id, d.pipeline_stage_id, d.expected_close_date, d.notes, CONCAT(c.first_name, ' ', c.last_name) as contact_name, co.name as company_name, d.created_at, d.updated_at FROM deals d LEFT JOIN contacts c ON d.contact_id = c.id LEFT JOIN companies co ON d.company_id = co.id ORDER BY d.created_at DESC LIMIT 100000"
        )
        .fetch_all(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    };

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

        let result = sqlx::query(
            "INSERT INTO deals (title, value, currency, stage, contact_id, company_id, expected_close_date, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, title, value, currency, stage, position, contact_id, company_id, expected_close_date, notes, (SELECT CONCAT(c.first_name, ' ', c.last_name) FROM contacts c WHERE c.id = contact_id) as contact_name, (SELECT co.name FROM companies co WHERE co.id = company_id) as company_name, created_at, updated_at"
        )
        .bind(&row.title)
        .bind(row.value)
        .bind(&row.currency)
        .bind(row.stage)
        .bind(row.contact_id)
        .bind(row.company_id)
        .bind(row.expected_close_date)
        .bind(&row.notes)
        .fetch_one(&state.db)
        .await;

        match result {
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
    let old = sqlx::query_as::<_, Deal>(
        "SELECT d.id, d.title, d.value, d.currency, d.stage, d.position, d.contact_id, d.company_id, d.pipeline_id, d.pipeline_stage_id, d.expected_close_date, d.notes, CONCAT(c.first_name, ' ', c.last_name) as contact_name, co.name as company_name, d.created_at, d.updated_at FROM deals d LEFT JOIN contacts c ON d.contact_id = c.id LEFT JOIN companies co ON d.company_id = co.id WHERE d.id = $1"
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .ok_or(StatusCode::NOT_FOUND)?;

    let row = sqlx::query(
        "UPDATE deals SET stage = $2, position = COALESCE($3, position), updated_at = NOW() WHERE id = $1 RETURNING id, title, value, currency, stage, position, contact_id, company_id, expected_close_date, notes, (SELECT CONCAT(c.first_name, ' ', c.last_name) FROM contacts c WHERE c.id = contact_id) as contact_name, (SELECT co.name FROM companies co WHERE co.id = company_id) as company_name, created_at, updated_at"
    )
    .bind(id)
    .bind(input.stage)
    .bind(input.position)
    .fetch_optional(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .ok_or(StatusCode::NOT_FOUND)?;

    let deal = map_deal_row(row);

    let user_id = Uuid::parse_str(&claims.sub).ok();
    let _ = insert_audit_log(
        &state,
        user_id,
        "stage_updated",
        "deal",
        deal.id,
        Some(serde_json::to_value(&old).unwrap_or_default()),
        Some(serde_json::to_value(&deal).unwrap_or_default()),
    )
    .await;

    Ok(Json(deal))
}
