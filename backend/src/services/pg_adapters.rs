use sqlx::PgPool;
use uuid::Uuid;

use crate::error::AppError;
use crate::handlers::audit::insert_audit_log;
use crate::models::WebhookEvent;
use crate::services::domain_events::{AuditPort, DomainEvent, WebhookPort};
use crate::services::webhook_worker::enqueue_event;

pub struct PgAuditAdapter {
    pool: PgPool,
}

impl PgAuditAdapter {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait::async_trait]
impl AuditPort for PgAuditAdapter {
    async fn log(
        &self,
        user_id: Option<Uuid>,
        event: &DomainEvent,
        _ip_address: Option<&str>,
    ) -> Result<(), AppError> {
        insert_audit_log(
            &self.pool,
            user_id,
            &event.action,
            &event.entity_type,
            event.entity_id,
            event.old_values.clone(),
            event.new_values.clone(),
        )
        .await
        .map_err(|_| AppError::Internal("Failed to insert audit log".into()))
    }
}

pub struct PgWebhookAdapter {
    pool: PgPool,
}

impl PgWebhookAdapter {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait::async_trait]
impl WebhookPort for PgWebhookAdapter {
    async fn enqueue(
        &self,
        event: WebhookEvent,
        payload: serde_json::Value,
    ) -> Result<(), AppError> {
        enqueue_event(&self.pool, event, payload)
            .await
            .map_err(|_| AppError::Internal("Failed to enqueue webhook".into()))
    }
}
