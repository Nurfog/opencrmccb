use axum::Json;
use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use serde::Deserialize;
use uuid::Uuid;
use validator::Validate;

use crate::AppState;
use crate::handlers::audit::insert_audit_log;
use crate::middleware::auth::{Claims, UserPermissions};
use crate::models::{Activity, CreateActivity, PaginationParams, UpdateActivity};

#[derive(Debug, Deserialize)]
pub struct ActivityFilter {
    #[serde(flatten)]
    pub pagination: PaginationParams,
    pub activity_type: Option<String>,
    pub contact_id: Option<Uuid>,
    pub deal_id: Option<Uuid>,
    pub company_id: Option<Uuid>,
}

pub async fn list_activities(
    State(state): State<AppState>,
    perms: UserPermissions,
    Query(params): Query<ActivityFilter>,
) -> Result<Json<Vec<Activity>>, StatusCode> {
    perms
        .require("activities.view")
        .map_err(|_| StatusCode::FORBIDDEN)?;
    let per_page = params.pagination.per_page();
    let offset = params.pagination.offset();

    let mut query = String::from(
        "SELECT id, activity_type as \"activity_type: ActivityType\", subject, description, contact_id, deal_id, company_id, due_date, completed, created_at, updated_at FROM activities WHERE 1=1",
    );
    let mut param_idx = 1i32;

    if let Some(ref _at) = params.activity_type {
        query.push_str(&format!(" AND activity_type::text = ${}", param_idx));
        param_idx += 1;
    }
    if let Some(_contact_id) = params.contact_id {
        query.push_str(&format!(" AND contact_id = ${}", param_idx));
        param_idx += 1;
    }
    if let Some(_deal_id) = params.deal_id {
        query.push_str(&format!(" AND deal_id = ${}", param_idx));
        param_idx += 1;
    }
    if let Some(_company_id) = params.company_id {
        query.push_str(&format!(" AND company_id = ${}", param_idx));
        param_idx += 1;
    }

    query.push_str(&format!(
        " ORDER BY created_at DESC LIMIT ${} OFFSET ${}",
        param_idx,
        param_idx + 1
    ));

    let mut q = sqlx::query_as::<_, Activity>(&query);
    if let Some(ref at) = params.activity_type {
        q = q.bind(at);
    }
    if let Some(cid) = params.contact_id {
        q = q.bind(cid);
    }
    if let Some(did) = params.deal_id {
        q = q.bind(did);
    }
    if let Some(cmid) = params.company_id {
        q = q.bind(cmid);
    }
    q = q.bind(per_page).bind(offset);

    let activities = q
        .fetch_all(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(activities))
}

pub async fn create_activity(
    State(state): State<AppState>,
    claims: axum::extract::Extension<Claims>,
    perms: UserPermissions,
    Json(input): Json<CreateActivity>,
) -> Result<(StatusCode, Json<Activity>), StatusCode> {
    perms
        .require("activities.create")
        .map_err(|_| StatusCode::FORBIDDEN)?;
    input
        .validate()
        .map_err(|_| StatusCode::UNPROCESSABLE_ENTITY)?;
    let activity = sqlx::query_as::<_, Activity>(
        r#"
        INSERT INTO activities (activity_type, subject, description, contact_id, deal_id, company_id, due_date, recurrence_type, recurrence_interval, recurrence_end_date)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id, activity_type as "activity_type: ActivityType", subject, description, contact_id, deal_id, company_id, due_date, completed, recurrence_type as "recurrence_type: RecurrenceType", recurrence_interval, recurrence_end_date, parent_activity_id, created_at, updated_at
        "#,
    )
    .bind(input.activity_type)
    .bind(&input.subject)
    .bind(&input.description)
    .bind(input.contact_id)
    .bind(input.deal_id)
    .bind(input.company_id)
    .bind(input.due_date)
    .bind(input.recurrence_type.unwrap_or(crate::models::RecurrenceType::None))
    .bind(input.recurrence_interval.unwrap_or(1))
    .bind(input.recurrence_end_date)
    .fetch_one(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let user_id = Uuid::parse_str(&claims.sub).ok();
    let _ = insert_audit_log(
        &state,
        user_id,
        "created",
        "activity",
        activity.id,
        None,
        Some(serde_json::to_value(&activity).unwrap_or_default()),
    )
    .await;

    Ok((StatusCode::CREATED, Json(activity)))
}

pub async fn update_activity(
    State(state): State<AppState>,
    claims: axum::extract::Extension<Claims>,
    perms: UserPermissions,
    Path(id): Path<Uuid>,
    Json(input): Json<UpdateActivity>,
) -> Result<Json<Activity>, StatusCode> {
    perms
        .require("activities.edit")
        .map_err(|_| StatusCode::FORBIDDEN)?;
    let old = sqlx::query_as::<_, Activity>(
        "SELECT id, activity_type as \"activity_type: ActivityType\", subject, description, contact_id, deal_id, company_id, due_date, completed, created_at, updated_at FROM activities WHERE id = $1"
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .ok_or(StatusCode::NOT_FOUND)?;

    let activity = sqlx::query_as::<_, Activity>(
        r#"
        UPDATE activities
        SET activity_type = COALESCE($2, activity_type),
            subject = COALESCE($3, subject),
            description = COALESCE($4, description),
            contact_id = COALESCE($5, contact_id),
            deal_id = COALESCE($6, deal_id),
            company_id = COALESCE($7, company_id),
            due_date = COALESCE($8, due_date),
            completed = COALESCE($9, completed),
            updated_at = NOW()
        WHERE id = $1
        RETURNING id, activity_type as "activity_type: ActivityType", subject, description, contact_id, deal_id, company_id, due_date, completed, recurrence_type as "recurrence_type: RecurrenceType", recurrence_interval, recurrence_end_date, parent_activity_id, created_at, updated_at
        "#,
    )
    .bind(id)
    .bind(input.activity_type)
    .bind(&input.subject)
    .bind(&input.description)
    .bind(input.contact_id)
    .bind(input.deal_id)
    .bind(input.company_id)
    .bind(input.due_date)
    .bind(input.recurrence_type.unwrap_or(crate::models::RecurrenceType::None))
    .bind(input.recurrence_interval.unwrap_or(1))
    .bind(input.recurrence_end_date)
    .bind(input.completed)
    .fetch_optional(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .ok_or(StatusCode::NOT_FOUND)?;

    let user_id = Uuid::parse_str(&claims.sub).ok();
    let _ = insert_audit_log(
        &state,
        user_id,
        "updated",
        "activity",
        activity.id,
        Some(serde_json::to_value(&old).unwrap_or_default()),
        Some(serde_json::to_value(&activity).unwrap_or_default()),
    )
    .await;

    Ok(Json(activity))
}

pub async fn delete_activity(
    State(state): State<AppState>,
    claims: axum::extract::Extension<Claims>,
    perms: UserPermissions,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    perms
        .require("activities.delete")
        .map_err(|_| StatusCode::FORBIDDEN)?;
    let old = sqlx::query_as::<_, Activity>(
        "SELECT id, activity_type as \"activity_type: ActivityType\", subject, description, contact_id, deal_id, company_id, due_date, completed, created_at, updated_at FROM activities WHERE id = $1"
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let result = sqlx::query("DELETE FROM activities WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    if let Some(activity) = old {
        let user_id = Uuid::parse_str(&claims.sub).ok();
        let _ = insert_audit_log(
            &state,
            user_id,
            "deleted",
            "activity",
            activity.id,
            Some(serde_json::to_value(&activity).unwrap_or_default()),
            None,
        )
        .await;
    }

    Ok(StatusCode::NO_CONTENT)
}

pub async fn complete_activity(
    State(state): State<AppState>,
    claims: axum::extract::Extension<Claims>,
    perms: UserPermissions,
    Path(id): Path<Uuid>,
) -> Result<Json<Activity>, StatusCode> {
    perms
        .require("activities.edit")
        .map_err(|_| StatusCode::FORBIDDEN)?;
    let activity = sqlx::query_as::<_, Activity>(
        r#"
        UPDATE activities
        SET completed = true, updated_at = NOW()
        WHERE id = $1
        RETURNING id, activity_type as "activity_type: ActivityType", subject, description, contact_id, deal_id, company_id, due_date, completed, recurrence_type as "recurrence_type: RecurrenceType", recurrence_interval, recurrence_end_date, parent_activity_id, created_at, updated_at
        "#,
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .ok_or(StatusCode::NOT_FOUND)?;

    let user_id = Uuid::parse_str(&claims.sub).ok();
    let _ = insert_audit_log(
        &state,
        user_id,
        "completed",
        "activity",
        activity.id,
        None,
        Some(serde_json::to_value(&activity).unwrap_or_default()),
    )
    .await;

    Ok(Json(activity))
}
