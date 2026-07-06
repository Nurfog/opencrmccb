use axum::Json;
use axum::body::Bytes;
use axum::extract::{Query, State};
use axum::http::{HeaderMap, StatusCode};
use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use uuid::Uuid;

use crate::AppState;
use crate::middleware::auth::{Claims, UserPermissions};
use crate::services::crypto::{decrypt, encrypt};

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct WhatsAppConfig {
    pub id: Uuid,
    pub phone_number_id: String,
    pub business_account_id: String,
    pub api_token: String,
    pub webhook_verify_token: Option<String>,
    pub phone_number: Option<String>,
    pub is_active: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Deserialize)]
pub struct WhatsAppConfigInput {
    pub phone_number_id: String,
    pub business_account_id: String,
    pub api_token: String,
    pub phone_number: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct WhatsAppConfigResponse {
    pub phone_number_id: String,
    pub business_account_id: String,
    pub phone_number: Option<String>,
    pub is_active: bool,
    pub webhook_verify_token: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SendMessageInput {
    pub to: String,
    pub content: String,
    pub contact_id: Option<Uuid>,
}

#[derive(Debug, Serialize)]
pub struct MessageResponse {
    pub id: Uuid,
    pub direction: String,
    pub from_number: String,
    pub to_number: String,
    pub content: String,
    pub status: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Deserialize)]
pub struct IncomingWebhook {
    pub entry: Option<Vec<WebhookEntry>>,
}

#[derive(Debug, Deserialize)]
pub struct WebhookEntry {
    pub changes: Option<Vec<WebhookChange>>,
}

#[derive(Debug, Deserialize)]
pub struct WebhookChange {
    pub value: Option<WebhookValue>,
}

#[derive(Debug, Deserialize)]
pub struct WebhookValue {
    pub messages: Option<Vec<WebhookMessage>>,
    pub metadata: Option<WebhookMetadata>,
}

#[derive(Debug, Deserialize)]
pub struct WebhookMessage {
    pub from: String,
    pub id: String,
    pub text: Option<WebhookText>,
    pub timestamp: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct WebhookText {
    pub body: String,
}

#[derive(Debug, Deserialize)]
pub struct WebhookMetadata {
    pub display_phone_number: Option<String>,
    pub phone_number_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct WebhookQuery {
    #[allow(dead_code)]
    #[serde(rename = "hub.mode")]
    pub mode: Option<String>,
    #[serde(rename = "hub.verify_token")]
    pub verify_token: Option<String>,
    #[serde(rename = "hub.challenge")]
    pub challenge: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct LeadAssignmentConfig {
    pub strategy: String,
    pub max_active_leads: i32,
    pub territory_enabled: bool,
    pub notify_on_assign: bool,
}

#[derive(Debug, Deserialize)]
pub struct LeadAssignmentInput {
    pub strategy: Option<String>,
    pub max_active_leads: Option<i32>,
    pub territory_enabled: Option<bool>,
    pub notify_on_assign: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct AgentAssignment {
    pub agent_id: Uuid,
    pub agent_name: String,
    pub lead_id: Uuid,
    pub lead_type: String,
    pub assigned_at: chrono::DateTime<chrono::Utc>,
    pub status: String,
}

#[derive(Debug, Deserialize)]
pub struct AssignLeadInput {
    pub lead_id: Uuid,
    pub lead_type: String,
    pub source: Option<String>,
}

/// GET /api/v1/integrations/whatsapp/config
pub async fn get_whatsapp_config(
    State(state): State<AppState>,
    _claims: axum::extract::Extension<Claims>,
    perms: UserPermissions,
) -> Result<Json<WhatsAppConfigResponse>, StatusCode> {
    perms
        .require("contacts.view")
        .map_err(|_| StatusCode::FORBIDDEN)?;
    let config = sqlx::query_as::<_, WhatsAppConfig>(
        "SELECT * FROM whatsapp_config WHERE is_active = true ORDER BY created_at DESC LIMIT 1",
    )
    .fetch_optional(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    match config {
        Some(c) => Ok(Json(WhatsAppConfigResponse {
            phone_number_id: c.phone_number_id,
            business_account_id: c.business_account_id,
            phone_number: c.phone_number,
            is_active: c.is_active,
            webhook_verify_token: c.webhook_verify_token,
        })),
        None => Err(StatusCode::NOT_FOUND),
    }
}

/// PUT /api/v1/integrations/whatsapp/config
pub async fn update_whatsapp_config(
    State(state): State<AppState>,
    _claims: axum::extract::Extension<Claims>,
    perms: UserPermissions,
    Json(input): Json<WhatsAppConfigInput>,
) -> Result<Json<WhatsAppConfigResponse>, StatusCode> {
    perms
        .require("contacts.view")
        .map_err(|_| StatusCode::FORBIDDEN)?;
    let singleton_id = Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap();
    let key = state.auth.token_encryption_key.as_deref();
    let enc_token = encrypt(&input.api_token, key);
    let config = sqlx::query_as::<_, WhatsAppConfig>(
        r#"
        INSERT INTO whatsapp_config (id, phone_number_id, business_account_id, api_token, phone_number)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (id) DO UPDATE
        SET phone_number_id = $2, business_account_id = $3, api_token = $4, phone_number = $5, updated_at = NOW()
        RETURNING *
        "#,
    )
    .bind(singleton_id)
    .bind(&input.phone_number_id)
    .bind(&input.business_account_id)
    .bind(&enc_token)
    .bind(&input.phone_number)
    .fetch_one(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(WhatsAppConfigResponse {
        phone_number_id: config.phone_number_id,
        business_account_id: config.business_account_id,
        phone_number: config.phone_number,
        is_active: config.is_active,
        webhook_verify_token: config.webhook_verify_token,
    }))
}

/// POST /api/v1/integrations/whatsapp/send
pub async fn send_whatsapp_message(
    State(state): State<AppState>,
    claims: axum::extract::Extension<Claims>,
    perms: UserPermissions,
    Json(input): Json<SendMessageInput>,
) -> Result<Json<MessageResponse>, StatusCode> {
    perms
        .require("contacts.view")
        .map_err(|_| StatusCode::FORBIDDEN)?;
    let agent_id = Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;

    let config = sqlx::query_as::<_, WhatsAppConfig>(
        "SELECT * FROM whatsapp_config WHERE is_active = true ORDER BY created_at DESC LIMIT 1",
    )
    .fetch_optional(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .ok_or(StatusCode::NOT_FOUND)?;

    let api_token = decrypt(
        &config.api_token,
        state.auth.token_encryption_key.as_deref(),
    );

    // Send via WhatsApp Business API
    let client = reqwest::Client::new();
    let url = format!(
        "https://graph.facebook.com/v21.0/{}/messages",
        config.phone_number_id
    );

    let body = serde_json::json!({
        "messaging_product": "whatsapp",
        "to": input.to,
        "type": "text",
        "text": { "body": input.content }
    });

    let resp = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_token))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await;

    let wa_message_id: Option<String> = if let Ok(r) = resp {
        if let Ok(json) = r.json::<serde_json::Value>().await {
            json["messages"][0]["id"].as_str().map(|s| s.to_string())
        } else {
            None
        }
    } else {
        None
    };

    let msg = sqlx::query_as::<_, (Uuid, String, String, String, String, String, chrono::DateTime<chrono::Utc>)>(
        r#"
        INSERT INTO whatsapp_messages (direction, from_number, to_number, content, message_id, contact_id, agent_id, status)
        VALUES ('outbound', $1, $2, $3, $4, $5, $6, $7)
        RETURNING id, direction, from_number, to_number, content, status, created_at
        "#,
    )
    .bind(config.phone_number.as_deref().unwrap_or(""))
    .bind(&input.to)
    .bind(&input.content)
    .bind(&wa_message_id)
    .bind(input.contact_id)
    .bind(agent_id)
    .bind(if wa_message_id.is_some() { "sent" } else { "failed" })
    .fetch_one(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(MessageResponse {
        id: msg.0,
        direction: msg.1,
        from_number: msg.2,
        to_number: msg.3,
        content: msg.4,
        status: msg.5,
        created_at: msg.6,
    }))
}

/// GET /api/v1/integrations/whatsapp/messages?contact_id=
pub async fn get_messages(
    State(state): State<AppState>,
    _claims: axum::extract::Extension<Claims>,
    perms: UserPermissions,
    Query(params): Query<MessageFilter>,
) -> Result<Json<Vec<MessageResponse>>, StatusCode> {
    perms
        .require("contacts.view")
        .map_err(|_| StatusCode::FORBIDDEN)?;
    let messages = if let Some(cid) = params.contact_id {
        sqlx::query_as::<_, (Uuid, String, String, String, String, String, chrono::DateTime<chrono::Utc>)>(
            "SELECT id, direction, from_number, to_number, content, status, created_at FROM whatsapp_messages WHERE contact_id = $1 ORDER BY created_at DESC LIMIT 100"
        )
        .bind(cid)
        .fetch_all(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    } else {
        sqlx::query_as::<_, (Uuid, String, String, String, String, String, chrono::DateTime<chrono::Utc>)>(
            "SELECT id, direction, from_number, to_number, content, status, created_at FROM whatsapp_messages ORDER BY created_at DESC LIMIT 50"
        )
        .fetch_all(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    };

    Ok(Json(
        messages
            .into_iter()
            .map(|m| MessageResponse {
                id: m.0,
                direction: m.1,
                from_number: m.2,
                to_number: m.3,
                content: m.4,
                status: m.5,
                created_at: m.6,
            })
            .collect(),
    ))
}

#[derive(Debug, Deserialize)]
pub struct MessageFilter {
    pub contact_id: Option<Uuid>,
}

/// GET /api/v1/integrations/whatsapp/webhook (verification)
pub async fn webhook_verify(
    State(state): State<AppState>,
    Query(query): Query<WebhookQuery>,
) -> Result<String, StatusCode> {
    let config = sqlx::query_as::<_, WhatsAppConfig>(
        "SELECT * FROM whatsapp_config WHERE is_active = true ORDER BY created_at DESC LIMIT 1",
    )
    .fetch_optional(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .ok_or(StatusCode::NOT_FOUND)?;

    match (query.mode, query.verify_token, query.challenge) {
        (Some(mode), Some(token), Some(challenge))
            if mode == "subscribe"
                && token == config.webhook_verify_token.as_deref().unwrap_or("") =>
        {
            Ok(challenge)
        }
        _ => Err(StatusCode::FORBIDDEN),
    }
}

/// POST /api/v1/integrations/whatsapp/webhook (incoming messages)
pub async fn webhook_receive(
    State(state): State<AppState>,
    headers: HeaderMap,
    body_bytes: Bytes,
) -> Result<StatusCode, StatusCode> {
    // Verify HMAC signature if WHATSAPP_APP_SECRET is configured
    if let Ok(app_secret) = std::env::var("WHATSAPP_APP_SECRET") {
        let signature_header = headers
            .get("x-hub-signature-256")
            .and_then(|v| v.to_str().ok())
            .ok_or(StatusCode::UNAUTHORIZED)?;

        let sig = signature_header
            .strip_prefix("sha256=")
            .ok_or(StatusCode::UNAUTHORIZED)?;

        let mac = Hmac::<Sha256>::new_from_slice(app_secret.as_bytes())
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        let sig_bytes = hex::decode(sig).map_err(|_| StatusCode::UNAUTHORIZED)?;
        mac.verify_slice(&sig_bytes)
            .map_err(|_| StatusCode::UNAUTHORIZED)?;
    }

    let body: IncomingWebhook =
        serde_json::from_slice(&body_bytes).map_err(|_| StatusCode::BAD_REQUEST)?;

    let config = sqlx::query_as::<_, WhatsAppConfig>(
        "SELECT * FROM whatsapp_config WHERE is_active = true ORDER BY created_at DESC LIMIT 1",
    )
    .fetch_optional(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .ok_or(StatusCode::NOT_FOUND)?;

    if let Some(entries) = body.entry {
        for entry in entries {
            if let Some(changes) = entry.changes {
                for change in changes {
                    if let Some(value) = change.value
                        && let Some(messages) = value.messages
                    {
                        for msg in messages {
                            let from = msg.from;
                            let content = msg
                                .text
                                .as_ref()
                                .map(|t| t.body.clone())
                                .unwrap_or_default();
                            let msg_id = msg.id;
                            let wa_ts = msg
                                .timestamp
                                .and_then(|ts| ts.parse::<i64>().ok())
                                .and_then(|secs| chrono::DateTime::from_timestamp(secs, 0));

                            // Find contact by phone
                            let contact_id: Option<Uuid> = sqlx::query_scalar(
                                    "SELECT id FROM contacts WHERE phone ILIKE $1 OR phone ILIKE $2 LIMIT 1"
                                )
                                .bind(format!("%{}", from))
                                .bind(format!("%{}", from.trim_start_matches('+')))
                                .fetch_optional(&state.db)
                                .await
                                .unwrap_or(None);

                            // Auto-assign lead if no agent assigned
                            let agent_id = if let Some(cid) = contact_id {
                                let assigned = sqlx::query_scalar::<_, Uuid>(
                                        "SELECT agent_id FROM agent_lead_assignments WHERE lead_id = $1 AND lead_type = 'contact' AND status = 'active' LIMIT 1"
                                    )
                                    .bind(cid)
                                    .fetch_optional(&state.db)
                                    .await
                                    .unwrap_or(None);

                                if assigned.is_none() {
                                    assign_lead_to_agent(&state, "contact", cid, "whatsapp").await
                                } else {
                                    assigned
                                }
                            } else {
                                None
                            };

                            let _ = sqlx::query(
                                    r#"
                                    INSERT INTO whatsapp_messages (direction, from_number, to_number, content, message_id, contact_id, agent_id, status, wa_timestamp)
                                    VALUES ('inbound', $1, $2, $3, $4, $5, $6, 'received', $7)
                                    ON CONFLICT (message_id) DO NOTHING
                                    "#
                                )
                                .bind(&from)
                                .bind(config.phone_number.as_deref().unwrap_or(""))
                                .bind(&content)
                                .bind(&msg_id)
                                .bind(contact_id)
                                .bind(agent_id)
                                .bind(wa_ts)
                                .execute(&state.db)
                                .await;
                        }
                    }
                }
            }
        }
    }

    Ok(StatusCode::OK)
}

async fn assign_lead_to_agent(
    state: &AppState,
    lead_type: &str,
    lead_id: Uuid,
    source: &str,
) -> Option<Uuid> {
    let config = sqlx::query_as::<_, (String, i32)>(
        "SELECT strategy, max_active_leads FROM lead_assignment_config LIMIT 1",
    )
    .fetch_optional(&state.db)
    .await
    .ok()??;

    let agent: Option<(Uuid,)> = match config.0.as_str() {
        "round_robin" => {
            sqlx::query_as::<_, (Uuid,)>(
                r#"
                SELECT u.id FROM users u
                WHERE u.id NOT IN (
                    SELECT u2.id FROM users u2
                    JOIN profile_permissions pp ON pp.profile_id = u2.profile_id
                    WHERE pp.permission = 'admin.access'
                )
                AND (
                    SELECT COUNT(*) FROM agent_lead_assignments ala
                    WHERE ala.agent_id = u.id AND ala.status = 'active'
                ) < $1
                ORDER BY (
                    SELECT COUNT(*) FROM agent_lead_assignments ala
                    WHERE ala.agent_id = u.id AND ala.created_at >= NOW() - INTERVAL '30 days'
                ) ASC
                LIMIT 1
                "#
            )
            .bind(config.1)
            .fetch_optional(&state.db)
            .await
            .map_err(|_| tracing::error!("round_robin query failed"))
            .unwrap_or(None)
        }
        "least_busy" => {
            sqlx::query_as::<_, (Uuid,)>(
                r#"
                SELECT u.id FROM users u
                LEFT JOIN agent_lead_assignments ala ON ala.agent_id = u.id AND ala.status = 'active'
                WHERE u.id NOT IN (
                    SELECT u2.id FROM users u2
                    JOIN profile_permissions pp ON pp.profile_id = u2.profile_id
                    WHERE pp.permission = 'admin.access'
                )
                GROUP BY u.id
                HAVING COUNT(ala.id) < $1
                ORDER BY COUNT(ala.id) ASC
                LIMIT 1
                "#
            )
            .bind(config.1)
            .fetch_optional(&state.db)
            .await
            .map_err(|_| tracing::error!("least_busy query failed"))
            .unwrap_or(None)
        }
        _ => None,
    };

    let agent_id = agent?.0;
    let _ = sqlx::query(
        r#"
        INSERT INTO agent_lead_assignments (agent_id, lead_id, lead_type, source, status)
        VALUES ($1, $2, $3, $4, 'active')
        ON CONFLICT (lead_id, lead_type) DO UPDATE SET agent_id = $1, source = $4
        "#,
    )
    .bind(agent_id)
    .bind(lead_id)
    .bind(lead_type)
    .bind(source)
    .execute(&state.db)
    .await;

    Some(agent_id)
}

/// GET /api/v1/settings/lead-assignment
pub async fn get_lead_assignment_config(
    State(state): State<AppState>,
    _claims: axum::extract::Extension<Claims>,
    perms: UserPermissions,
) -> Result<Json<LeadAssignmentConfig>, StatusCode> {
    perms
        .require("contacts.view")
        .map_err(|_| StatusCode::FORBIDDEN)?;
    let config = sqlx::query_as::<_, (String, i32, bool, bool)>(
        "SELECT strategy, max_active_leads, territory_enabled, notify_on_assign FROM lead_assignment_config LIMIT 1"
    )
    .fetch_optional(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .unwrap_or(("round_robin".into(), 10, false, true));

    Ok(Json(LeadAssignmentConfig {
        strategy: config.0,
        max_active_leads: config.1,
        territory_enabled: config.2,
        notify_on_assign: config.3,
    }))
}

/// PUT /api/v1/settings/lead-assignment
pub async fn update_lead_assignment_config(
    State(state): State<AppState>,
    _claims: axum::extract::Extension<Claims>,
    perms: UserPermissions,
    Json(input): Json<LeadAssignmentInput>,
) -> Result<Json<LeadAssignmentConfig>, StatusCode> {
    perms
        .require("contacts.view")
        .map_err(|_| StatusCode::FORBIDDEN)?;
    let strategy = input.strategy.unwrap_or_else(|| "round_robin".into());
    let max_leads = input.max_active_leads.unwrap_or(10);
    let territory = input.territory_enabled.unwrap_or(false);
    let notify = input.notify_on_assign.unwrap_or(true);

    let singleton_id = Uuid::parse_str("00000000-0000-0000-0000-000000000002").unwrap();
    sqlx::query(
        r#"
        INSERT INTO lead_assignment_config (id, strategy, max_active_leads, territory_enabled, notify_on_assign)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (id) DO UPDATE
        SET strategy = $2, max_active_leads = $3, territory_enabled = $4, notify_on_assign = $5, updated_at = NOW()
        "#
    )
    .bind(singleton_id)
    .bind(&strategy)
    .bind(max_leads)
    .bind(territory)
    .bind(notify)
    .execute(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(LeadAssignmentConfig {
        strategy,
        max_active_leads: max_leads,
        territory_enabled: territory,
        notify_on_assign: notify,
    }))
}

/// POST /api/v1/settings/lead-assignment/assign
pub async fn assign_lead(
    State(state): State<AppState>,
    _claims: axum::extract::Extension<Claims>,
    perms: UserPermissions,
    Json(input): Json<AssignLeadInput>,
) -> Result<Json<AgentAssignment>, StatusCode> {
    perms
        .require("contacts.view")
        .map_err(|_| StatusCode::FORBIDDEN)?;
    let agent_id = assign_lead_to_agent(
        &state,
        &input.lead_type,
        input.lead_id,
        input.source.as_deref().unwrap_or("manual"),
    )
    .await
    .ok_or(StatusCode::INTERNAL_SERVER_ERROR)?;

    let agent_name = sqlx::query_scalar::<_, String>(
        "SELECT first_name || ' ' || last_name FROM users WHERE id = $1",
    )
    .bind(agent_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .unwrap_or_default();

    Ok(Json(AgentAssignment {
        agent_id,
        agent_name,
        lead_id: input.lead_id,
        lead_type: input.lead_type,
        assigned_at: chrono::Utc::now(),
        status: "active".into(),
    }))
}

/// GET /api/v1/integrations/whatsapp/conversations
pub async fn list_conversations(
    State(state): State<AppState>,
    _claims: axum::extract::Extension<Claims>,
    perms: UserPermissions,
) -> Result<Json<Vec<ConversationSummary>>, StatusCode> {
    perms
        .require("contacts.view")
        .map_err(|_| StatusCode::FORBIDDEN)?;
    let rows = sqlx::query_as::<_, ConversationRow>(
        r#"
        SELECT DISTINCT ON (wm.from_number)
            wm.from_number,
            c.id as contact_id,
            c.first_name || ' ' || c.last_name as contact_name,
            wm.content as last_message,
            wm.created_at as last_message_at,
            wm.direction as last_direction,
            ala.agent_id
        FROM whatsapp_messages wm
        LEFT JOIN contacts c ON c.id = wm.contact_id
        LEFT JOIN agent_lead_assignments ala ON ala.lead_id = wm.contact_id AND ala.lead_type = 'contact'
        ORDER BY wm.from_number, wm.created_at DESC
        "#
    )
    .fetch_all(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(
        rows.into_iter()
            .map(|r| ConversationSummary {
                phone: r.from_number,
                contact_id: r.contact_id,
                contact_name: r.contact_name,
                last_message: r.last_message,
                last_message_at: r.last_message_at,
                last_direction: r.last_direction,
            })
            .collect(),
    ))
}

#[derive(Debug, sqlx::FromRow)]
struct ConversationRow {
    from_number: String,
    contact_id: Option<Uuid>,
    contact_name: Option<String>,
    last_message: String,
    last_message_at: chrono::DateTime<chrono::Utc>,
    last_direction: String,
}

#[derive(Debug, Serialize)]
pub struct ConversationSummary {
    pub phone: String,
    pub contact_id: Option<Uuid>,
    pub contact_name: Option<String>,
    pub last_message: String,
    pub last_message_at: chrono::DateTime<chrono::Utc>,
    pub last_direction: String,
}
