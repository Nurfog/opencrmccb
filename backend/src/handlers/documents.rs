use axum::Json;
use axum::extract::{Multipart, Path, Query, State};
use axum::http::{HeaderMap, HeaderValue, StatusCode};
use chrono::Utc;
use serde::Serialize;
use tokio::fs;
use uuid::Uuid;

use crate::AppState;
use crate::error::AppError;
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

const ALLOWED_EXTENSIONS: &[&str] = &[
    "pdf", "png", "jpg", "jpeg", "gif", "webp", "txt", "csv", "doc", "docx", "xls", "xlsx", "ppt",
    "pptx", "odt", "ods", "zip",
];
const BLOCKED_EXTENSIONS: &[&str] = &[
    "html", "htm", "svg", "js", "php", "exe", "sh", "bat", "msi", "dll", "so",
];

pub async fn upload_document(
    State(state): State<AppState>,
    claims: axum::extract::Extension<crate::middleware::auth::Claims>,
    perms: UserPermissions,
    mut multipart: Multipart,
) -> Result<(StatusCode, Json<UploadResponse>), AppError> {
    perms
        .require("documents.upload")
        .map_err(|_| AppError::Forbidden)?;
    let mut original_name = String::new();
    let mut mime_type = Option::<String>::None;
    let mut file_size = 0i64;
    let mut file_data = Vec::new();
    let mut folder = Some("general".to_string());
    let max_size = (state.upload.max_file_size_mb as i64) * 1024 * 1024;

    while let Some(mut field) = multipart
        .next_field()
        .await
        .map_err(|e| AppError::BadRequest(format!("Multipart error: {e}")))?
    {
        let name = field.name().unwrap_or_default().to_string();
        match name.as_str() {
            "file" => {
                original_name = field.file_name().unwrap_or("unknown").to_string();
                mime_type = field.content_type().map(|m| m.to_string());

                // Stream chunks and enforce size limit *while* reading (no OOM).
                let mut buf = Vec::new();
                while let Some(chunk) = field
                    .chunk()
                    .await
                    .map_err(|e| AppError::BadRequest(format!("Failed to read file: {e}")))?
                {
                    if (buf.len() as i64) + (chunk.len() as i64) > max_size {
                        return Err(AppError::BadRequest("File too large".into()));
                    }
                    buf.extend_from_slice(&chunk);
                }
                file_size = buf.len() as i64;
                file_data = buf;
            }
            "folder" => {
                let val = field
                    .text()
                    .await
                    .map_err(|e| AppError::BadRequest(format!("Failed to read folder: {e}")))?;
                if !val.is_empty() {
                    folder = Some(val);
                }
            }
            _ => {}
        }
    }

    if file_data.is_empty() {
        return Err(AppError::BadRequest("No file provided".into()));
    }

    if file_size > max_size {
        return Err(AppError::BadRequest("File too large".into()));
    }

    let file_id = Uuid::new_v4();
    let raw_ext = std::path::Path::new(&original_name)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("bin")
        .to_lowercase();
    // Block executable / active-content types even if allowlisted elsewhere.
    if BLOCKED_EXTENSIONS.contains(&raw_ext.as_str()) {
        return Err(AppError::BadRequest("File type not allowed".into()));
    }
    if !ALLOWED_EXTENSIONS.contains(&raw_ext.as_str()) {
        return Err(AppError::BadRequest("File type not allowed".into()));
    }
    // Sanitize folder to prevent path traversal.
    if let Some(ref f) = folder
        && (f.contains('/') || f.contains('\\') || f.contains(".."))
    {
        return Err(AppError::BadRequest("Invalid folder".into()));
    }
    let filename = format!("{}.{}", file_id, raw_ext);

    let upload_dir = &state.upload.dir;
    fs::create_dir_all(upload_dir).await?;

    let file_path = std::path::Path::new(upload_dir).join(&filename);
    fs::write(&file_path, &file_data).await?;

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
    .await?;

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
) -> Result<Json<Vec<Document>>, AppError> {
    perms
        .require("documents.view")
        .map_err(|_| AppError::Forbidden)?;
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
        // Escape LIKE wildcards in user-supplied mime filter to avoid unintended matches.
        query.push_str(&format!(" AND mime_type ILIKE ${} ESCAPE '\\'", param_idx));
        bind_values.push(format!("{}%", escape_like(mime)));
    }

    query.push_str(" ORDER BY created_at DESC");

    let mut q = sqlx::query_as::<_, Document>(&query);
    for val in &bind_values {
        q = q.bind(val);
    }

    let documents = q.fetch_all(&state.db).await?;

    Ok(Json(documents))
}

pub async fn download_document(
    State(state): State<AppState>,
    perms: UserPermissions,
    Path(id): Path<Uuid>,
) -> Result<(HeaderMap, Vec<u8>), AppError> {
    perms
        .require("documents.view")
        .map_err(|_| AppError::Forbidden)?;
    let doc = sqlx::query_as::<_, Document>(
        "SELECT id, filename, original_name, mime_type, file_size, folder, uploaded_by, created_at, updated_at FROM documents WHERE id = $1"
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    let file_path = std::path::Path::new(&state.upload.dir).join(&doc.filename);
    let data = fs::read(&file_path).await?;

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
        HeaderValue::from_str(&doc.file_size.to_string())
            .unwrap_or_else(|_| HeaderValue::from_static("0")),
    );
    headers.insert(
        "X-Content-Type-Options",
        HeaderValue::from_static("nosniff"),
    );

    Ok((headers, data))
}

pub async fn delete_document(
    State(state): State<AppState>,
    perms: UserPermissions,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    perms
        .require("documents.delete")
        .map_err(|_| AppError::Forbidden)?;
    let doc = sqlx::query_as::<_, Document>(
        "SELECT id, filename, original_name, mime_type, file_size, folder, uploaded_by, created_at, updated_at FROM documents WHERE id = $1"
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    let file_path = std::path::Path::new(&state.upload.dir).join(&doc.filename);
    let _ = fs::remove_file(&file_path).await;

    let result = sqlx::query("DELETE FROM documents WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(StatusCode::NO_CONTENT)
}
