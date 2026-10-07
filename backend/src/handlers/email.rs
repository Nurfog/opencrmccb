use axum::Json;
use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use uuid::Uuid;
use validator::Validate;

use crate::AppState;
use crate::error::AppError;
use crate::middleware::auth::{Claims, UserPermissions};
use crate::models::{
    CreateEmailTemplate, EmailLog, EmailTemplate, PaginatedResponse, PaginationParams, SendEmail,
    UpdateEmailTemplate,
};

/// Resolve the effective `From` address: always force `smtp.from` unless
/// `input.from` is explicitly whitelisted via `SMTP_FROM_WHITELIST`
/// (comma-separated). Prevents arbitrary sender spoofing.
fn resolve_from(input_from: Option<&str>, smtp_from: &str) -> String {
    if let Some(candidate) = input_from.map(str::trim).filter(|s| !s.is_empty()) {
        let whitelist = std::env::var("SMTP_FROM_WHITELIST").unwrap_or_default();
        let allowed = whitelist
            .split(',')
            .map(str::trim)
            .any(|w| !w.is_empty() && w.eq_ignore_ascii_case(candidate));
        if allowed {
            return candidate.to_string();
        }
        if candidate != smtp_from {
            tracing::warn!("Ignoring custom email `from` (not whitelisted); forcing smtp.from");
        }
    }
    smtp_from.to_string()
}

fn is_valid_email(addr: &str) -> bool {
    // Basic RFC-like check without extra deps: local@domain.tld
    let parts: Vec<&str> = addr.split('@').collect();
    if parts.len() != 2 {
        return false;
    }
    let (local, domain) = (parts[0].trim(), parts[1].trim());
    if local.is_empty() || domain.is_empty() {
        return false;
    }
    if local.len() > 64 || addr.len() > 254 {
        return false;
    }
    domain.contains('.') && !domain.starts_with('.') && !domain.ends_with('.')
}

fn validate_email_list(field: &str, value: Option<&str>) -> Result<(), AppError> {
    if let Some(list) = value.map(str::trim).filter(|s| !s.is_empty()) {
        for addr in list.split(',').map(str::trim).filter(|s| !s.is_empty()) {
            if !is_valid_email(addr) {
                return Err(AppError::BadRequest(format!(
                    "Invalid {field} email: {addr}"
                )));
            }
        }
    }
    Ok(())
}

// Send email
pub async fn send_email(
    State(state): State<AppState>,
    perms: UserPermissions,
    claims: axum::extract::Extension<Claims>,
    Json(input): Json<SendEmail>,
) -> Result<Json<EmailLog>, AppError> {
    perms
        .require("email.send")
        .map_err(|_| AppError::Forbidden)?;
    input.validate()?;
    validate_email_list("cc", input.cc.as_deref())?;
    validate_email_list("bcc", input.bcc.as_deref())?;

    // Force smtp.from unless whitelisted.
    let from_email = resolve_from(input.from.as_deref(), &state.smtp.from);

    // Send via SMTP
    let send_result = crate::services::email::send_email(
        &state.smtp.host,
        state.smtp.port,
        &state.smtp.user,
        &state.smtp.password,
        &from_email,
        &input.to,
        &input.subject,
        &input.body,
    )
    .await;

    let status = match send_result {
        Ok(()) => "sent",
        Err(_) => "failed",
    };

    // Log to DB
    let log = sqlx::query_as::<_, EmailLog>(
        "INSERT INTO email_logs (from_email, to_email, cc, bcc, subject, body, body_html, entity_type, entity_id, status, template_id, sent_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING id, from_email, to_email, cc, bcc, subject, body, body_html, entity_type, entity_id, status, template_id, sent_by, sent_at, created_at",
    )
    .bind(&from_email)
    .bind(&input.to)
    .bind(&input.cc)
    .bind(&input.bcc)
    .bind(&input.subject)
    .bind(&input.body)
    .bind(&input.body_html)
    .bind(&input.entity_type)
    .bind(input.entity_id)
    .bind(status)
    .bind(input.template_id)
    .bind(Some(Uuid::parse_str(&claims.sub).ok()))
    .fetch_one(&state.db)
    .await?;

    Ok(Json(log))
}

// List email logs
pub async fn list_email_logs(
    State(state): State<AppState>,
    Query(params): Query<PaginationParams>,
    perms: UserPermissions,
) -> Result<Json<PaginatedResponse<EmailLog>>, AppError> {
    perms
        .require("email.view")
        .map_err(|_| AppError::Forbidden)?;
    let page = params.page();
    let per_page = params.per_page();
    let offset = params.offset();

    let total: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM email_logs")
        .fetch_one(&state.db)
        .await?;

    let logs = sqlx::query_as::<_, EmailLog>(
        "SELECT id, from_email, to_email, cc, bcc, subject, body, body_html, entity_type, entity_id, status, template_id, sent_by, sent_at, created_at
         FROM email_logs ORDER BY created_at DESC LIMIT $1 OFFSET $2",
    )
    .bind(per_page)
    .bind(offset)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(PaginatedResponse::new(logs, total.0, page, per_page)))
}

// Get email log by ID
pub async fn get_email_log(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    perms: UserPermissions,
) -> Result<Json<EmailLog>, AppError> {
    perms
        .require("email.view")
        .map_err(|_| AppError::Forbidden)?;
    let log = sqlx::query_as::<_, EmailLog>(
        "SELECT id, from_email, to_email, cc, bcc, subject, body, body_html, entity_type, entity_id, status, template_id, sent_by, sent_at, created_at
         FROM email_logs WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(Json(log))
}

// List email templates
pub async fn list_templates(
    State(state): State<AppState>,
    perms: UserPermissions,
) -> Result<Json<Vec<EmailTemplate>>, AppError> {
    perms
        .require("email.view")
        .map_err(|_| AppError::Forbidden)?;
    let templates = sqlx::query_as::<_, EmailTemplate>(
        "SELECT id, name, subject, body, body_html, category, created_by, created_at, updated_at
         FROM email_templates ORDER BY name",
    )
    .fetch_all(&state.db)
    .await?;

    Ok(Json(templates))
}

// Create email template
pub async fn create_template(
    State(state): State<AppState>,
    perms: UserPermissions,
    claims: axum::extract::Extension<Claims>,
    Json(input): Json<CreateEmailTemplate>,
) -> Result<(StatusCode, Json<EmailTemplate>), AppError> {
    perms
        .require("email.send")
        .map_err(|_| AppError::Forbidden)?;
    input.validate()?;

    let template = sqlx::query_as::<_, EmailTemplate>(
        "INSERT INTO email_templates (name, subject, body, body_html, category, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, name, subject, body, body_html, category, created_by, created_at, updated_at",
    )
    .bind(&input.name)
    .bind(&input.subject)
    .bind(&input.body)
    .bind(&input.body_html)
    .bind(input.category.unwrap_or_else(|| "general".into()))
    .bind(Some(Uuid::parse_str(&claims.sub).ok()))
    .fetch_one(&state.db)
    .await?;

    Ok((StatusCode::CREATED, Json(template)))
}

// Update email template
pub async fn update_template(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    perms: UserPermissions,
    Json(input): Json<UpdateEmailTemplate>,
) -> Result<Json<EmailTemplate>, AppError> {
    perms
        .require("email.send")
        .map_err(|_| AppError::Forbidden)?;
    let template = sqlx::query_as::<_, EmailTemplate>(
        "UPDATE email_templates SET
            name = COALESCE($2, name),
            subject = COALESCE($3, subject),
            body = COALESCE($4, body),
            body_html = COALESCE($5, body_html),
            category = COALESCE($6, category),
            updated_at = NOW()
         WHERE id = $1
         RETURNING id, name, subject, body, body_html, category, created_by, created_at, updated_at",
    )
    .bind(id)
    .bind(&input.name)
    .bind(&input.subject)
    .bind(&input.body)
    .bind(&input.body_html)
    .bind(&input.category)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(Json(template))
}

// Delete email template
pub async fn delete_template(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    perms: UserPermissions,
) -> Result<StatusCode, AppError> {
    perms
        .require("email.send")
        .map_err(|_| AppError::Forbidden)?;
    let result = sqlx::query("DELETE FROM email_templates WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(StatusCode::NO_CONTENT)
}

// Send email from template
pub async fn send_from_template(
    State(state): State<AppState>,
    Path(template_id): Path<Uuid>,
    perms: UserPermissions,
    Json(input): Json<SendEmail>,
) -> Result<Json<EmailLog>, AppError> {
    perms
        .require("email.send")
        .map_err(|_| AppError::Forbidden)?;
    input.validate()?;
    validate_email_list("cc", input.cc.as_deref())?;
    validate_email_list("bcc", input.bcc.as_deref())?;

    let template = sqlx::query_as::<_, EmailTemplate>(
        "SELECT id, name, subject, body, body_html, category, created_by, created_at, updated_at
         FROM email_templates WHERE id = $1",
    )
    .bind(template_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    // Simple variable replacement: {{name}}, {{email}}, etc.
    let subject = template.subject.replace("{{to}}", &input.to);
    let body = template.body.replace("{{to}}", &input.to);

    // Force smtp.from unless whitelisted.
    let from_email = resolve_from(input.from.as_deref(), &state.smtp.from);

    let send_result = crate::services::email::send_email(
        &state.smtp.host,
        state.smtp.port,
        &state.smtp.user,
        &state.smtp.password,
        &from_email,
        &input.to,
        &subject,
        &body,
    )
    .await;

    let status = match send_result {
        Ok(()) => "sent",
        Err(_) => "failed",
    };

    let log = sqlx::query_as::<_, EmailLog>(
        "INSERT INTO email_logs (from_email, to_email, subject, body, body_html, entity_type, entity_id, status, template_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, from_email, to_email, cc, bcc, subject, body, body_html, entity_type, entity_id, status, template_id, sent_by, sent_at, created_at",
    )
    .bind(&from_email)
    .bind(&input.to)
    .bind(&subject)
    .bind(&body)
    .bind(&template.body_html)
    .bind(&input.entity_type)
    .bind(input.entity_id)
    .bind(status)
    .bind(template_id)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(log))
}
