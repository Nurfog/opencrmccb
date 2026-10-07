use crate::models::{WebhookEvent, WebhookStatus};
use chrono::{Duration, Utc};
use hmac::{Hmac, Mac};
use reqwest::{
    Client,
    header::{CONTENT_TYPE, HeaderMap, HeaderValue},
};
use sha2::Sha256;
use sqlx::PgPool;
use std::time::Duration as StdDuration;
use tracing::{error, info, warn};

type HmacSha256 = Hmac<Sha256>;

const MAX_ATTEMPTS: i32 = 3;
const MAX_RESPONSE_BODY_CHARS: usize = 4000;

/// SSRF guard: only allow public http/https webhook URLs.
/// Blocks metadata endpoints, loopback and RFC1918 private ranges.
pub fn is_webhook_url_allowed(url: &str) -> bool {
    let parsed = match reqwest::Url::parse(url) {
        Ok(u) => u,
        Err(_) => return false,
    };
    match parsed.scheme() {
        "http" | "https" => {}
        _ => return false,
    }
    let host = match parsed.host_str() {
        Some(h) => h.to_lowercase(),
        None => return false,
    };
    // Explicit blocklist.
    if host == "169.254.169.254"
        || host == "127.0.0.1"
        || host == "::1"
        || host == "localhost"
        || host == "0.0.0.0"
    {
        return false;
    }
    // RFC1918 / private ranges (string-prefix check covers common forms).
    if host.starts_with("10.") || host.starts_with("192.168.") || host == "10" || host == "0.0.0.0"
    {
        return false;
    }
    if host.starts_with("172.") {
        // 172.16.0.0/12
        if let Some(second) = host.split('.').nth(1).and_then(|s| s.parse::<u8>().ok())
            && (16..=31).contains(&second)
        {
            return false;
        }
    }
    // Block single-label / .local / .internal names conservatively.
    if !host.contains('.') && host != "localhost" {
        // Allow only if it looks like a public single-label? Be conservative: block.
        // (Most legit webhooks use FQDNs.)
        return false;
    }
    true
}

fn truncate_response_body(s: Option<String>) -> Option<String> {
    s.map(|mut v| {
        if v.len() > MAX_RESPONSE_BODY_CHARS {
            v.truncate(MAX_RESPONSE_BODY_CHARS);
        }
        v
    })
}

/// Helper function to enqueue a webhook event
pub async fn enqueue_event(
    pool: &PgPool,
    event: WebhookEvent,
    payload: serde_json::Value,
) -> Result<(), sqlx::Error> {
    let event_type_str = serde_json::to_value(&event)
        .unwrap()
        .as_str()
        .unwrap_or("unknown")
        .to_string();

    // 1. Find active webhooks subscribed to this event
    let webhooks: Vec<(uuid::Uuid,)> =
        sqlx::query_as("SELECT id FROM webhooks WHERE active = true AND event = $1")
            .bind(&event_type_str)
            .fetch_all(pool)
            .await?;

    if webhooks.is_empty() {
        return Ok(());
    }

    // 2. Insert delivery records for each webhook
    let mut tx = pool.begin().await?;

    for webhook in &webhooks {
        sqlx::query(
            "INSERT INTO webhook_deliveries (webhook_id, event_type, payload, status) VALUES ($1, $2, $3, 'pending')",
        )
        .bind(webhook.0)
        .bind(&event_type_str)
        .bind(payload.clone())
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

async fn process_pending_deliveries(
    pool: &PgPool,
    client: &Client,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    use sqlx::Row;

    // Select up to 50 pending deliveries that are due.
    // FOR UPDATE SKIP LOCKED lets multiple workers claim disjoint rows safely.
    let rows = sqlx::query(
        "SELECT d.id, d.webhook_id, d.payload, d.attempts, w.url, w.secret 
         FROM webhook_deliveries d
         JOIN webhooks w ON d.webhook_id = w.id
         WHERE d.status = 'pending' AND d.next_attempt_at <= NOW()
         ORDER BY d.next_attempt_at ASC
         LIMIT 50
         FOR UPDATE SKIP LOCKED",
    )
    .fetch_all(pool)
    .await?;

    if rows.is_empty() {
        return Ok(());
    }

    for row in rows {
        let delivery_id: uuid::Uuid = row.get("id");
        let _webhook_id: uuid::Uuid = row.get("webhook_id");
        let payload: serde_json::Value = row.get("payload");
        let attempts: i32 = row.get("attempts");
        let url: String = row.get("url");
        let secret: Option<String> = row.get("secret");

        // Mark as processing only if still pending (claim the row).
        let claimed = sqlx::query(
            "UPDATE webhook_deliveries SET status = 'processing', updated_at = NOW() WHERE id = $1 AND status = 'pending'",
        )
        .bind(delivery_id)
        .execute(pool)
        .await?;
        if claimed.rows_affected() == 0 {
            // Another worker claimed it via SKIP LOCKED race — skip.
            continue;
        }

        // SSRF guard: never dispatch to internal/metadata URLs.
        if !is_webhook_url_allowed(&url) {
            warn!(
                "Blocked webhook delivery {} to disallowed URL host",
                delivery_id
            );
            sqlx::query(
                "UPDATE webhook_deliveries
                 SET status = 'failed', attempts = $1, response_body = 'blocked: disallowed URL (SSRF guard)', updated_at = NOW()
                 WHERE id = $2",
            )
            .bind(attempts + 1)
            .bind(delivery_id)
            .execute(pool)
            .await?;
            continue;
        }

        // Prepare request
        let payload_str = payload.to_string();
        let mut headers = HeaderMap::new();
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));

        if let Some(ref secret_val) = secret
            && let Ok(mut mac) = HmacSha256::new_from_slice(secret_val.as_bytes())
        {
            mac.update(payload_str.as_bytes());
            let result = mac.finalize().into_bytes();
            let hex_sig = hex::encode(result);
            let header_val = format!("sha256={}", hex_sig);
            if let Ok(val) = HeaderValue::from_str(&header_val) {
                headers.insert("X-Hub-Signature-256", val);
            }
        }

        // Send request
        let result = client
            .post(&url)
            .headers(headers)
            .body(payload_str)
            .send()
            .await;

        let attempts = attempts + 1;
        let mut new_status = WebhookStatus::Failed;
        let mut response_status: Option<i32> = None;
        let mut response_body: Option<String> = None;
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

        let status_str = match new_status {
            WebhookStatus::Pending => "pending",
            WebhookStatus::Processing => "processing",
            WebhookStatus::Success => "success",
            WebhookStatus::Failed => "failed",
        };

        // Truncate response_body to 4000 chars to bound DB growth.
        let response_body = truncate_response_body(response_body);

        // Update record
        sqlx::query(
            "UPDATE webhook_deliveries 
             SET status = $1, attempts = $2, next_attempt_at = $3, response_status = $4, response_body = $5, updated_at = NOW()
             WHERE id = $6",
        )
        .bind(status_str)
        .bind(attempts)
        .bind(next_attempt_at)
        .bind(response_status)
        .bind(response_body)
        .bind(delivery_id)
        .execute(pool)
        .await?;

        if new_status == WebhookStatus::Failed {
            warn!(
                "Webhook delivery {} failed after {} attempts",
                delivery_id, attempts
            );
        } else if new_status == WebhookStatus::Success {
            info!("Webhook delivery {} succeeded", delivery_id);
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
