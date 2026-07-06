use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Serialize, Deserialize, sqlx::Type)]
#[serde(rename_all = "snake_case")]
#[sqlx(type_name = "webhook_event", rename_all = "snake_case")]
pub enum WebhookEvent {
    DealCreated,
    DealUpdated,
    DealDeleted,
    ContactCreated,
    ContactUpdated,
    ContactDeleted,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Webhook {
    pub id: Uuid,
    pub url: String,
    pub event: WebhookEvent,
    pub secret: Option<String>,
    pub active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateWebhook {
    #[validate(url(message = "URL must be valid"))]
    pub url: String,

    pub event: WebhookEvent,

    #[validate(length(max = 255, message = "Secret must be at most 255 characters"))]
    pub secret: Option<String>,
}
