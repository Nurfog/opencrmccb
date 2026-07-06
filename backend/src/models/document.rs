use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Document {
    pub id: Uuid,
    pub filename: String,
    pub original_name: String,
    pub mime_type: Option<String>,
    pub file_size: i64,
    pub folder: Option<String>,
    pub uploaded_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateDocument {
    pub filename: String,
    pub original_name: String,
    pub mime_type: Option<String>,
    pub file_size: i64,
    pub folder: Option<String>,
    pub uploaded_by: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct DocumentFilter {
    pub folder: Option<String>,
    pub search: Option<String>,
    pub mime_type: Option<String>,
}
