use axum::http::StatusCode;
use axum::{Json, extract::State};

use crate::AppState;
use crate::middleware::auth::UserPermissions;
use crate::models::dashboard::*;

pub async fn get_dashboard_stats(
    State(state): State<AppState>,
    perms: UserPermissions,
) -> Result<Json<DashboardStats>, StatusCode> {
    perms
        .require("dashboard.view")
        .map_err(|_| StatusCode::FORBIDDEN)?;
    let row: (i64,) = sqlx::query_as("SELECT COUNT(*)::bigint FROM contacts")
        .fetch_one(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("dashboard stats error: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    let total_contacts = row.0;

    let row: (i64,) = sqlx::query_as("SELECT COUNT(*)::bigint FROM companies")
        .fetch_one(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("dashboard stats error: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    let total_companies = row.0;

    let row: (i64,) = sqlx::query_as("SELECT COUNT(*)::bigint FROM deals")
        .fetch_one(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("dashboard stats error: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    let total_deals = row.0;

    let row: (f64,) = sqlx::query_as("SELECT COALESCE(SUM(value), 0)::double precision FROM deals")
        .fetch_one(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("dashboard stats error: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    let total_revenue = row.0;

    let row: (i64,) = sqlx::query_as(
        "SELECT COUNT(*)::bigint FROM deals WHERE stage NOT IN ('closed_won', 'closed_lost')",
    )
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("dashboard stats error: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;
    let active_deals = row.0;

    let row: (i64,) =
        sqlx::query_as("SELECT COUNT(*)::bigint FROM deals WHERE stage = 'closed_won'")
            .fetch_one(&state.db)
            .await
            .map_err(|e| {
                tracing::error!("dashboard stats error: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;
    let won_deals = row.0;

    let row: (i64,) =
        sqlx::query_as("SELECT COUNT(*)::bigint FROM deals WHERE stage = 'closed_lost'")
            .fetch_one(&state.db)
            .await
            .map_err(|e| {
                tracing::error!("dashboard stats error: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;
    let lost_deals = row.0;

    Ok(Json(DashboardStats {
        total_contacts,
        total_companies,
        total_deals,
        total_revenue,
        active_deals,
        won_deals,
        lost_deals,
    }))
}

pub async fn get_pipeline(
    State(state): State<AppState>,
    perms: UserPermissions,
) -> Result<Json<PipelineResponse>, StatusCode> {
    perms
        .require("dashboard.view")
        .map_err(|_| StatusCode::FORBIDDEN)?;
    #[derive(sqlx::FromRow)]
    struct StageRow {
        stage: String,
        count: i64,
        total_value: f64,
    }

    let rows = sqlx::query_as::<_, StageRow>(
        r#"
        SELECT stage::text AS stage, COUNT(*)::bigint AS count, COALESCE(SUM(value), 0)::double precision AS total_value
        FROM deals
        GROUP BY stage
        ORDER BY CASE stage
            WHEN 'lead' THEN 1
            WHEN 'qualified' THEN 2
            WHEN 'proposal' THEN 3
            WHEN 'negotiation' THEN 4
            WHEN 'closed_won' THEN 5
            WHEN 'closed_lost' THEN 6
            ELSE 7
        END
        "#,
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| { tracing::error!("pipeline error: {}", e); StatusCode::INTERNAL_SERVER_ERROR })?;

    let stages: Vec<PipelineStage> = rows
        .into_iter()
        .map(|r| PipelineStage {
            stage: r.stage,
            count: r.count,
            total_value: r.total_value,
        })
        .collect();

    Ok(Json(PipelineResponse { stages }))
}

pub async fn get_top_deals(
    State(state): State<AppState>,
    perms: UserPermissions,
) -> Result<Json<TopDealsResponse>, StatusCode> {
    perms
        .require("dashboard.view")
        .map_err(|_| StatusCode::FORBIDDEN)?;
    #[derive(sqlx::FromRow)]
    struct TopDealRow {
        id: uuid::Uuid,
        title: String,
        value: f64,
        stage: String,
        company_name: Option<String>,
    }

    let rows = sqlx::query_as::<_, TopDealRow>(
        r#"
        SELECT d.id, d.title, d.value::double precision, d.stage::text AS stage, c.name AS company_name
        FROM deals d
        LEFT JOIN companies c ON d.company_id = c.id
        WHERE d.stage != 'closed_lost'
        ORDER BY d.value DESC
        LIMIT 5
        "#,
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| { tracing::error!("top deals error: {}", e); StatusCode::INTERNAL_SERVER_ERROR })?;

    let deals: Vec<TopDeal> = rows
        .into_iter()
        .map(|r| TopDeal {
            id: r.id,
            title: r.title,
            value: r.value,
            stage: r.stage,
            company_name: r.company_name,
        })
        .collect();

    Ok(Json(TopDealsResponse { deals }))
}

pub async fn get_recent_activities(
    State(state): State<AppState>,
    perms: UserPermissions,
) -> Result<Json<RecentActivitiesResponse>, StatusCode> {
    perms
        .require("dashboard.view")
        .map_err(|_| StatusCode::FORBIDDEN)?;
    #[derive(sqlx::FromRow)]
    struct ActivityRow {
        id: uuid::Uuid,
        activity_type: String,
        subject: String,
        contact_name: Option<String>,
        created_at: chrono::DateTime<chrono::Utc>,
    }

    let rows = sqlx::query_as::<_, ActivityRow>(
        r#"
        SELECT a.id, a.activity_type::text AS activity_type, a.subject,
               CONCAT(c.first_name, ' ', c.last_name) AS contact_name,
               a.created_at
        FROM activities a
        LEFT JOIN contacts c ON a.contact_id = c.id
        ORDER BY a.created_at DESC
        LIMIT 10
        "#,
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("recent activities error: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let activities: Vec<RecentActivity> = rows
        .into_iter()
        .map(|r| RecentActivity {
            id: r.id,
            activity_type: r.activity_type,
            subject: r.subject,
            contact_name: r.contact_name,
            created_at: r.created_at,
        })
        .collect();

    Ok(Json(RecentActivitiesResponse { activities }))
}
