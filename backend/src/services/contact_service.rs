use uuid::Uuid;
use validator::Validate;

use crate::AppState;
use crate::error::AppError;
use crate::handlers::audit::insert_audit_log;
use crate::models::{
    Contact, ContactFilters, CreateContact, PaginatedResponse, PaginationParams, UpdateContact,
    WebhookEvent,
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
        filters: &ContactFilters,
    ) -> Result<PaginatedResponse<Contact>, AppError> {
        let page = params.page();
        let per_page = params.per_page();
        let (contacts, total) = self.repo.find_all(params, filters).await?;
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

    pub async fn bulk_delete(
        &self,
        ids: &[Uuid],
        state: &AppState,
        user_id: Option<Uuid>,
    ) -> Result<usize, AppError> {
        // Snapshot rows first so the audit trail (and webhooks) can reference
        // what was deleted; the DELETE itself stays a single statement.
        let olds = self.repo.find_by_ids(ids).await?;
        let deleted = self.repo.bulk_delete(ids).await?;

        for old in &olds {
            let _ = insert_audit_log(
                &state.db,
                user_id,
                "deleted",
                "contact",
                old.id,
                Some(serde_json::to_value(old).unwrap_or_default()),
                None,
            )
            .await;

            if let Err(e) = enqueue_event(
                &state.db,
                WebhookEvent::ContactDeleted,
                serde_json::to_value(old).unwrap_or_default(),
            )
            .await
            {
                tracing::warn!("Failed to enqueue ContactDeleted webhook: {e}");
            }
        }

        Ok(deleted)
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
        if body.len() > 2 * 1024 * 1024 {
            return Err(AppError::BadRequest(
                "Import body too large (max 2MB)".into(),
            ));
        }
        let rows = parse_csv_rows(body);
        // Bound work per request: 2MB of tiny rows could still be tens of
        // thousands of sequential INSERTs.
        if rows.len() > 1000 {
            return Err(AppError::BadRequest(
                "Too many rows (max 1000 per import)".into(),
            ));
        }

        let mut imported = 0u32;
        let mut errors = Vec::new();

        for (row_num, fields) in rows.iter().enumerate() {
            if fields.len() < 2 {
                errors.push(format!("Línea {}: formato inválido", row_num + 2));
                continue;
            }

            // Validate through the same rules as single-create (names,
            // email shape, phone/position lengths) instead of ad-hoc checks.
            let candidate = CreateContact {
                first_name: fields[0].trim().to_string(),
                last_name: fields[1].trim().to_string(),
                email: fields
                    .get(2)
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty()),
                phone: fields
                    .get(3)
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty()),
                company_id: None,
                position: fields
                    .get(4)
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty()),
                notes: None,
            };
            if let Err(e) = candidate.validate() {
                errors.push(format!(
                    "Línea {}: {}",
                    row_num + 2,
                    first_validation_message(&e)
                ));
                continue;
            }

            match self
                .repo
                .import_one(
                    &candidate.first_name,
                    &candidate.last_name,
                    candidate.email.as_deref(),
                    candidate.phone.as_deref(),
                    candidate.position.as_deref(),
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

/// First human-readable message from a `validator` error set.
fn first_validation_message(e: &validator::ValidationErrors) -> String {
    e.field_errors()
        .values()
        .flat_map(|errs| errs.iter())
        .filter_map(|e| e.message.as_ref().map(|m| m.to_string()))
        .next()
        .unwrap_or_else(|| "validación inválida".to_string())
}
