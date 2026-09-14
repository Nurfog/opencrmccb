use axum::Json;
use axum::extract::{Path, State};
use axum::http::StatusCode;
use uuid::Uuid;
use validator::Validate;

use crate::AppState;
use crate::error::AppError;
use crate::middleware::auth::UserPermissions;
use crate::models::{CreateTag, Tag, UpdateTag};

pub async fn list_tags(
    State(state): State<AppState>,
    perms: UserPermissions,
) -> Result<Json<Vec<Tag>>, AppError> {
    perms
        .require("tags.view")
        .map_err(|_| AppError::Forbidden)?;
    let tags =
        sqlx::query_as::<_, Tag>("SELECT id, name, color, created_at FROM tags ORDER BY name")
            .fetch_all(&state.db)
            .await?;

    Ok(Json(tags))
}

pub async fn create_tag(
    State(state): State<AppState>,
    perms: UserPermissions,
    Json(input): Json<CreateTag>,
) -> Result<(StatusCode, Json<Tag>), AppError> {
    perms
        .require("tags.create")
        .map_err(|_| AppError::Forbidden)?;
    input.validate()?;

    let color = input.color.unwrap_or_else(|| "#6366f1".into());

    let tag = sqlx::query_as::<_, Tag>(
        "INSERT INTO tags (name, color) VALUES ($1, $2) RETURNING id, name, color, created_at",
    )
    .bind(&input.name)
    .bind(&color)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        if let Some(db_err) = e.as_database_error()
            && db_err.code().as_deref() == Some("23505")
        {
            return AppError::Conflict("Tag already exists".into());
        }
        AppError::Internal("Database error".into())
    })?;

    Ok((StatusCode::CREATED, Json(tag)))
}

pub async fn update_tag(
    State(state): State<AppState>,
    perms: UserPermissions,
    Path(id): Path<Uuid>,
    Json(input): Json<UpdateTag>,
) -> Result<Json<Tag>, AppError> {
    perms
        .require("tags.edit")
        .map_err(|_| AppError::Forbidden)?;
    let tag = sqlx::query_as::<_, Tag>(
        "UPDATE tags SET name = COALESCE($2, name), color = COALESCE($3, color) WHERE id = $1 RETURNING id, name, color, created_at"
    )
    .bind(id)
    .bind(&input.name)
    .bind(&input.color)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(Json(tag))
}

pub async fn delete_tag(
    State(state): State<AppState>,
    perms: UserPermissions,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    perms
        .require("tags.delete")
        .map_err(|_| AppError::Forbidden)?;
    let result = sqlx::query("DELETE FROM tags WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(StatusCode::NO_CONTENT)
}

pub async fn assign_tag(
    State(state): State<AppState>,
    perms: UserPermissions,
    Json(input): Json<crate::models::AssignTagRequest>,
) -> Result<StatusCode, AppError> {
    perms
        .require("tags.create")
        .map_err(|_| AppError::Forbidden)?;
    sqlx::query(
        "INSERT INTO entity_tags (tag_id, entity_type, entity_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING"
    )
    .bind(input.tag_id)
    .bind(&input.entity_type)
    .bind(input.entity_id)
    .execute(&state.db)
    .await?;

    Ok(StatusCode::CREATED)
}

pub async fn remove_tag(
    State(state): State<AppState>,
    perms: UserPermissions,
    Path((tag_id, entity_type, entity_id)): Path<(Uuid, String, Uuid)>,
) -> Result<StatusCode, AppError> {
    perms
        .require("tags.delete")
        .map_err(|_| AppError::Forbidden)?;
    let result = sqlx::query(
        "DELETE FROM entity_tags WHERE tag_id = $1 AND entity_type = $2 AND entity_id = $3",
    )
    .bind(tag_id)
    .bind(&entity_type)
    .bind(entity_id)
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(StatusCode::NO_CONTENT)
}

pub async fn get_entity_tags(
    State(state): State<AppState>,
    perms: UserPermissions,
    Path((entity_type, entity_id)): Path<(String, Uuid)>,
) -> Result<Json<Vec<Tag>>, AppError> {
    perms
        .require("tags.view")
        .map_err(|_| AppError::Forbidden)?;
    let tags = sqlx::query_as::<_, Tag>(
        "SELECT t.id, t.name, t.color, t.created_at FROM tags t JOIN entity_tags et ON t.id = et.tag_id WHERE et.entity_type = $1 AND et.entity_id = $2 ORDER BY t.name"
    )
    .bind(&entity_type)
    .bind(entity_id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(tags))
}
