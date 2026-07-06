use axum::Json;
use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

use crate::AppState;
use crate::handlers::audit::insert_audit_log;
use crate::middleware::auth::{Claims, UserPermissions};
use crate::models::{
    Contact, ConvertLead, ConvertLeadResult, CreateLead, CreateLeadActivity, Lead, LeadActivity,
    LeadStatus, PaginatedResponse, UpdateLead, escape_like,
};

#[derive(Debug, Deserialize)]
pub struct LeadQuery {
    pub page: Option<i64>,
    pub per_page: Option<i64>,
    pub search: Option<String>,
    pub status: Option<LeadStatus>,
    pub lead_source: Option<String>,
    pub assigned_to: Option<Uuid>,
    pub sort: Option<String>,
    pub sort_dir: Option<String>,
}

impl LeadQuery {
    fn page(&self) -> i64 {
        self.page.unwrap_or(1).max(1)
    }
    fn per_page(&self) -> i64 {
        self.per_page.unwrap_or(20).clamp(1, 100)
    }
    fn offset(&self) -> i64 {
        (self.page() - 1) * self.per_page()
    }
    fn sort_column(&self) -> &str {
        match self.sort.as_deref() {
            Some("name") => "first_name",
            Some("company") => "company_name",
            Some("score") => "score",
            Some("source") => "lead_source",
            Some("created") => "created_at",
            _ => "created_at",
        }
    }
    fn sort_direction(&self) -> &str {
        match self.sort_dir.as_deref() {
            Some("asc") => "ASC",
            _ => "DESC",
        }
    }
}

pub async fn list_leads(
    State(state): State<AppState>,
    perms: UserPermissions,
    Query(params): Query<LeadQuery>,
) -> Result<Json<PaginatedResponse<Lead>>, StatusCode> {
    perms
        .require("leads.view")
        .map_err(|_| StatusCode::FORBIDDEN)?;
    let page = params.page();
    let per_page = params.per_page();
    let offset = params.offset();
    let sort_col = params.sort_column();
    let sort_dir = params.sort_direction();

    let mut conditions = Vec::new();
    let mut bind_values: Vec<String> = Vec::new();
    let mut param_idx = 1;

    if let Some(ref search) = params.search {
        let search_pattern = format!("%{}%", escape_like(search));
        bind_values.push(search_pattern);
        let idx = param_idx;
        param_idx += 1;
        conditions.push(format!(
            "(first_name ILIKE ${} ESCAPE '\\' OR last_name ILIKE ${} ESCAPE '\\' OR email ILIKE ${} ESCAPE '\\' OR company_name ILIKE ${} ESCAPE '\\')",
            idx, idx, idx, idx
        ));
    }

    if let Some(ref status) = params.status {
        let status_str = serde_json::to_string(status).unwrap_or_else(|_| "\"new\"".into());
        let status_val = status_str.trim_matches('"').to_string();
        bind_values.push(status_val);
        let idx = param_idx;
        param_idx += 1;
        conditions.push(format!("status = ${}::lead_status", idx));
    }

    if let Some(ref source) = params.lead_source {
        bind_values.push(source.clone());
        let idx = param_idx;
        param_idx += 1;
        conditions.push(format!("lead_source = ${}::lead_source", idx));
    }

    if let Some(assigned) = params.assigned_to {
        bind_values.push(assigned.to_string());
        let idx = param_idx;
        conditions.push(format!("assigned_to = ${}", idx));
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    };

    let count_query = format!("SELECT COUNT(*) FROM leads {}", where_clause);
    let data_query =
        format!(
        "SELECT id, first_name, last_name, email, phone, company_name, title, industry, website,
                lead_source, status, score, assigned_to, converted_at, converted_contact_id,
                converted_company_id, converted_deal_id, notes, created_at, updated_at
         FROM leads {} ORDER BY {} {} LIMIT ${} OFFSET ${}",
        where_clause, sort_col, sort_dir, param_idx, param_idx + 1
    );

    let mut count_q = sqlx::query_scalar::<_, i64>(&count_query);
    let mut data_q = sqlx::query_as::<_, Lead>(&data_query);

    for val in &bind_values {
        count_q = count_q.bind(val);
        data_q = data_q.bind(val);
    }

    let total: i64 = count_q
        .fetch_one(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let leads = data_q
        .bind(per_page)
        .bind(offset)
        .fetch_all(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(PaginatedResponse::new(leads, total, page, per_page)))
}

pub async fn get_lead(
    State(state): State<AppState>,
    perms: UserPermissions,
    Path(id): Path<Uuid>,
) -> Result<Json<Lead>, StatusCode> {
    perms
        .require("leads.view")
        .map_err(|_| StatusCode::FORBIDDEN)?;
    let lead = sqlx::query_as::<_, Lead>(
        "SELECT id, first_name, last_name, email, phone, company_name, title, industry, website,
                lead_source, status, score, assigned_to, converted_at, converted_contact_id,
                converted_company_id, converted_deal_id, notes, created_at, updated_at
         FROM leads WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(lead))
}

pub async fn create_lead(
    State(state): State<AppState>,
    claims: axum::extract::Extension<Claims>,
    perms: UserPermissions,
    Json(input): Json<CreateLead>,
) -> Result<(StatusCode, Json<Lead>), StatusCode> {
    perms
        .require("leads.create")
        .map_err(|_| StatusCode::FORBIDDEN)?;
    input.validate().map_err(|_| StatusCode::BAD_REQUEST)?;

    let lead = sqlx::query_as::<_, Lead>(
        "INSERT INTO leads (first_name, last_name, email, phone, company_name, title, industry, website, lead_source, assigned_to, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id, first_name, last_name, email, phone, company_name, title, industry, website,
                   lead_source, status, score, assigned_to, converted_at, converted_contact_id,
                   converted_company_id, converted_deal_id, notes, created_at, updated_at",
    )
    .bind(&input.first_name)
    .bind(&input.last_name)
    .bind(&input.email)
    .bind(&input.phone)
    .bind(&input.company_name)
    .bind(&input.title)
    .bind(&input.industry)
    .bind(&input.website)
    .bind(input.lead_source.as_ref().unwrap_or(&crate::models::LeadSource::Other))
    .bind(input.assigned_to)
    .bind(&input.notes)
    .fetch_one(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let user_id = Uuid::parse_str(&claims.0.sub).ok();
    let _ = insert_audit_log(
        &state,
        user_id,
        "create",
        "lead",
        lead.id,
        None,
        Some(serde_json::json!(lead)),
    )
    .await;

    Ok((StatusCode::CREATED, Json(lead)))
}

pub async fn update_lead(
    State(state): State<AppState>,
    claims: axum::extract::Extension<Claims>,
    perms: UserPermissions,
    Path(id): Path<Uuid>,
    Json(input): Json<UpdateLead>,
) -> Result<Json<Lead>, StatusCode> {
    perms
        .require("leads.edit")
        .map_err(|_| StatusCode::FORBIDDEN)?;
    input.validate().map_err(|_| StatusCode::BAD_REQUEST)?;

    let existing = sqlx::query_as::<_, Lead>(
        "SELECT id, first_name, last_name, email, phone, company_name, title, industry, website,
                lead_source, status, score, assigned_to, converted_at, converted_contact_id,
                converted_company_id, converted_deal_id, notes, created_at, updated_at
         FROM leads WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .ok_or(StatusCode::NOT_FOUND)?;

    // Validate status progression
    if let Some(ref new_status) = input.status {
        let allowed = match (&existing.status, new_status) {
            // Forward progression
            (LeadStatus::New, LeadStatus::Contacted) => true,
            (LeadStatus::Contacted, LeadStatus::Qualified) => true,
            // Disqualify at any point
            (_, LeadStatus::Unqualified) => true,
            (LeadStatus::Unqualified, LeadStatus::Recycled) => true,
            _ => false,
        };

        if !allowed {
            return Err(StatusCode::BAD_REQUEST);
        }
    }

    let lead = sqlx::query_as::<_, Lead>(
        "UPDATE leads SET
            first_name = COALESCE($2, first_name),
            last_name = COALESCE($3, last_name),
            email = COALESCE($4, email),
            phone = COALESCE($5, phone),
            company_name = COALESCE($6, company_name),
            title = COALESCE($7, title),
            industry = COALESCE($8, industry),
            website = COALESCE($9, website),
            lead_source = COALESCE($10, lead_source),
            status = COALESCE($11, status),
            score = COALESCE($12, score),
            assigned_to = COALESCE($13, assigned_to),
            notes = COALESCE($14, notes),
            updated_at = NOW()
         WHERE id = $1
         RETURNING id, first_name, last_name, email, phone, company_name, title, industry, website,
                   lead_source, status, score, assigned_to, converted_at, converted_contact_id,
                   converted_company_id, converted_deal_id, notes, created_at, updated_at",
    )
    .bind(id)
    .bind(&input.first_name)
    .bind(&input.last_name)
    .bind(&input.email)
    .bind(&input.phone)
    .bind(&input.company_name)
    .bind(&input.title)
    .bind(&input.industry)
    .bind(&input.website)
    .bind(input.lead_source.as_ref())
    .bind(input.status.as_ref())
    .bind(input.score)
    .bind(input.assigned_to)
    .bind(&input.notes)
    .fetch_one(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let user_id = Uuid::parse_str(&claims.0.sub).ok();
    let _ = insert_audit_log(
        &state,
        user_id,
        "update",
        "lead",
        id,
        Some(serde_json::json!(existing)),
        Some(serde_json::json!(lead)),
    )
    .await;

    Ok(Json(lead))
}

pub async fn delete_lead(
    State(state): State<AppState>,
    claims: axum::extract::Extension<Claims>,
    perms: UserPermissions,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    perms
        .require("leads.delete")
        .map_err(|_| StatusCode::FORBIDDEN)?;
    let result = sqlx::query("DELETE FROM leads WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    let user_id = Uuid::parse_str(&claims.0.sub).ok();
    let _ = insert_audit_log(&state, user_id, "delete", "lead", id, None, None).await;

    Ok(StatusCode::NO_CONTENT)
}

pub async fn convert_lead(
    State(state): State<AppState>,
    claims: axum::extract::Extension<Claims>,
    perms: UserPermissions,
    Path(id): Path<Uuid>,
    Json(input): Json<ConvertLead>,
) -> Result<Json<ConvertLeadResult>, StatusCode> {
    perms
        .require("leads.convert")
        .map_err(|_| StatusCode::FORBIDDEN)?;

    let mut tx = state
        .db
        .begin()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let lead = sqlx::query_as::<_, Lead>(
        "SELECT id, first_name, last_name, email, phone, company_name, title, industry, website,
                lead_source, status, score, assigned_to, converted_at, converted_contact_id,
                converted_company_id, converted_deal_id, notes, created_at, updated_at
         FROM leads WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .ok_or(StatusCode::NOT_FOUND)?;

    // Only qualified leads can be converted
    if lead.status != LeadStatus::Qualified {
        return Err(StatusCode::BAD_REQUEST);
    }

    // Fetch pipeline to determine entity type
    let pipeline_info =
        sqlx::query_as::<_, (String,)>("SELECT entity_type FROM pipelines WHERE id = $1")
            .bind(input.pipeline_id)
            .fetch_optional(&mut *tx)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
            .ok_or(StatusCode::BAD_REQUEST)?;

    let is_company = pipeline_info.0 == "company";

    // Fetch pipeline's default stage
    let default_stage: Option<(Uuid,)> = sqlx::query_as(
        "SELECT id FROM pipeline_stages WHERE pipeline_id = $1 AND is_default = true LIMIT 1",
    )
    .bind(input.pipeline_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    #[allow(unused_assignments)]
    let mut company_id: Option<Uuid> = None;
    #[allow(unused_assignments)]
    let mut contact_id: Option<Uuid> = None;
    #[allow(unused_assignments)]
    let mut deal_id: Option<Uuid> = None;

    // Create company if persona jurídica
    if is_company {
        let company = sqlx::query_as::<_, crate::models::Company>(
            "INSERT INTO companies (name, industry, website, phone, email)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, name, industry, website, phone, email, address, city, country, notes, created_at, updated_at",
        )
        .bind(lead.company_name.as_deref().unwrap_or("Unknown"))
        .bind(&lead.industry)
        .bind(&lead.website)
        .bind(&lead.phone)
        .bind(&lead.email)
        .fetch_one(&mut *tx)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        company_id = Some(company.id);
    }

    // Create contact (always)
    let parts: Vec<&str> = lead.last_name.split_whitespace().collect();
    let last_name = parts.first().copied().unwrap_or(&lead.last_name);

    let contact = sqlx::query_as::<_, Contact>(
        "INSERT INTO contacts (first_name, last_name, email, phone, company_id, position)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, first_name, last_name, email, phone, company_id, position, notes, created_at, updated_at",
    )
    .bind(&lead.first_name)
    .bind(last_name)
    .bind(&lead.email)
    .bind(&lead.phone)
    .bind(company_id)
    .bind(&lead.title)
    .fetch_one(&mut *tx)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    contact_id = Some(contact.id);

    // Create deal (always)
    let deal_title = input.deal_title.clone().unwrap_or_else(|| {
        format!(
            "{} {} - {}",
            lead.first_name,
            lead.last_name,
            lead.company_name.as_deref().unwrap_or("Lead")
        )
    });

    let deal = sqlx::query_as::<_, crate::models::Deal>(
        "INSERT INTO deals (title, value, stage, contact_id, company_id, pipeline_id, pipeline_stage_id, notes)
         VALUES ($1, $2, 'qualified', $3, $4, $5, $6, $7)
         RETURNING id, title, value, currency, stage, position, contact_id, company_id,
                   pipeline_id, pipeline_stage_id, expected_close_date, notes, created_at, updated_at",
    )
    .bind(&deal_title)
    .bind(input.deal_value.unwrap_or(rust_decimal::Decimal::ZERO))
    .bind(contact_id)
    .bind(company_id)
    .bind(input.pipeline_id)
    .bind(default_stage.map(|s| s.0))
    .bind(format!("Converted from lead: {}", lead.id))
    .fetch_one(&mut *tx)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    deal_id = Some(deal.id);

    // Update lead status
    sqlx::query(
        "UPDATE leads SET status = 'converted', converted_at = NOW(),
            converted_contact_id = $2, converted_company_id = $3, converted_deal_id = $4, updated_at = NOW()
         WHERE id = $1",
    )
    .bind(id)
    .bind(contact_id)
    .bind(company_id)
    .bind(deal_id)
    .execute(&mut *tx)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    tx.commit()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let user_id = Uuid::parse_str(&claims.0.sub).ok();
    let _ = insert_audit_log(&state, user_id, "convert", "lead", id,
        Some(serde_json::json!(lead)),
        Some(serde_json::json!({"contact_id": contact_id, "company_id": company_id, "deal_id": deal_id})),
    ).await;

    Ok(Json(ConvertLeadResult {
        contact_id,
        company_id,
        deal_id,
    }))
}

// Lead Activities
pub async fn list_lead_activities(
    State(state): State<AppState>,
    perms: UserPermissions,
    Path(lead_id): Path<Uuid>,
) -> Result<Json<Vec<LeadActivity>>, StatusCode> {
    perms
        .require("leads.view")
        .map_err(|_| StatusCode::FORBIDDEN)?;
    let activities = sqlx::query_as::<_, LeadActivity>(
        "SELECT id, lead_id, type, subject, description, due_date, completed, created_by, created_at
         FROM lead_activities WHERE lead_id = $1 ORDER BY created_at DESC",
    )
    .bind(lead_id)
    .fetch_all(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(activities))
}

pub async fn create_lead_activity(
    State(state): State<AppState>,
    claims: axum::extract::Extension<Claims>,
    perms: UserPermissions,
    Path(lead_id): Path<Uuid>,
    Json(input): Json<CreateLeadActivity>,
) -> Result<(StatusCode, Json<LeadActivity>), StatusCode> {
    perms
        .require("leads.create")
        .map_err(|_| StatusCode::FORBIDDEN)?;
    input.validate().map_err(|_| StatusCode::BAD_REQUEST)?;

    // Verify lead exists
    let exists = sqlx::query_scalar::<_, bool>("SELECT EXISTS(SELECT 1 FROM leads WHERE id = $1)")
        .bind(lead_id)
        .fetch_one(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if !exists {
        return Err(StatusCode::NOT_FOUND);
    }

    let created_by = Uuid::parse_str(&claims.0.sub).ok();
    let activity = sqlx::query_as::<_, LeadActivity>(
        "INSERT INTO lead_activities (lead_id, type, subject, description, due_date, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, lead_id, type, subject, description, due_date, completed, created_by, created_at",
    )
    .bind(lead_id)
    .bind(&input.r#type)
    .bind(&input.subject)
    .bind(&input.description)
    .bind(input.due_date)
    .bind(created_by)
    .fetch_one(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok((StatusCode::CREATED, Json(activity)))
}

pub async fn complete_lead_activity(
    State(state): State<AppState>,
    perms: UserPermissions,
    Path((lead_id, activity_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, StatusCode> {
    perms
        .require("leads.edit")
        .map_err(|_| StatusCode::FORBIDDEN)?;
    let result =
        sqlx::query("UPDATE lead_activities SET completed = TRUE WHERE id = $1 AND lead_id = $2")
            .bind(activity_id)
            .bind(lead_id)
            .execute(&state.db)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    Ok(StatusCode::OK)
}

pub async fn delete_lead_activity(
    State(state): State<AppState>,
    perms: UserPermissions,
    Path((lead_id, activity_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, StatusCode> {
    perms
        .require("leads.delete")
        .map_err(|_| StatusCode::FORBIDDEN)?;
    let result = sqlx::query("DELETE FROM lead_activities WHERE id = $1 AND lead_id = $2")
        .bind(activity_id)
        .bind(lead_id)
        .execute(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    Ok(StatusCode::NO_CONTENT)
}

// Lead stats
#[derive(Debug, Serialize)]
pub struct LeadStats {
    pub total: i64,
    pub new: i64,
    pub contacted: i64,
    pub qualified: i64,
    pub converted: i64,
    pub conversion_rate: f64,
    pub by_source: Vec<SourceCount>,
}

#[derive(Debug, Serialize)]
pub struct SourceCount {
    pub source: String,
    pub count: i64,
}

pub async fn lead_stats(
    State(state): State<AppState>,
    perms: UserPermissions,
) -> Result<Json<LeadStats>, StatusCode> {
    perms
        .require("leads.view")
        .map_err(|_| StatusCode::FORBIDDEN)?;
    let total: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM leads")
        .fetch_one(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let new: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM leads WHERE status = 'new'")
        .fetch_one(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let contacted: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM leads WHERE status = 'contacted'")
        .fetch_one(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let qualified: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM leads WHERE status = 'qualified'")
        .fetch_one(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let converted: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM leads WHERE status = 'converted'")
        .fetch_one(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let conversion_rate = if total.0 > 0 {
        (converted.0 as f64 / total.0 as f64) * 100.0
    } else {
        0.0
    };

    let by_source = sqlx::query_as::<_, (String, i64)>(
        "SELECT lead_source::text, COUNT(*) FROM leads GROUP BY lead_source ORDER BY COUNT(*) DESC",
    )
    .fetch_all(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .into_iter()
    .map(|(source, count)| SourceCount { source, count })
    .collect();

    Ok(Json(LeadStats {
        total: total.0,
        new: new.0,
        contacted: contacted.0,
        qualified: qualified.0,
        converted: converted.0,
        conversion_rate,
        by_source,
    }))
}
