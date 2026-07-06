use axum::Json;
use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use uuid::Uuid;
use validator::Validate;

use crate::AppState;
use crate::middleware::auth::{Claims, UserPermissions};
use crate::models::{
    CreateEmailTemplate, EmailLog, EmailTemplate, PaginatedResponse, PaginationParams, SendEmail,
    UpdateEmailTemplate,
};

// Send email
pub async fn send_email(
    State(state): State<AppState>,
    perms: UserPermissions,
    claims: axum::extract::Extension<Claims>,
    Json(input): Json<SendEmail>,
) -> Result<Json<EmailLog>, StatusCode> {
    perms
        .require("email.send")
        .map_err(|_| StatusCode::FORBIDDEN)?;
    input.validate().map_err(|_| StatusCode::BAD_REQUEST)?;

    // Get SMTP config from env
    let smtp_host = std::env::var("SMTP_HOST").unwrap_or_else(|_| "smtp.gmail.com".into());
    let smtp_port: u16 = std::env::var("SMTP_PORT")
        .unwrap_or_else(|_| "587".into())
        .parse()
        .unwrap_or(587);
    let smtp_user = std::env::var("SMTP_USER").unwrap_or_default();
    let smtp_pass = std::env::var("SMTP_PASSWORD").unwrap_or_default();
    let from_email = input
        .from
        .clone()
        .unwrap_or_else(|| std::env::var("SMTP_FROM").unwrap_or_else(|_| smtp_user.clone()));

    // Send via SMTP
    let send_result = crate::services::email::send_email(
        &smtp_host,
        smtp_port,
        &smtp_user,
        &smtp_pass,
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
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(log))
}

// List email logs
pub async fn list_email_logs(
    State(state): State<AppState>,
    Query(params): Query<PaginationParams>,
    perms: UserPermissions,
) -> Result<Json<PaginatedResponse<EmailLog>>, StatusCode> {
    perms
        .require("email.view")
        .map_err(|_| StatusCode::FORBIDDEN)?;
    let page = params.page();
    let per_page = params.per_page();
    let offset = params.offset();

    let total: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM email_logs")
        .fetch_one(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let logs = sqlx::query_as::<_, EmailLog>(
        "SELECT id, from_email, to_email, cc, bcc, subject, body, body_html, entity_type, entity_id, status, template_id, sent_by, sent_at, created_at
         FROM email_logs ORDER BY created_at DESC LIMIT $1 OFFSET $2",
    )
    .bind(per_page)
    .bind(offset)
    .fetch_all(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(PaginatedResponse::new(logs, total.0, page, per_page)))
}

// Get email log by ID
pub async fn get_email_log(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    perms: UserPermissions,
) -> Result<Json<EmailLog>, StatusCode> {
    perms
        .require("email.view")
        .map_err(|_| StatusCode::FORBIDDEN)?;
    let log = sqlx::query_as::<_, EmailLog>(
        "SELECT id, from_email, to_email, cc, bcc, subject, body, body_html, entity_type, entity_id, status, template_id, sent_by, sent_at, created_at
         FROM email_logs WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(log))
}

// List email templates
pub async fn list_templates(
    State(state): State<AppState>,
    perms: UserPermissions,
) -> Result<Json<Vec<EmailTemplate>>, StatusCode> {
    perms
        .require("email.view")
        .map_err(|_| StatusCode::FORBIDDEN)?;
    let templates = sqlx::query_as::<_, EmailTemplate>(
        "SELECT id, name, subject, body, body_html, category, created_by, created_at, updated_at
         FROM email_templates ORDER BY name",
    )
    .fetch_all(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(templates))
}

// Create email template
pub async fn create_template(
    State(state): State<AppState>,
    perms: UserPermissions,
    claims: axum::extract::Extension<Claims>,
    Json(input): Json<CreateEmailTemplate>,
) -> Result<(StatusCode, Json<EmailTemplate>), StatusCode> {
    perms
        .require("email.send")
        .map_err(|_| StatusCode::FORBIDDEN)?;
    input.validate().map_err(|_| StatusCode::BAD_REQUEST)?;

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
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok((StatusCode::CREATED, Json(template)))
}

// Update email template
pub async fn update_template(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    perms: UserPermissions,
    Json(input): Json<UpdateEmailTemplate>,
) -> Result<Json<EmailTemplate>, StatusCode> {
    perms
        .require("email.send")
        .map_err(|_| StatusCode::FORBIDDEN)?;
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
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(template))
}

// Delete email template
pub async fn delete_template(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    perms: UserPermissions,
) -> Result<StatusCode, StatusCode> {
    perms
        .require("email.send")
        .map_err(|_| StatusCode::FORBIDDEN)?;
    let result = sqlx::query("DELETE FROM email_templates WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    Ok(StatusCode::NO_CONTENT)
}

// Send email from template
pub async fn send_from_template(
    State(state): State<AppState>,
    Path(template_id): Path<Uuid>,
    perms: UserPermissions,
    Json(input): Json<SendEmail>,
) -> Result<Json<EmailLog>, StatusCode> {
    perms
        .require("email.send")
        .map_err(|_| StatusCode::FORBIDDEN)?;
    input.validate().map_err(|_| StatusCode::BAD_REQUEST)?;

    let template = sqlx::query_as::<_, EmailTemplate>(
        "SELECT id, name, subject, body, body_html, category, created_by, created_at, updated_at
         FROM email_templates WHERE id = $1",
    )
    .bind(template_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .ok_or(StatusCode::NOT_FOUND)?;

    // Simple variable replacement: {{name}}, {{email}}, etc.
    let subject = template.subject.replace("{{to}}", &input.to);
    let body = template.body.replace("{{to}}", &input.to);

    let smtp_host = std::env::var("SMTP_HOST").unwrap_or_else(|_| "smtp.gmail.com".into());
    let smtp_port: u16 = std::env::var("SMTP_PORT")
        .unwrap_or_else(|_| "587".into())
        .parse()
        .unwrap_or(587);
    let smtp_user = std::env::var("SMTP_USER").unwrap_or_default();
    let smtp_pass = std::env::var("SMTP_PASSWORD").unwrap_or_default();
    let from_email = input
        .from
        .clone()
        .unwrap_or_else(|| std::env::var("SMTP_FROM").unwrap_or_else(|_| smtp_user.clone()));

    let send_result = crate::services::email::send_email(
        &smtp_host,
        smtp_port,
        &smtp_user,
        &smtp_pass,
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
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(log))
}
