use axum::Json;
use axum::extract::{Multipart, Path, Query, State};
use axum::http::{HeaderMap, HeaderValue, StatusCode};
use chrono::Utc;
use serde::Serialize;
use tokio::fs;
use uuid::Uuid;

use crate::AppState;
use crate::middleware::auth::UserPermissions;
use crate::models::escape_like;
use crate::models::{Document, DocumentFilter};

#[derive(Debug, Serialize)]
pub struct UploadResponse {
    pub id: Uuid,
    pub filename: String,
    pub original_name: String,
    pub mime_type: Option<String>,
    pub file_size: i64,
    pub folder: Option<String>,
    pub created_at: chrono::DateTime<Utc>,
}

pub async fn upload_document(
    State(state): State<AppState>,
    claims: axum::extract::Extension<crate::middleware::auth::Claims>,
    perms: UserPermissions,
    mut multipart: Multipart,
) -> Result<(StatusCode, Json<UploadResponse>), StatusCode> {
    perms
        .require("documents.upload")
        .map_err(|_| StatusCode::FORBIDDEN)?;
    let mut original_name = String::new();
    let mut mime_type = Option::<String>::None;
    let mut file_size = 0i64;
    let mut file_data = Vec::new();
    let mut folder = Some("general".to_string());

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|_| StatusCode::BAD_REQUEST)?
    {
        let name = field.name().unwrap_or_default().to_string();
        match name.as_str() {
            "file" => {
                original_name = field.file_name().unwrap_or("unknown").to_string();
                mime_type = field.content_type().map(|m| m.to_string());

                let data = field.bytes().await.map_err(|_| StatusCode::BAD_REQUEST)?;
                file_size = data.len() as i64;
                file_data = data.to_vec();
            }
            "folder" => {
                let val = field.text().await.map_err(|_| StatusCode::BAD_REQUEST)?;
                if !val.is_empty() {
                    folder = Some(val);
                }
            }
            _ => {}
        }
    }

    if file_data.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let max_size = (state.upload.max_file_size_mb as i64) * 1024 * 1024;
    if file_size > max_size {
        return Err(StatusCode::PAYLOAD_TOO_LARGE);
    }

    let file_id = Uuid::new_v4();
    let ext = std::path::Path::new(&original_name)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("bin");
    let filename = format!("{}.{}", file_id, ext);

    let upload_dir = &state.upload.dir;
    fs::create_dir_all(upload_dir)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let file_path = std::path::Path::new(upload_dir).join(&filename);
    fs::write(&file_path, &file_data)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let user_id = Uuid::parse_str(&claims.sub).ok();

    let doc = sqlx::query_as::<_, Document>(
        r#"
        INSERT INTO documents (filename, original_name, mime_type, file_size, folder, uploaded_by)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, filename, original_name, mime_type, file_size, folder, uploaded_by, created_at, updated_at
        "#,
    )
    .bind(&filename)
    .bind(&original_name)
    .bind(&mime_type)
    .bind(file_size)
    .bind(&folder)
    .bind(user_id)
    .fetch_one(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok((
        StatusCode::CREATED,
        Json(UploadResponse {
            id: doc.id,
            filename: doc.filename,
            original_name: doc.original_name,
            mime_type: doc.mime_type,
            file_size: doc.file_size,
            folder: doc.folder,
            created_at: doc.created_at,
        }),
    ))
}

pub async fn list_documents(
    State(state): State<AppState>,
    perms: UserPermissions,
    Query(params): Query<DocumentFilter>,
) -> Result<Json<Vec<Document>>, StatusCode> {
    perms
        .require("documents.view")
        .map_err(|_| StatusCode::FORBIDDEN)?;
    let mut query = String::from(
        "SELECT id, filename, original_name, mime_type, file_size, folder, uploaded_by, created_at, updated_at FROM documents WHERE 1=1",
    );
    let mut bind_values: Vec<String> = Vec::new();
    let mut param_idx = 1;

    if let Some(ref folder) = params.folder {
        query.push_str(&format!(" AND folder = ${}", param_idx));
        bind_values.push(folder.clone());
        param_idx += 1;
    }

    if let Some(ref search) = params.search {
        let search_pattern = format!("%{}%", escape_like(search));
        query.push_str(&format!(
            " AND (original_name ILIKE ${} ESCAPE '\\')",
            param_idx
        ));
        bind_values.push(search_pattern);
        param_idx += 1;
    }

    if let Some(ref mime) = params.mime_type {
        query.push_str(&format!(" AND mime_type ILIKE ${}", param_idx));
        bind_values.push(format!("{}%", mime));
    }

    query.push_str(" ORDER BY created_at DESC");

    let mut q = sqlx::query_as::<_, Document>(&query);
    for val in &bind_values {
        q = q.bind(val);
    }

    let documents = q
        .fetch_all(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(documents))
}

pub async fn download_document(
    State(state): State<AppState>,
    perms: UserPermissions,
    Path(id): Path<Uuid>,
) -> Result<(HeaderMap, Vec<u8>), StatusCode> {
    perms
        .require("documents.view")
        .map_err(|_| StatusCode::FORBIDDEN)?;
    let doc = sqlx::query_as::<_, Document>(
        "SELECT id, filename, original_name, mime_type, file_size, folder, uploaded_by, created_at, updated_at FROM documents WHERE id = $1"
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .ok_or(StatusCode::NOT_FOUND)?;

    let file_path = std::path::Path::new(&state.upload.dir).join(&doc.filename);
    let data = fs::read(&file_path)
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;

    let mut headers = HeaderMap::new();
    headers.insert(
        "Content-Type",
        HeaderValue::from_str(
            doc.mime_type
                .as_deref()
                .unwrap_or("application/octet-stream"),
        )
        .unwrap_or_else(|_| HeaderValue::from_static("application/octet-stream")),
    );
    headers.insert(
        "Content-Disposition",
        HeaderValue::from_str(&format!(
            "attachment; filename=\"{}\"",
            doc.original_name.replace('"', "\\\"")
        ))
        .unwrap_or_else(|_| HeaderValue::from_static("attachment; filename=\"file\"")),
    );
    headers.insert(
        "Content-Length",
        HeaderValue::from_str(&doc.file_size.to_string()).unwrap(),
    );

    Ok((headers, data))
}

pub async fn delete_document(
    State(state): State<AppState>,
    perms: UserPermissions,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    perms
        .require("documents.delete")
        .map_err(|_| StatusCode::FORBIDDEN)?;
    let doc = sqlx::query_as::<_, Document>(
        "SELECT id, filename, original_name, mime_type, file_size, folder, uploaded_by, created_at, updated_at FROM documents WHERE id = $1"
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .ok_or(StatusCode::NOT_FOUND)?;

    let file_path = std::path::Path::new(&state.upload.dir).join(&doc.filename);
    let _ = fs::remove_file(&file_path).await;

    let result = sqlx::query("DELETE FROM documents WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    Ok(StatusCode::NO_CONTENT)
}
