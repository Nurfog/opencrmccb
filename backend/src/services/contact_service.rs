use uuid::Uuid;

use crate::AppState;
use crate::error::AppError;
use crate::handlers::audit::insert_audit_log;
use crate::models::{
    Contact, CreateContact, PaginatedResponse, PaginationParams, UpdateContact, WebhookEvent,
};
use crate::models::{ImportResult, escape_csv, parse_csv_rows};
use crate::repositories::contact_repo::PgContactRepo;
use crate::services::webhook_worker::enqueue_event;

pub struct ContactService<'a> {
    repo: &'a PgContactRepo,
}

impl<'a> ContactService<'a> {
    pub fn new(repo: &'a PgContactRepo) -> Self {
        Self { repo }
    }

    pub async fn list(
        &self,
        params: &PaginationParams,
    ) -> Result<PaginatedResponse<Contact>, AppError> {
        let page = params.page();
        let per_page = params.per_page();
        let (contacts, total) = self.repo.find_all(params).await?;
        Ok(PaginatedResponse::new(contacts, total, page, per_page))
    }

    pub async fn get(&self, id: Uuid) -> Result<Contact, AppError> {
        self.repo.find_by_id(id).await?.ok_or(AppError::NotFound)
    }

    pub async fn create(
        &self,
        input: &CreateContact,
        state: &AppState,
        user_id: Option<Uuid>,
    ) -> Result<Contact, AppError> {
        let contact = self.repo.create(input).await?;

        let _ = insert_audit_log(
            &state.db,
            user_id,
            "created",
            "contact",
            contact.id,
            None,
            Some(serde_json::to_value(&contact).unwrap_or_default()),
        )
        .await;

        if let Err(e) = enqueue_event(
            &state.db,
            WebhookEvent::ContactCreated,
            serde_json::to_value(&contact).unwrap_or_default(),
        )
        .await
        {
            tracing::warn!("Failed to enqueue ContactCreated webhook: {e}");
        }

        Ok(contact)
    }

    pub async fn update(
        &self,
        id: Uuid,
        input: &UpdateContact,
        state: &AppState,
        user_id: Option<Uuid>,
    ) -> Result<Contact, AppError> {
        let old = self.repo.find_by_id(id).await?.ok_or(AppError::NotFound)?;

        let contact = self
            .repo
            .update(id, input)
            .await?
            .ok_or(AppError::NotFound)?;

        let _ = insert_audit_log(
            &state.db,
            user_id,
            "updated",
            "contact",
            contact.id,
            Some(serde_json::to_value(&old).unwrap_or_default()),
            Some(serde_json::to_value(&contact).unwrap_or_default()),
        )
        .await;

        if let Err(e) = enqueue_event(
            &state.db,
            WebhookEvent::ContactUpdated,
            serde_json::to_value(&contact).unwrap_or_default(),
        )
        .await
        {
            tracing::warn!("Failed to enqueue ContactUpdated webhook: {e}");
        }

        Ok(contact)
    }

    pub async fn delete(
        &self,
        id: Uuid,
        state: &AppState,
        user_id: Option<Uuid>,
    ) -> Result<(), AppError> {
        let old = self.repo.delete(id).await?.ok_or(AppError::NotFound)?;

        let _ = insert_audit_log(
            &state.db,
            user_id,
            "deleted",
            "contact",
            old.id,
            Some(serde_json::to_value(&old).unwrap_or_default()),
            None,
        )
        .await;

        if let Err(e) = enqueue_event(
            &state.db,
            WebhookEvent::ContactDeleted,
            serde_json::to_value(&old).unwrap_or_default(),
        )
        .await
        {
            tracing::warn!("Failed to enqueue ContactDeleted webhook: {e}");
        }

        Ok(())
    }

    pub async fn bulk_delete(&self, ids: &[Uuid]) -> Result<usize, AppError> {
        self.repo.bulk_delete(ids).await
    }

    pub async fn export(&self, search: Option<&str>) -> Result<String, AppError> {
        let contacts = self.repo.find_all_for_export(search).await?;

        let mut csv = String::from("first_name,last_name,email,phone,position,company_id,notes\n");
        for c in &contacts {
            csv.push_str(&format!(
                "{},{},{},{},{},{},{}\n",
                escape_csv(&c.first_name),
                escape_csv(&c.last_name),
                escape_csv(c.email.as_deref().unwrap_or("")),
                escape_csv(c.phone.as_deref().unwrap_or("")),
                escape_csv(c.position.as_deref().unwrap_or("")),
                c.company_id.map(|id| id.to_string()).unwrap_or_default(),
                escape_csv(c.notes.as_deref().unwrap_or(""))
            ));
        }

        Ok(csv)
    }

    pub async fn import(&self, body: &str) -> Result<ImportResult, AppError> {
        let rows = parse_csv_rows(body);

        let mut imported = 0u32;
        let mut errors = Vec::new();

        for (row_num, fields) in rows.iter().enumerate() {
            if fields.len() < 2 {
                errors.push(format!("Línea {}: formato inválido", row_num + 2));
                continue;
            }

            let first_name = fields[0].trim().to_string();
            let last_name = fields[1].trim().to_string();
            let email = fields
                .get(2)
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty());
            let phone = fields
                .get(3)
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty());
            let position = fields
                .get(4)
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty());

            match self
                .repo
                .import_one(
                    &first_name,
                    &last_name,
                    email.as_deref(),
                    phone.as_deref(),
                    position.as_deref(),
                )
                .await
            {
                Ok(_) => imported += 1,
                Err(e) => errors.push(format!("Línea {}: {}", row_num + 2, e)),
            }
        }

        Ok(ImportResult { imported, errors })
    }
}
