use axum::Json;
use axum::extract::{Query, State};
use axum::http::StatusCode;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::AppState;
use crate::middleware::auth::{Claims, UserPermissions};
use crate::services::crypto::{decrypt, encrypt};

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct AIConfig {
    pub id: Uuid,
    pub provider: String,
    pub api_url: String,
    pub api_key: Option<String>,
    pub model: String,
    pub is_active: bool,
}

#[derive(Debug, Deserialize)]
pub struct AIConfigInput {
    pub provider: Option<String>,
    pub api_url: Option<String>,
    pub api_key: Option<String>,
    pub model: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AIConfigResponse {
    pub provider: String,
    pub api_url: String,
    pub model: String,
    pub is_active: bool,
}

#[derive(Debug, Serialize)]
pub struct LeadExtraction {
    pub id: Uuid,
    pub phone_number: String,
    pub contact_id: Option<Uuid>,
    pub extracted_data: serde_json::Value,
    pub status: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Deserialize)]
pub struct ExtractLeadInput {
    pub phone_number: String,
}

// ─── AI Config ──────────────────────────────────────────────────

pub async fn get_ai_config(
    State(state): State<AppState>,
    _claims: axum::extract::Extension<Claims>,
    perms: UserPermissions,
) -> Result<Json<AIConfigResponse>, StatusCode> {
    perms.require("ai.use").map_err(|_| StatusCode::FORBIDDEN)?;
    let config = sqlx::query_as::<_, AIConfig>(
        "SELECT * FROM ai_config WHERE is_active = true ORDER BY created_at DESC LIMIT 1",
    )
    .fetch_optional(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    match config {
        Some(c) => Ok(Json(AIConfigResponse {
            provider: c.provider,
            api_url: c.api_url,
            model: c.model,
            is_active: c.is_active,
        })),
        None => Ok(Json(AIConfigResponse {
            provider: "ollama".into(),
            api_url: "http://localhost:11434".into(),
            model: "llama3.2".into(),
            is_active: false,
        })),
    }
}

pub async fn update_ai_config(
    State(state): State<AppState>,
    _claims: axum::extract::Extension<Claims>,
    perms: UserPermissions,
    Json(input): Json<AIConfigInput>,
) -> Result<Json<AIConfigResponse>, StatusCode> {
    perms.require("ai.use").map_err(|_| StatusCode::FORBIDDEN)?;
    let key = state.auth.token_encryption_key.as_deref();
    let enc_key = input.api_key.as_ref().map(|k| encrypt(k, key));
    let existing =
        sqlx::query_scalar::<_, Uuid>("SELECT id FROM ai_config ORDER BY created_at DESC LIMIT 1")
            .fetch_optional(&state.db)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if let Some(id) = existing {
        sqlx::query(
            r#"
            UPDATE ai_config
            SET provider = COALESCE($2, provider),
                api_url = COALESCE($3, api_url),
                api_key = COALESCE($4, api_key),
                model = COALESCE($5, model),
                is_active = true,
                updated_at = NOW()
            WHERE id = $1
            "#,
        )
        .bind(id)
        .bind(&input.provider)
        .bind(&input.api_url)
        .bind(&enc_key)
        .bind(&input.model)
        .execute(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    } else {
        sqlx::query(
            r#"
            INSERT INTO ai_config (provider, api_url, api_key, model, is_active)
            VALUES ($1, $2, $3, $4, true)
            "#,
        )
        .bind(input.provider.unwrap_or_else(|| "ollama".into()))
        .bind(
            input
                .api_url
                .unwrap_or_else(|| "http://localhost:11434".into()),
        )
        .bind(&enc_key)
        .bind(input.model.unwrap_or_else(|| "llama3.2".into()))
        .execute(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    }

    let config =
        sqlx::query_as::<_, AIConfig>("SELECT * FROM ai_config ORDER BY created_at DESC LIMIT 1")
            .fetch_one(&state.db)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(AIConfigResponse {
        provider: config.provider,
        api_url: config.api_url,
        model: config.model,
        is_active: config.is_active,
    }))
}

// ─── Lead Extraction ────────────────────────────────────────────

/// Pending extractions for a phone number
pub async fn get_extractions(
    State(state): State<AppState>,
    _claims: axum::extract::Extension<Claims>,
    perms: UserPermissions,
    Query(params): Query<ExtractionFilter>,
) -> Result<Json<Vec<LeadExtraction>>, StatusCode> {
    perms.require("ai.use").map_err(|_| StatusCode::FORBIDDEN)?;
    let rows = sqlx::query_as::<_, LeadExtractionRow>(
        r#"
        SELECT id, phone_number, contact_id, extracted_data, status, created_at
        FROM lead_extractions
        WHERE ($1::text IS NULL OR phone_number = $1)
        ORDER BY created_at DESC
        LIMIT 20
        "#,
    )
    .bind(&params.phone_number)
    .fetch_all(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(
        rows.into_iter()
            .map(|r| LeadExtraction {
                id: r.id,
                phone_number: r.phone_number,
                contact_id: r.contact_id,
                extracted_data: r.extracted_data,
                status: r.status,
                created_at: r.created_at,
            })
            .collect(),
    ))
}

/// Extract lead data from WhatsApp conversation using AI
pub async fn extract_lead(
    State(state): State<AppState>,
    claims: axum::extract::Extension<Claims>,
    perms: UserPermissions,
    Json(input): Json<ExtractLeadInput>,
) -> Result<Json<LeadExtraction>, StatusCode> {
    perms.require("ai.use").map_err(|_| StatusCode::FORBIDDEN)?;
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;

    // Get AI config
    let ai = sqlx::query_as::<_, AIConfig>(
        "SELECT * FROM ai_config WHERE is_active = true ORDER BY created_at DESC LIMIT 1",
    )
    .fetch_optional(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .ok_or(StatusCode::NOT_FOUND)?;

    // Get conversation messages
    let messages: Vec<String> = sqlx::query_scalar(
        r#"
        SELECT content FROM whatsapp_messages
        WHERE from_number = $1 OR to_number = $1
        ORDER BY created_at ASC
        LIMIT 50
        "#,
    )
    .bind(&input.phone_number)
    .fetch_all(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if messages.is_empty() {
        return Err(StatusCode::NOT_FOUND);
    }

    let conversation = messages.join("\n");
    let system_prompt = r#"Eres un asistente de CRM. Extrae información de contacto de una conversación de WhatsApp y devuelve SOLO un JSON con estos campos:
{
  "first_name": "string",
  "last_name": "string",
  "email": "string | null",
  "phone": "string",
  "company": "string | null",
  "position": "string | null",
  "interest": "string | null",
  "notes": "string | null"
}
Usa null si no encuentras el dato. Responde ÚNICAMENTE con el JSON."#;

    let extracted = call_llm(
        &ai,
        system_prompt,
        &conversation,
        state.auth.token_encryption_key.as_deref(),
    )
    .await
    .map_err(|_| StatusCode::BAD_GATEWAY)?;

    let extracted_data: serde_json::Value = serde_json::from_str(&extracted).unwrap_or_else(|_| {
        serde_json::json!({
            "raw": extracted,
            "error": "failed to parse AI response"
        })
    });

    // Try to create contact
    let contact_id = try_create_contact(&state, &extracted_data, &input.phone_number).await;

    let row = sqlx::query_as::<_, LeadExtractionRow>(
        r#"
        INSERT INTO lead_extractions (phone_number, contact_id, raw_messages, extracted_data, status)
        VALUES ($1, $2, $3, $4, 'completed')
        RETURNING id, phone_number, contact_id, extracted_data, status, created_at
        "#
    )
    .bind(&input.phone_number)
    .bind(contact_id)
    .bind(&conversation)
    .bind(&extracted_data)
    .fetch_one(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // If contact was created, log audit
    if let Some(cid) = contact_id {
        let _ = crate::handlers::audit::insert_audit_log(
            &state,
            Some(user_id),
            "lead_extracted",
            "contact",
            cid,
            None,
            Some(extracted_data.clone()),
        )
        .await;
    }

    Ok(Json(LeadExtraction {
        id: row.id,
        phone_number: row.phone_number,
        contact_id: row.contact_id,
        extracted_data: row.extracted_data,
        status: row.status,
        created_at: row.created_at,
    }))
}

// ─── Helpers ────────────────────────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct LeadExtractionRow {
    id: Uuid,
    phone_number: String,
    contact_id: Option<Uuid>,
    extracted_data: serde_json::Value,
    status: String,
    created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Deserialize)]
pub struct ExtractionFilter {
    pub phone_number: Option<String>,
}

async fn call_llm(
    config: &AIConfig,
    system: &str,
    conversation: &str,
    token_encryption_key: Option<&[u8]>,
) -> Result<String, ()> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|_| ())?;
    let prompt = format!("{}\n\n---\n{}", system, conversation);

    match config.provider.as_str() {
        "openai" | "anthropic" => {
            let api_key_raw = config.api_key.as_ref().ok_or(())?;
            let api_key = decrypt(api_key_raw, token_encryption_key);
            let body = serde_json::json!({
                "model": config.model,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": conversation}
                ],
                "temperature": 0.1,
            });
            let headers = match config.provider.as_str() {
                "openai" => ("Authorization", format!("Bearer {}", api_key)),
                "anthropic" => ("x-api-key", api_key),
                _ => return Err(()),
            };
            let resp = client
                .post(format!(
                    "{}/v1/chat/completions",
                    config.api_url.trim_end_matches('/')
                ))
                .header(headers.0, headers.1)
                .header("Content-Type", "application/json")
                .json(&body)
                .send()
                .await
                .map_err(|_| ())?
                .json::<serde_json::Value>()
                .await
                .map_err(|_| ())?;
            Ok(resp["choices"][0]["message"]["content"]
                .as_str()
                .unwrap_or("{}")
                .to_string())
        }
        _ => {
            // Ollama
            let body = serde_json::json!({
                "model": config.model,
                "prompt": prompt,
                "stream": false,
                "temperature": 0.1,
            });
            let resp = client
                .post(format!(
                    "{}/api/generate",
                    config.api_url.trim_end_matches('/')
                ))
                .header("Content-Type", "application/json")
                .json(&body)
                .send()
                .await
                .map_err(|_| ())?
                .json::<serde_json::Value>()
                .await
                .map_err(|_| ())?;
            Ok(resp["response"].as_str().unwrap_or("{}").to_string())
        }
    }
}

async fn try_create_contact(
    state: &AppState,
    data: &serde_json::Value,
    phone: &str,
) -> Option<Uuid> {
    let first_name = data["first_name"].as_str().filter(|s| !s.is_empty())?;
    let last_name = data["last_name"].as_str().unwrap_or("");
    let email = data["email"]
        .as_str()
        .and_then(|s| if s.is_empty() { None } else { Some(s) });
    let position = data["position"]
        .as_str()
        .and_then(|s| if s.is_empty() { None } else { Some(s) });
    let notes = data["notes"]
        .as_str()
        .and_then(|s| if s.is_empty() { None } else { Some(s) });

    sqlx::query_scalar::<_, Uuid>(
        r#"
        INSERT INTO contacts (first_name, last_name, email, phone, position, notes)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT DO NOTHING
        RETURNING id
        "#,
    )
    .bind(first_name)
    .bind(last_name)
    .bind(email)
    .bind(phone)
    .bind(position)
    .bind(notes)
    .fetch_optional(&state.db)
    .await
    .ok()?
}
