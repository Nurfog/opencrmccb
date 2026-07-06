use axum::Json;
use axum::extract::{Path, State};
use axum::http::StatusCode;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

use crate::AppState;
use crate::error::AppError;
use crate::middleware::auth::Claims;

// ─── Pipeline ────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Pipeline {
    pub id: Uuid,
    pub name: String,
    pub slug: String,
    pub description: Option<String>,
    pub entity_type: String,
    pub is_default: bool,
    pub is_active: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct PipelineStage {
    pub id: Uuid,
    pub pipeline_id: Uuid,
    pub name: String,
    pub position: i32,
    pub color: Option<String>,
    pub probability: Option<i32>,
    pub is_default: bool,
}

#[derive(Debug, Deserialize, Validate)]
pub struct PipelineInput {
    #[validate(length(min = 1, max = 200))]
    pub name: String,
    pub slug: String,
    pub description: Option<String>,
    pub entity_type: Option<String>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct StageInput {
    #[validate(length(min = 1, max = 200))]
    pub name: String,
    pub position: i32,
    pub color: Option<String>,
    pub probability: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct PipelineWithStages {
    pub pipeline: Pipeline,
    pub stages: Vec<PipelineStage>,
}

pub async fn list_pipelines(
    State(state): State<AppState>,
    _claims: axum::extract::Extension<Claims>,
) -> Result<Json<Vec<PipelineWithStages>>, AppError> {
    let pipelines = sqlx::query_as::<_, Pipeline>(
        "SELECT id, name, slug, description, entity_type, is_default, is_active, created_at FROM pipelines WHERE is_active = true ORDER BY created_at"
    )
    .fetch_all(&state.db)
    .await?;

    let pipeline_ids: Vec<Uuid> = pipelines.iter().map(|p| p.id).collect();
    let all_stages = if pipeline_ids.is_empty() {
        Vec::new()
    } else {
        sqlx::query_as::<_, PipelineStage>(
            "SELECT id, pipeline_id, name, position, color, probability, is_default FROM pipeline_stages WHERE pipeline_id = ANY($1) ORDER BY position"
        )
        .bind(&pipeline_ids)
        .fetch_all(&state.db)
        .await?
    };

    let mut stages_by_pipeline: std::collections::HashMap<Uuid, Vec<PipelineStage>> =
        std::collections::HashMap::new();
    for stage in all_stages {
        stages_by_pipeline
            .entry(stage.pipeline_id)
            .or_default()
            .push(stage);
    }

    let mut result = Vec::new();
    for p in pipelines {
        let stages = stages_by_pipeline.remove(&p.id).unwrap_or_default();
        result.push(PipelineWithStages {
            pipeline: p,
            stages,
        });
    }

    Ok(Json(result))
}

pub async fn create_pipeline(
    State(state): State<AppState>,
    _claims: axum::extract::Extension<Claims>,
    Json(input): Json<PipelineInput>,
) -> Result<(StatusCode, Json<Pipeline>), AppError> {
    input
        .validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;
    let pipeline = sqlx::query_as::<_, Pipeline>(
        r#"
        INSERT INTO pipelines (name, slug, description, entity_type)
        VALUES ($1, $2, $3, $4)
        RETURNING id, name, slug, description, entity_type, is_default, is_active, created_at
        "#,
    )
    .bind(&input.name)
    .bind(&input.slug)
    .bind(&input.description)
    .bind(input.entity_type.as_deref().unwrap_or("person"))
    .fetch_one(&state.db)
    .await
    .map_err(|_| AppError::Conflict("Pipeline already exists".into()))?;

    Ok((StatusCode::CREATED, Json(pipeline)))
}

pub async fn update_pipeline(
    State(state): State<AppState>,
    _claims: axum::extract::Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(input): Json<PipelineInput>,
) -> Result<Json<Pipeline>, AppError> {
    input
        .validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;

    let pipeline = sqlx::query_as::<_, Pipeline>(
        r#"
        UPDATE pipelines SET name = $2, slug = $3, description = $4, entity_type = $5, updated_at = NOW()
        WHERE id = $1
        RETURNING id, name, slug, description, entity_type, is_default, is_active, created_at
        "#
    )
    .bind(id)
    .bind(&input.name)
    .bind(&input.slug)
    .bind(&input.description)
    .bind(input.entity_type.as_deref().unwrap_or("person"))
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(Json(pipeline))
}

pub async fn delete_pipeline(
    State(state): State<AppState>,
    _claims: axum::extract::Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    let result = sqlx::query("DELETE FROM pipelines WHERE id = $1 AND is_default = false")
        .bind(id)
        .execute(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::BAD_REQUEST);
    }
    Ok(StatusCode::NO_CONTENT)
}

// ─── Stages ──────────────────────────────────────────────────────

pub async fn create_stage(
    State(state): State<AppState>,
    _claims: axum::extract::Extension<Claims>,
    Path(pipeline_id): Path<Uuid>,
    Json(input): Json<StageInput>,
) -> Result<(StatusCode, Json<PipelineStage>), AppError> {
    input
        .validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;

    let stage = sqlx::query_as::<_, PipelineStage>(
        r#"
        INSERT INTO pipeline_stages (pipeline_id, name, position, color, probability)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, pipeline_id, name, position, color, probability, is_default
        "#,
    )
    .bind(pipeline_id)
    .bind(&input.name)
    .bind(input.position)
    .bind(&input.color)
    .bind(input.probability)
    .fetch_one(&state.db)
    .await
    .map_err(|e| AppError::Internal(e.to_string()))?;

    Ok((StatusCode::CREATED, Json(stage)))
}

pub async fn delete_stage(
    State(state): State<AppState>,
    _claims: axum::extract::Extension<Claims>,
    Path((_pipeline_id, stage_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, StatusCode> {
    let result = sqlx::query("DELETE FROM pipeline_stages WHERE id = $1 AND is_default = false")
        .bind(stage_id)
        .execute(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::BAD_REQUEST);
    }
    Ok(StatusCode::NO_CONTENT)
}

// ─── Profiles ────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Profile {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub is_system: bool,
}

#[derive(Debug, Serialize)]
pub struct ProfileWithPermissions {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub is_system: bool,
    pub permissions: Vec<String>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct ProfileInput {
    #[validate(length(min = 1, max = 100))]
    pub name: String,
    pub description: Option<String>,
    pub permissions: Option<Vec<String>>,
}

#[derive(sqlx::FromRow)]
struct ProfileWithPermissionsRow {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub is_system: bool,
    pub permissions: Vec<String>,
}

pub async fn list_profiles(
    State(state): State<AppState>,
    _claims: axum::extract::Extension<Claims>,
) -> Result<Json<Vec<ProfileWithPermissions>>, AppError> {
    let rows = sqlx::query_as::<_, ProfileWithPermissionsRow>(
        r#"
        SELECT p.id, p.name, p.description, p.is_system,
               COALESCE(array_agg(pp.permission) FILTER (WHERE pp.permission IS NOT NULL), ARRAY[]::text[]) AS permissions
        FROM profiles p
        LEFT JOIN profile_permissions pp ON pp.profile_id = p.id
        GROUP BY p.id
        ORDER BY p.created_at
        "#,
    )
    .fetch_all(&state.db)
    .await?;

    let result = rows
        .into_iter()
        .map(|r| ProfileWithPermissions {
            id: r.id,
            name: r.name,
            description: r.description,
            is_system: r.is_system,
            permissions: r.permissions,
        })
        .collect();

    Ok(Json(result))
}

pub async fn create_profile(
    State(state): State<AppState>,
    _claims: axum::extract::Extension<Claims>,
    Json(input): Json<ProfileInput>,
) -> Result<(StatusCode, Json<serde_json::Value>), AppError> {
    input
        .validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;

    let profile = sqlx::query_as::<_, Profile>(
        r#"
        INSERT INTO profiles (name, description) VALUES ($1, $2)
        RETURNING id, name, description, is_system
        "#,
    )
    .bind(&input.name)
    .bind(&input.description)
    .fetch_one(&state.db)
    .await
    .map_err(|_| AppError::Conflict("Profile already exists".into()))?;

    if let Some(perms) = &input.permissions {
        for perm in perms {
            let _ = sqlx::query(
                "INSERT INTO profile_permissions (profile_id, permission) VALUES ($1, $2) ON CONFLICT DO NOTHING"
            )
            .bind(profile.id)
            .bind(perm)
            .execute(&state.db)
            .await;
        }
    }

    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({
            "id": profile.id, "name": profile.name, "description": profile.description, "is_system": profile.is_system,
            "permissions": input.permissions.unwrap_or_default(),
        })),
    ))
}

pub async fn update_profile(
    State(state): State<AppState>,
    _claims: axum::extract::Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(input): Json<ProfileInput>,
) -> Result<Json<serde_json::Value>, AppError> {
    input
        .validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;

    let profile = sqlx::query_as::<_, Profile>(
        "UPDATE profiles SET name = $2, description = $3, updated_at = NOW() WHERE id = $1 RETURNING id, name, description, is_system"
    )
    .bind(id)
    .bind(&input.name)
    .bind(&input.description)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    if let Some(perms) = &input.permissions {
        let _ = sqlx::query("DELETE FROM profile_permissions WHERE profile_id = $1")
            .bind(id)
            .execute(&state.db)
            .await;
        for perm in perms {
            let _ = sqlx::query(
                "INSERT INTO profile_permissions (profile_id, permission) VALUES ($1, $2)",
            )
            .bind(id)
            .bind(perm)
            .execute(&state.db)
            .await;
        }
    }

    Ok(Json(serde_json::json!({
        "id": profile.id, "name": profile.name, "description": profile.description, "is_system": profile.is_system,
        "permissions": input.permissions.unwrap_or_default(),
    })))
}

// ─── Branding ────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Branding {
    pub id: Uuid,
    pub company_name: Option<String>,
    pub logo_url: Option<String>,
    pub primary_color: Option<String>,
    pub secondary_color: Option<String>,
    pub accent_color: Option<String>,
    pub favicon_url: Option<String>,
    pub custom_domain: Option<String>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct BrandingInput {
    pub company_name: Option<String>,
    #[validate(length(max = 500))]
    pub logo_url: Option<String>,
    pub primary_color: Option<String>,
    pub secondary_color: Option<String>,
    pub accent_color: Option<String>,
    pub favicon_url: Option<String>,
    pub custom_domain: Option<String>,
}

pub async fn get_branding(State(state): State<AppState>) -> Result<Json<Branding>, AppError> {
    let branding = sqlx::query_as::<_, Branding>(
        "SELECT id, company_name, logo_url, primary_color, secondary_color, accent_color, favicon_url, custom_domain FROM branding ORDER BY id LIMIT 1"
    )
    .fetch_optional(&state.db)
    .await?
    .unwrap_or(Branding {
        id: Uuid::nil(), company_name: Some("OpenCRM".into()), logo_url: None,
        primary_color: Some("#2563eb".into()), secondary_color: Some("#1e40af".into()),
        accent_color: Some("#10b981".into()), favicon_url: None, custom_domain: None,
    });

    Ok(Json(branding))
}

pub async fn update_branding(
    State(state): State<AppState>,
    _claims: axum::extract::Extension<Claims>,
    Json(input): Json<BrandingInput>,
) -> Result<Json<Branding>, AppError> {
    input
        .validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;

    let existing = sqlx::query_scalar::<_, Uuid>("SELECT id FROM branding LIMIT 1")
        .fetch_optional(&state.db)
        .await?;

    if let Some(id) = existing {
        sqlx::query(
            r#"
            UPDATE branding SET
                company_name = COALESCE($2, company_name),
                logo_url = COALESCE($3, logo_url),
                primary_color = COALESCE($4, primary_color),
                secondary_color = COALESCE($5, secondary_color),
                accent_color = COALESCE($6, accent_color),
                favicon_url = COALESCE($7, favicon_url),
                custom_domain = COALESCE($8, custom_domain),
                updated_at = NOW()
            WHERE id = $1
            "#,
        )
        .bind(id)
        .bind(&input.company_name)
        .bind(&input.logo_url)
        .bind(&input.primary_color)
        .bind(&input.secondary_color)
        .bind(&input.accent_color)
        .bind(&input.favicon_url)
        .bind(&input.custom_domain)
        .execute(&state.db)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;
    } else {
        sqlx::query(
            r#"
            INSERT INTO branding (company_name, logo_url, primary_color, secondary_color, accent_color, favicon_url, custom_domain)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            "#
        )
        .bind(&input.company_name)
        .bind(&input.logo_url)
        .bind(&input.primary_color)
        .bind(&input.secondary_color)
        .bind(&input.accent_color)
        .bind(&input.favicon_url)
        .bind(&input.custom_domain)
        .execute(&state.db)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;
    }

    get_branding(State(state)).await
}
