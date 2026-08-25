use sqlx::PgPool;
use uuid::Uuid;

use crate::error::AppError;
use crate::models::{Company, CreateCompany, PaginationParams, UpdateCompany};

const BASE_SELECT: &str = "SELECT id, name, industry, website, phone, email, address, city, country, notes, created_at, updated_at FROM companies";

pub struct PgCompanyRepo {
    pool: PgPool,
}

impl PgCompanyRepo {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn find_all(
        &self,
        params: &PaginationParams,
    ) -> Result<(Vec<Company>, i64), AppError> {
        let per_page = params.per_page();
        let offset = params.offset();
        let sort_col = params.sort_column();
        let sort_dir = params.sort_direction();

        let search_filter = params
            .search
            .as_ref()
            .map(|s| format!("%{}%", crate::models::escape_like(s)));

        let count_query = if search_filter.is_some() {
            "SELECT COUNT(*) FROM companies WHERE name ILIKE $1 ESCAPE '\\' OR industry ILIKE $1 ESCAPE '\\' OR city ILIKE $1 ESCAPE '\\' OR country ILIKE $1 ESCAPE '\\'".to_string()
        } else {
            "SELECT COUNT(*) FROM companies".to_string()
        };

        let data_query = if search_filter.is_some() {
            format!(
                "{BASE_SELECT} WHERE name ILIKE $1 ESCAPE '\\' OR industry ILIKE $1 ESCAPE '\\' OR city ILIKE $1 ESCAPE '\\' OR country ILIKE $1 ESCAPE '\\'
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

        let companies = if let Some(ref search) = search_filter {
            sqlx::query_as::<_, Company>(&data_query)
                .bind(search)
                .bind(per_page)
                .bind(offset)
                .fetch_all(&self.pool)
                .await?
        } else {
            sqlx::query_as::<_, Company>(&data_query)
                .bind(per_page)
                .bind(offset)
                .fetch_all(&self.pool)
                .await?
        };

        Ok((companies, total.0))
    }

    pub async fn find_by_id(&self, id: Uuid) -> Result<Option<Company>, AppError> {
        let company = sqlx::query_as::<_, Company>(&format!("{BASE_SELECT} WHERE id = $1"))
            .bind(id)
            .fetch_optional(&self.pool)
            .await?;
        Ok(company)
    }

    pub async fn create(&self, input: &CreateCompany) -> Result<Company, AppError> {
        let company = sqlx::query_as::<_, Company>(
            r#"
            INSERT INTO companies (name, industry, website, phone, email, address, city, country, notes)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id, name, industry, website, phone, email, address, city, country, notes, created_at, updated_at
            "#,
        )
        .bind(&input.name)
        .bind(&input.industry)
        .bind(&input.website)
        .bind(&input.phone)
        .bind(&input.email)
        .bind(&input.address)
        .bind(&input.city)
        .bind(&input.country)
        .bind(&input.notes)
        .fetch_one(&self.pool)
        .await?;
        Ok(company)
    }

    pub async fn update(
        &self,
        id: Uuid,
        input: &UpdateCompany,
    ) -> Result<Option<Company>, AppError> {
        let company = sqlx::query_as::<_, Company>(
            r#"
            UPDATE companies
            SET name = COALESCE($2, name),
                industry = COALESCE($3, industry),
                website = COALESCE($4, website),
                phone = COALESCE($5, phone),
                email = COALESCE($6, email),
                address = COALESCE($7, address),
                city = COALESCE($8, city),
                country = COALESCE($9, country),
                notes = COALESCE($10, notes),
                updated_at = NOW()
            WHERE id = $1
            RETURNING id, name, industry, website, phone, email, address, city, country, notes, created_at, updated_at
            "#,
        )
        .bind(id)
        .bind(&input.name)
        .bind(&input.industry)
        .bind(&input.website)
        .bind(&input.phone)
        .bind(&input.email)
        .bind(&input.address)
        .bind(&input.city)
        .bind(&input.country)
        .bind(&input.notes)
        .fetch_optional(&self.pool)
        .await?;
        Ok(company)
    }

    pub async fn delete(&self, id: Uuid) -> Result<bool, AppError> {
        let result = sqlx::query("DELETE FROM companies WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(result.rows_affected() > 0)
    }

    pub async fn find_revenue(&self, company_id: Uuid) -> Result<rust_decimal::Decimal, AppError> {
        let result: (Option<rust_decimal::Decimal>,) =
            sqlx::query_as("SELECT COALESCE(SUM(value), 0) FROM deals WHERE company_id = $1")
                .bind(company_id)
                .fetch_one(&self.pool)
                .await?;
        Ok(result.0.unwrap_or(rust_decimal::Decimal::ZERO))
    }
}
