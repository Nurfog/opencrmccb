use crate::models::{WebhookEvent, WebhookStatus};
use chrono::{Duration, Utc};
use hmac::{Hmac, Mac};
use reqwest::{Client, header::{HeaderMap, HeaderValue, CONTENT_TYPE}};
use sha2::Sha256;
use sqlx::PgPool;
use std::time::Duration as StdDuration;
use tracing::{error, info, warn};
use uuid::Uuid;

type HmacSha256 = Hmac<Sha256>;

const MAX_ATTEMPTS: i32 = 3;

/// Helper function to enqueue a webhook event
pub async fn enqueue_event(pool: &PgPool, event: WebhookEvent, payload: serde_json::Value) -> Result<(), sqlx::Error> {
    // 1. Find active webhooks subscribed to this event
    let webhooks = sqlx::query!(
        "SELECT id, event FROM webhooks WHERE active = true AND event = $1",
        event as WebhookEvent
    )
    .fetch_all(pool)
    .await?;

    if webhooks.is_empty() {
        return Ok(());
    }

    // 2. Insert delivery records for each webhook
    let mut tx = pool.begin().await?;

    let event_type_str = serde_json::to_value(&event).unwrap().as_str().unwrap_or("unknown").to_string();

    for webhook in webhooks {
        sqlx::query!(
            "INSERT INTO webhook_deliveries (webhook_id, event_type, payload, status) VALUES ($1, $2, $3, 'pending')",
            webhook.id,
            event_type_str,
            payload.clone() as serde_json::Value
        )
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    Ok(())
}

/// The background worker loop
pub async fn start_worker(pool: PgPool) {
    let client = Client::builder()
        .timeout(StdDuration::from_secs(10))
        .build()
        .unwrap_or_default();

    info!("Webhook delivery worker started");

    loop {
        if let Err(e) = process_pending_deliveries(&pool, &client).await {
            error!("Error processing webhook deliveries: {}", e);
        }

        // Wait before checking again
        tokio::time::sleep(StdDuration::from_secs(5)).await;
    }
}

async fn process_pending_deliveries(pool: &PgPool, client: &Client) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // Select up to 50 pending deliveries that are due
    let deliveries = sqlx::query!(
        "SELECT d.id, d.webhook_id, d.payload, d.attempts, w.url, w.secret 
         FROM webhook_deliveries d
         JOIN webhooks w ON d.webhook_id = w.id
         WHERE d.status = 'pending' AND d.next_attempt_at <= NOW()
         ORDER BY d.next_attempt_at ASC
         LIMIT 50"
    )
    .fetch_all(pool)
    .await?;

    if deliveries.is_empty() {
        return Ok(());
    }

    for delivery in deliveries {
        // Mark as processing
        sqlx::query!(
            "UPDATE webhook_deliveries SET status = 'processing', updated_at = NOW() WHERE id = $1",
            delivery.id
        )
        .execute(pool)
        .await?;

        // Prepare request
        let payload_str = delivery.payload.to_string();
        let mut headers = HeaderMap::new();
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));

        if let Some(secret) = &delivery.secret {
            if let Ok(mut mac) = HmacSha256::new_from_slice(secret.as_bytes()) {
                mac.update(payload_str.as_bytes());
                let result = mac.finalize().into_bytes();
                let hex_sig = hex::encode(result);
                let header_val = format!("sha256={}", hex_sig);
                if let Ok(val) = HeaderValue::from_str(&header_val) {
                    headers.insert("X-Hub-Signature-256", val);
                }
            }
        }

        // Send request
        let result = client
            .post(&delivery.url)
            .headers(headers)
            .body(payload_str)
            .send()
            .await;

        let attempts = delivery.attempts + 1;
        let mut new_status = WebhookStatus::Failed;
        let mut response_status = None;
        let mut response_body = None;
        let mut next_attempt_at = Utc::now();

        match result {
            Ok(res) => {
                let status = res.status();
                response_status = Some(status.as_u16() as i32);
                
                if status.is_success() {
                    new_status = WebhookStatus::Success;
                } else {
                    response_body = res.text().await.ok();
                    if attempts < MAX_ATTEMPTS {
                        new_status = WebhookStatus::Pending;
                        next_attempt_at = calculate_backoff(attempts);
                    }
                }
            }
            Err(e) => {
                response_body = Some(e.to_string());
                if attempts < MAX_ATTEMPTS {
                    new_status = WebhookStatus::Pending;
                    next_attempt_at = calculate_backoff(attempts);
                }
            }
        }

        // Update record
        sqlx::query!(
            "UPDATE webhook_deliveries 
             SET status = $1, attempts = $2, next_attempt_at = $3, response_status = $4, response_body = $5, updated_at = NOW()
             WHERE id = $6",
            new_status as WebhookStatus,
            attempts,
            next_attempt_at,
            response_status,
            response_body,
            delivery.id
        )
        .execute(pool)
        .await?;
        
        if new_status == WebhookStatus::Failed {
            warn!("Webhook delivery {} failed after {} attempts", delivery.id, attempts);
        } else if new_status == WebhookStatus::Success {
            info!("Webhook delivery {} succeeded", delivery.id);
        }
    }

    Ok(())
}

fn calculate_backoff(attempt: i32) -> chrono::DateTime<Utc> {
    let now = Utc::now();
    // Intento 1: falla -> reprogramar para 1 min (60s)
    // Intento 2: falla -> reprogramar para 5 min (300s)
    // Intento 3: falla -> ya no reprograma (MAX_ATTEMPTS = 3)
    let delay_secs = match attempt {
        1 => 60,
        2 => 300,
        _ => 3600,
    };
    now + Duration::seconds(delay_secs)
}
