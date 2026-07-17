use sqlx::PgPool;
use uuid::Uuid;

use crate::error::AppError;
use crate::models::{Contact, CreateContact, PaginationParams, UpdateContact};

const BASE_SELECT: &str = "SELECT id, first_name, last_name, email, phone, company_id, position, notes, created_at, updated_at FROM contacts";

pub struct PgContactRepo {
    pool: PgPool,
}

impl PgContactRepo {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn find_all(
        &self,
        params: &PaginationParams,
    ) -> Result<(Vec<Contact>, i64), AppError> {
        let per_page = params.per_page();
        let offset = params.offset();
        let sort_col = params.sort_column();
        let sort_dir = params.sort_direction();

        let search_filter = params
            .search
            .as_ref()
            .map(|s| format!("%{}%", crate::models::escape_like(s)));

        let count_query = if search_filter.is_some() {
            "SELECT COUNT(*) FROM contacts WHERE first_name ILIKE $1 ESCAPE '\\' OR last_name ILIKE $1 ESCAPE '\\' OR email ILIKE $1 ESCAPE '\\'".to_string()
        } else {
            "SELECT COUNT(*) FROM contacts".to_string()
        };

        let data_query = if search_filter.is_some() {
            format!(
                "{BASE_SELECT} WHERE first_name ILIKE $1 ESCAPE '\\' OR last_name ILIKE $1 ESCAPE '\\' OR email ILIKE $1 ESCAPE '\\'
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

        let contacts = if let Some(ref search) = search_filter {
            sqlx::query_as::<_, Contact>(&data_query)
                .bind(search)
                .bind(per_page)
                .bind(offset)
                .fetch_all(&self.pool)
                .await?
        } else {
            sqlx::query_as::<_, Contact>(&data_query)
                .bind(per_page)
                .bind(offset)
                .fetch_all(&self.pool)
                .await?
        };

        Ok((contacts, total.0))
    }

    pub async fn find_by_id(&self, id: Uuid) -> Result<Option<Contact>, AppError> {
        let contact = sqlx::query_as::<_, Contact>(&format!("{BASE_SELECT} WHERE id = $1"))
            .bind(id)
            .fetch_optional(&self.pool)
            .await?;
        Ok(contact)
    }

    pub async fn create(&self, input: &CreateContact) -> Result<Contact, AppError> {
        let contact = sqlx::query_as::<_, Contact>(
            r#"
            INSERT INTO contacts (first_name, last_name, email, phone, company_id, position, notes)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id, first_name, last_name, email, phone, company_id, position, notes, created_at, updated_at
            "#,
        )
        .bind(&input.first_name)
        .bind(&input.last_name)
        .bind(&input.email)
        .bind(&input.phone)
        .bind(input.company_id)
        .bind(&input.position)
        .bind(&input.notes)
        .fetch_one(&self.pool)
        .await?;
        Ok(contact)
    }

    pub async fn update(
        &self,
        id: Uuid,
        input: &UpdateContact,
    ) -> Result<Option<Contact>, AppError> {
        let contact = sqlx::query_as::<_, Contact>(
            r#"
            UPDATE contacts
            SET first_name = COALESCE($2, first_name),
                last_name = COALESCE($3, last_name),
                email = COALESCE($4, email),
                phone = COALESCE($5, phone),
                company_id = COALESCE($6, company_id),
                position = COALESCE($7, position),
                notes = COALESCE($8, notes),
                updated_at = NOW()
            WHERE id = $1
            RETURNING id, first_name, last_name, email, phone, company_id, position, notes, created_at, updated_at
            "#,
        )
        .bind(id)
        .bind(&input.first_name)
        .bind(&input.last_name)
        .bind(&input.email)
        .bind(&input.phone)
        .bind(input.company_id)
        .bind(&input.position)
        .bind(&input.notes)
        .fetch_optional(&self.pool)
        .await?;
        Ok(contact)
    }

    pub async fn delete(&self, id: Uuid) -> Result<Option<Contact>, AppError> {
        let old = self.find_by_id(id).await?;
        if old.is_none() {
            return Ok(None);
        }

        let result = sqlx::query("DELETE FROM contacts WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await?;

        if result.rows_affected() == 0 {
            return Ok(None);
        }

        Ok(old)
    }

    pub async fn bulk_delete(&self, ids: &[Uuid]) -> Result<usize, AppError> {
        if ids.is_empty() {
            return Ok(0);
        }
        let result = sqlx::query("DELETE FROM contacts WHERE id = ANY($1)")
            .bind(ids)
            .execute(&self.pool)
            .await?;
        Ok(result.rows_affected() as usize)
    }

    pub async fn find_all_for_export(
        &self,
        search: Option<&str>,
    ) -> Result<Vec<Contact>, AppError> {
        let contacts = if let Some(search) = search {
            let pattern = format!("%{}%", crate::models::escape_like(search));
            sqlx::query_as::<_, Contact>(&format!(
                "{BASE_SELECT} WHERE first_name ILIKE $1 ESCAPE '\\' OR last_name ILIKE $1 ESCAPE '\\' OR email ILIKE $1 ESCAPE '\\' ORDER BY created_at DESC LIMIT 100000"
            ))
            .bind(pattern)
            .fetch_all(&self.pool)
            .await?
        } else {
            sqlx::query_as::<_, Contact>(&format!(
                "{BASE_SELECT} ORDER BY created_at DESC LIMIT 100000"
            ))
            .fetch_all(&self.pool)
            .await?
        };
        Ok(contacts)
    }

    pub async fn import_one(
        &self,
        first_name: &str,
        last_name: &str,
        email: Option<&str>,
        phone: Option<&str>,
        position: Option<&str>,
    ) -> Result<Contact, AppError> {
        let contact = sqlx::query_as::<_, Contact>(
            r#"
            INSERT INTO contacts (first_name, last_name, email, phone, position)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, first_name, last_name, email, phone, company_id, position, notes, created_at, updated_at
            "#,
        )
        .bind(first_name)
        .bind(last_name)
        .bind(email)
        .bind(phone)
        .bind(position)
        .fetch_one(&self.pool)
        .await?;
        Ok(contact)
    }
}
