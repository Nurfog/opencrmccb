use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Tag {
    pub id: Uuid,
    pub name: String,
    pub color: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateTag {
    #[validate(length(min = 1, max = 50))]
    pub name: String,
    pub color: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTag {
    pub name: Option<String>,
    pub color: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AssignTagRequest {
    pub tag_id: Uuid,
    pub entity_type: String,
    pub entity_id: Uuid,
}

#[derive(Debug, Serialize)]
pub struct EntityTag {
    pub tag: Tag,
    pub assigned_at: DateTime<Utc>,
}
