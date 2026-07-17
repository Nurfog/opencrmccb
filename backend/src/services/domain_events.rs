use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::AppError;
use crate::models::WebhookEvent;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DomainEvent {
    pub action: String,
    pub entity_type: String,
    pub entity_id: Uuid,
    pub old_values: Option<serde_json::Value>,
    pub new_values: Option<serde_json::Value>,
}

#[async_trait::async_trait]
pub trait AuditPort: Send + Sync {
    async fn log(
        &self,
        user_id: Option<Uuid>,
        event: &DomainEvent,
        ip_address: Option<&str>,
    ) -> Result<(), AppError>;
}

#[async_trait::async_trait]
pub trait WebhookPort: Send + Sync {
    async fn enqueue(
        &self,
        event: WebhookEvent,
        payload: serde_json::Value,
    ) -> Result<(), AppError>;
}

pub struct DomainEventBus<A: AuditPort, W: WebhookPort> {
    audit: A,
    webhook: W,
}

impl<A: AuditPort, W: WebhookPort> DomainEventBus<A, W> {
    pub fn new(audit: A, webhook: W) -> Self {
        Self { audit, webhook }
    }

    pub async fn emit(
        &self,
        user_id: Option<Uuid>,
        event: DomainEvent,
        webhook_event: WebhookEvent,
        ip_address: Option<&str>,
    ) {
        let _ = self.audit.log(user_id, &event, ip_address).await;

        let payload = event.new_values.unwrap_or_default();
        if let Err(e) = self.webhook.enqueue(webhook_event, payload).await {
            tracing::warn!("Failed to enqueue webhook: {e}");
        }
    }
}
