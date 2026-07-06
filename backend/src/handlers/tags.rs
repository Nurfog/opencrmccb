use axum::Json;
use axum::extract::{Path, State};
use axum::http::StatusCode;
use uuid::Uuid;
use validator::Validate;

use crate::AppState;
use crate::middleware::auth::UserPermissions;
use crate::models::{CreateTag, Tag, UpdateTag};

pub async fn list_tags(
    State(state): State<AppState>,
    perms: UserPermissions,
) -> Result<Json<Vec<Tag>>, StatusCode> {
    perms
        .require("tags.view")
        .map_err(|_| StatusCode::FORBIDDEN)?;
    let tags =
        sqlx::query_as::<_, Tag>("SELECT id, name, color, created_at FROM tags ORDER BY name")
            .fetch_all(&state.db)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(tags))
}

pub async fn create_tag(
    State(state): State<AppState>,
    perms: UserPermissions,
    Json(input): Json<CreateTag>,
) -> Result<(StatusCode, Json<Tag>), StatusCode> {
    perms
        .require("tags.create")
        .map_err(|_| StatusCode::FORBIDDEN)?;
    input
        .validate()
        .map_err(|_| StatusCode::UNPROCESSABLE_ENTITY)?;

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
            return StatusCode::CONFLICT;
        }
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok((StatusCode::CREATED, Json(tag)))
}

pub async fn update_tag(
    State(state): State<AppState>,
    perms: UserPermissions,
    Path(id): Path<Uuid>,
    Json(input): Json<UpdateTag>,
) -> Result<Json<Tag>, StatusCode> {
    perms
        .require("tags.edit")
        .map_err(|_| StatusCode::FORBIDDEN)?;
    let tag = sqlx::query_as::<_, Tag>(
        "UPDATE tags SET name = COALESCE($2, name), color = COALESCE($3, color) WHERE id = $1 RETURNING id, name, color, created_at"
    )
    .bind(id)
    .bind(&input.name)
    .bind(&input.color)
    .fetch_optional(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(tag))
}

pub async fn delete_tag(
    State(state): State<AppState>,
    perms: UserPermissions,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    perms
        .require("tags.delete")
        .map_err(|_| StatusCode::FORBIDDEN)?;
    let result = sqlx::query("DELETE FROM tags WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    Ok(StatusCode::NO_CONTENT)
}

pub async fn assign_tag(
    State(state): State<AppState>,
    perms: UserPermissions,
    Json(input): Json<crate::models::AssignTagRequest>,
) -> Result<StatusCode, StatusCode> {
    perms
        .require("tags.create")
        .map_err(|_| StatusCode::FORBIDDEN)?;
    sqlx::query(
        "INSERT INTO entity_tags (tag_id, entity_type, entity_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING"
    )
    .bind(input.tag_id)
    .bind(&input.entity_type)
    .bind(input.entity_id)
    .execute(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(StatusCode::CREATED)
}

pub async fn remove_tag(
    State(state): State<AppState>,
    perms: UserPermissions,
    Path((tag_id, entity_type, entity_id)): Path<(Uuid, String, Uuid)>,
) -> Result<StatusCode, StatusCode> {
    perms
        .require("tags.delete")
        .map_err(|_| StatusCode::FORBIDDEN)?;
    let result = sqlx::query(
        "DELETE FROM entity_tags WHERE tag_id = $1 AND entity_type = $2 AND entity_id = $3",
    )
    .bind(tag_id)
    .bind(&entity_type)
    .bind(entity_id)
    .execute(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    Ok(StatusCode::NO_CONTENT)
}

pub async fn get_entity_tags(
    State(state): State<AppState>,
    perms: UserPermissions,
    Path((entity_type, entity_id)): Path<(String, Uuid)>,
) -> Result<Json<Vec<Tag>>, StatusCode> {
    perms
        .require("tags.view")
        .map_err(|_| StatusCode::FORBIDDEN)?;
    let tags = sqlx::query_as::<_, Tag>(
        "SELECT t.id, t.name, t.color, t.created_at FROM tags t JOIN entity_tags et ON t.id = et.tag_id WHERE et.entity_type = $1 AND et.entity_id = $2 ORDER BY t.name"
    )
    .bind(&entity_type)
    .bind(entity_id)
    .fetch_all(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(tags))
}
