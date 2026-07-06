use axum::Json;
use axum::extract::State;
use axum::http::StatusCode;

use crate::AppState;
use crate::middleware::auth::UserPermissions;
use crate::models::{PipelineReport, PipelineReportItem, WinLossReport};

#[derive(sqlx::FromRow)]
struct StageRow {
    stage: String,
    count: i64,
    total_value: f64,
}

pub async fn get_pipeline_report(
    State(state): State<AppState>,
    perms: UserPermissions,
) -> Result<Json<PipelineReport>, StatusCode> {
    perms
        .require("reports.view")
        .map_err(|_| StatusCode::FORBIDDEN)?;
    let total_row: (i64, Option<f64>) =
        sqlx::query_as("SELECT COUNT(*), COALESCE(SUM(value)::double precision, 0.0) FROM deals")
            .fetch_one(&state.db)
            .await
            .map_err(|e| {
                tracing::error!("pipeline report total error: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

    let total_deals = total_row.0;
    let total_value = total_row.1.unwrap_or(0.0);

    let rows = sqlx::query_as::<_, StageRow>(
        r#"
        SELECT stage, COUNT(*) AS count, COALESCE(SUM(value)::double precision, 0.0) AS total_value
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
    .map_err(|e| {
        tracing::error!("pipeline report stages error: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let stages: Vec<PipelineReportItem> = rows
        .into_iter()
        .map(|r| {
            let avg_value = if r.count > 0 {
                r.total_value / r.count as f64
            } else {
                0.0
            };
            let percentage = if total_deals > 0 {
                (r.count as f64 / total_deals as f64) * 100.0
            } else {
                0.0
            };
            PipelineReportItem {
                stage: r.stage,
                count: r.count,
                total_value: r.total_value,
                avg_value,
                percentage,
            }
        })
        .collect();

    Ok(Json(PipelineReport {
        stages,
        total_deals,
        total_value,
    }))
}

pub async fn get_win_loss_report(
    State(state): State<AppState>,
    perms: UserPermissions,
) -> Result<Json<WinLossReport>, StatusCode> {
    perms
        .require("reports.view")
        .map_err(|_| StatusCode::FORBIDDEN)?;
    let won_row: (i64, Option<f64>) = sqlx::query_as(
        "SELECT COUNT(*), COALESCE(SUM(value)::double precision, 0.0) FROM deals WHERE stage = 'closed_won'",
    )
    .fetch_one(&state.db)
    .await
    .map_err(|e| { tracing::error!("win/loss report won error: {}", e); StatusCode::INTERNAL_SERVER_ERROR })?;

    let lost_row: (i64, Option<f64>) = sqlx::query_as(
        "SELECT COUNT(*), COALESCE(SUM(value)::double precision, 0.0) FROM deals WHERE stage = 'closed_lost'",
    )
    .fetch_one(&state.db)
    .await
    .map_err(|e| { tracing::error!("win/loss report lost error: {}", e); StatusCode::INTERNAL_SERVER_ERROR })?;

    let won_count = won_row.0;
    let won_value = won_row.1.unwrap_or(0.0);
    let lost_count = lost_row.0;
    let lost_value = lost_row.1.unwrap_or(0.0);
    let total_closed = won_count + lost_count;

    let win_rate = if total_closed > 0 {
        (won_count as f64 / total_closed as f64) * 100.0
    } else {
        0.0
    };

    let loss_rate = if total_closed > 0 {
        (lost_count as f64 / total_closed as f64) * 100.0
    } else {
        0.0
    };

    Ok(Json(WinLossReport {
        won_count,
        lost_count,
        win_rate,
        loss_rate,
        won_value,
        lost_value,
        total_closed,
    }))
}
