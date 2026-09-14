use sqlx::PgPool;
use uuid::Uuid;

use crate::error::AppError;
use crate::models::{
    CreateLead, CreateLeadActivity, Lead, LeadActivity, LeadSource, PaginationParams, UpdateLead,
};

const BASE_SELECT: &str = "SELECT id, first_name, last_name, email, phone, company_name, title, industry, website, lead_source, status, score, assigned_to, converted_at, converted_contact_id, converted_company_id, converted_deal_id, notes, created_at, updated_at FROM leads";

pub struct PgLeadRepo {
    pool: PgPool,
}

impl PgLeadRepo {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn find_all(&self, params: &PaginationParams) -> Result<(Vec<Lead>, i64), AppError> {
        let per_page = params.per_page();
        let offset = params.offset();
        let sort_col = params.sort_column();
        let sort_dir = params.sort_direction();

        let search_filter = params
            .search
            .as_ref()
            .map(|s| format!("%{}%", crate::models::escape_like(s)));

        let count_query = if search_filter.is_some() {
            "SELECT COUNT(*) FROM leads WHERE first_name ILIKE $1 ESCAPE '\\' OR last_name ILIKE $1 ESCAPE '\\' OR email ILIKE $1 ESCAPE '\\' OR company_name ILIKE $1 ESCAPE '\\'".to_string()
        } else {
            "SELECT COUNT(*) FROM leads".to_string()
        };

        let data_query = if search_filter.is_some() {
            format!(
                "{BASE_SELECT} WHERE first_name ILIKE $1 ESCAPE '\\' OR last_name ILIKE $1 ESCAPE '\\' OR email ILIKE $1 ESCAPE '\\' OR company_name ILIKE $1 ESCAPE '\\'
                 ORDER BY {sort_col} {sort_dir} LIMIT $2 OFFSET $3"
            )
        } else {
            format!("{BASE_SELECT} ORDER BY {sort_col} {sort_dir} LIMIT $1 OFFSET $2")
        };

        let total: (i64,) = if let Some(ref search) = search_filter {
            sqlx::query_as(&count_query)
                .bind(search)
                .fetch_one(&self.pool)
                .await?
        } else {
            sqlx::query_as(&count_query).fetch_one(&self.pool).await?
        };

        let leads = if let Some(ref search) = search_filter {
            sqlx::query_as::<_, Lead>(&data_query)
                .bind(search)
                .bind(per_page)
                .bind(offset)
                .fetch_all(&self.pool)
                .await?
        } else {
            sqlx::query_as::<_, Lead>(&data_query)
                .bind(per_page)
                .bind(offset)
                .fetch_all(&self.pool)
                .await?
        };

        Ok((leads, total.0))
    }

    pub async fn find_by_id(&self, id: Uuid) -> Result<Option<Lead>, AppError> {
        let lead = sqlx::query_as::<_, Lead>(&format!("{BASE_SELECT} WHERE id = $1"))
            .bind(id)
            .fetch_optional(&self.pool)
            .await?;
        Ok(lead)
    }

    pub async fn create(&self, input: &CreateLead) -> Result<Lead, AppError> {
        let lead = sqlx::query_as::<_, Lead>(
            r#"
            INSERT INTO leads (first_name, last_name, email, phone, company_name, title, industry, website, lead_source, assigned_to, notes)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING id, first_name, last_name, email, phone, company_name, title, industry, website,
                      lead_source, status, score, assigned_to, converted_at, converted_contact_id,
                      converted_company_id, converted_deal_id, notes, created_at, updated_at
            "#,
        )
        .bind(&input.first_name)
        .bind(&input.last_name)
        .bind(&input.email)
        .bind(&input.phone)
        .bind(&input.company_name)
        .bind(&input.title)
        .bind(&input.industry)
        .bind(&input.website)
        .bind(input.lead_source.as_ref().unwrap_or(&LeadSource::Other))
        .bind(input.assigned_to)
        .bind(&input.notes)
        .fetch_one(&self.pool)
        .await?;
        Ok(lead)
    }

    pub async fn update(&self, id: Uuid, input: &UpdateLead) -> Result<Option<Lead>, AppError> {
        let lead = sqlx::query_as::<_, Lead>(
            r#"
            UPDATE leads
            SET first_name = COALESCE($2, first_name),
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
                      converted_company_id, converted_deal_id, notes, created_at, updated_at
            "#,
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
        .fetch_optional(&self.pool)
        .await?;
        Ok(lead)
    }

    pub async fn delete(&self, id: Uuid) -> Result<bool, AppError> {
        let result = sqlx::query("DELETE FROM leads WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(result.rows_affected() > 0)
    }

    pub async fn get_stats(&self) -> Result<LeadStats, AppError> {
        let total: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM leads")
            .fetch_one(&self.pool)
            .await?;

        let new: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM leads WHERE status = 'new'")
            .fetch_one(&self.pool)
            .await?;

        let contacted: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM leads WHERE status = 'contacted'")
                .fetch_one(&self.pool)
                .await?;

        let qualified: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM leads WHERE status = 'qualified'")
                .fetch_one(&self.pool)
                .await?;

        let converted: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM leads WHERE status = 'converted'")
                .fetch_one(&self.pool)
                .await?;

        let conversion_rate = if total.0 > 0 {
            (converted.0 as f64 / total.0 as f64) * 100.0
        } else {
            0.0
        };

        let by_source = sqlx::query_as::<_, (String, i64)>(
            "SELECT lead_source::text, COUNT(*) FROM leads GROUP BY lead_source ORDER BY COUNT(*) DESC",
        )
        .fetch_all(&self.pool)
        .await?
        .into_iter()
        .map(|(source, count)| SourceCount { source, count })
        .collect();

        Ok(LeadStats {
            total: total.0,
            new: new.0,
            contacted: contacted.0,
            qualified: qualified.0,
            converted: converted.0,
            conversion_rate,
            by_source,
        })
    }

    pub async fn get_activities(&self, lead_id: Uuid) -> Result<Vec<LeadActivity>, AppError> {
        let activities = sqlx::query_as::<_, LeadActivity>(
            "SELECT id, lead_id, type, subject, description, due_date, completed, created_by, created_at
             FROM lead_activities WHERE lead_id = $1 ORDER BY created_at DESC",
        )
        .bind(lead_id)
        .fetch_all(&self.pool)
        .await?;
        Ok(activities)
    }

    pub async fn create_activity(
        &self,
        lead_id: Uuid,
        input: &CreateLeadActivity,
        created_by: Option<Uuid>,
    ) -> Result<LeadActivity, AppError> {
        let activity = sqlx::query_as::<_, LeadActivity>(
            r#"
            INSERT INTO lead_activities (lead_id, type, subject, description, due_date, created_by)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, lead_id, type, subject, description, due_date, completed, created_by, created_at
            "#,
        )
        .bind(lead_id)
        .bind(&input.r#type)
        .bind(&input.subject)
        .bind(&input.description)
        .bind(input.due_date)
        .bind(created_by)
        .fetch_one(&self.pool)
        .await?;
        Ok(activity)
    }

    pub async fn complete_activity(&self, id: Uuid) -> Result<bool, AppError> {
        let result = sqlx::query("UPDATE lead_activities SET completed = TRUE WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(result.rows_affected() > 0)
    }

    pub async fn delete_activity(&self, id: Uuid) -> Result<bool, AppError> {
        let result = sqlx::query("DELETE FROM lead_activities WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(result.rows_affected() > 0)
    }
}

#[derive(Debug, serde::Serialize)]
pub struct LeadStats {
    pub total: i64,
    pub new: i64,
    pub contacted: i64,
    pub qualified: i64,
    pub converted: i64,
    pub conversion_rate: f64,
    pub by_source: Vec<SourceCount>,
}

#[derive(Debug, serde::Serialize)]
pub struct SourceCount {
    pub source: String,
    pub count: i64,
}
