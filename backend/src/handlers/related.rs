use axum::Json;
use axum::extract::{Path, State};
use axum::http::StatusCode;
use uuid::Uuid;

use crate::AppState;
use crate::models::{Activity, Contact, Deal};

pub async fn get_contact_deals(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<Deal>>, StatusCode> {
    let deals = sqlx::query_as::<_, Deal>(
        "SELECT id, title, value, currency, stage, position, contact_id, company_id, expected_close_date, notes, created_at, updated_at FROM deals WHERE contact_id = $1 ORDER BY created_at DESC"
    )
    .bind(id)
    .fetch_all(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(deals))
}

pub async fn get_contact_activities(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<Activity>>, StatusCode> {
    let activities = sqlx::query_as::<_, Activity>(
        "SELECT id, subject, description, activity_type, due_date, completed, contact_id, deal_id, created_at, updated_at FROM activities WHERE contact_id = $1 ORDER BY due_date DESC"
    )
    .bind(id)
    .fetch_all(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(activities))
}

pub async fn get_company_contacts(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<Contact>>, StatusCode> {
    let contacts = sqlx::query_as::<_, Contact>(
        "SELECT id, first_name, last_name, email, phone, company_id, position, notes, created_at, updated_at FROM contacts WHERE company_id = $1 ORDER BY created_at DESC"
    )
    .bind(id)
    .fetch_all(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(contacts))
}

pub async fn get_company_deals(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<Deal>>, StatusCode> {
    let deals = sqlx::query_as::<_, Deal>(
        "SELECT id, title, value, currency, stage, position, contact_id, company_id, expected_close_date, notes, created_at, updated_at FROM deals WHERE company_id = $1 ORDER BY created_at DESC"
    )
    .bind(id)
    .fetch_all(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(deals))
}

pub async fn get_deal_activities(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<Activity>>, StatusCode> {
    let activities = sqlx::query_as::<_, Activity>(
        "SELECT id, subject, description, activity_type, due_date, completed, contact_id, deal_id, created_at, updated_at FROM activities WHERE deal_id = $1 ORDER BY due_date DESC"
    )
    .bind(id)
    .fetch_all(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(activities))
}

pub async fn get_company_revenue(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let result: (Option<f64>, i64) = sqlx::query_as(
        "SELECT SUM(value), COUNT(*) FROM deals WHERE company_id = $1 AND stage IN ('closed_won', 'proposal', 'negotiation')"
    )
    .bind(id)
    .fetch_one(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(serde_json::json!({
        "total_value": result.0.unwrap_or(0.0),
        "deal_count": result.1,
    })))
}
