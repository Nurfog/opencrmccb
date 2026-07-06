use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Serialize, Deserialize, sqlx::Type, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
#[sqlx(type_name = "lead_status", rename_all = "snake_case")]
pub enum LeadStatus {
    New,
    Contacted,
    Qualified,
    Unqualified,
    Converted,
    Recycled,
}

#[derive(Debug, Serialize, Deserialize, sqlx::Type, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
#[sqlx(type_name = "lead_source", rename_all = "snake_case")]
pub enum LeadSource {
    Web,
    Referral,
    ColdCall,
    Advertisement,
    Email,
    Social,
    Partner,
    Event,
    Other,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Lead {
    pub id: Uuid,
    pub first_name: String,
    pub last_name: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub company_name: Option<String>,
    pub title: Option<String>,
    pub industry: Option<String>,
    pub website: Option<String>,
    pub lead_source: LeadSource,
    pub status: LeadStatus,
    pub score: i32,
    pub assigned_to: Option<Uuid>,
    pub converted_at: Option<DateTime<Utc>>,
    pub converted_contact_id: Option<Uuid>,
    pub converted_company_id: Option<Uuid>,
    pub converted_deal_id: Option<Uuid>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct LeadActivity {
    pub id: Uuid,
    pub lead_id: Uuid,
    pub r#type: String,
    pub subject: String,
    pub description: Option<String>,
    pub due_date: Option<DateTime<Utc>>,
    pub completed: bool,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateLead {
    #[validate(length(min = 1, max = 100, message = "First name must be 1-100 characters"))]
    pub first_name: String,

    #[validate(length(min = 1, max = 100, message = "Last name must be 1-100 characters"))]
    pub last_name: String,

    #[validate(email(message = "Email must be valid"))]
    pub email: Option<String>,

    #[validate(length(max = 50, message = "Phone must be at most 50 characters"))]
    pub phone: Option<String>,

    #[validate(length(max = 255, message = "Company name must be at most 255 characters"))]
    pub company_name: Option<String>,

    #[validate(length(max = 100, message = "Title must be at most 100 characters"))]
    pub title: Option<String>,

    #[validate(length(max = 100, message = "Industry must be at most 100 characters"))]
    pub industry: Option<String>,

    #[validate(length(max = 255, message = "Website must be at most 255 characters"))]
    pub website: Option<String>,

    pub lead_source: Option<LeadSource>,

    pub assigned_to: Option<Uuid>,

    #[validate(length(max = 1000, message = "Notes must be at most 1000 characters"))]
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateLead {
    #[validate(length(min = 1, max = 100, message = "First name must be 1-100 characters"))]
    pub first_name: Option<String>,

    #[validate(length(min = 1, max = 100, message = "Last name must be 1-100 characters"))]
    pub last_name: Option<String>,

    #[validate(email(message = "Email must be valid"))]
    pub email: Option<String>,

    #[validate(length(max = 50, message = "Phone must be at most 50 characters"))]
    pub phone: Option<String>,

    #[validate(length(max = 255, message = "Company name must be at most 255 characters"))]
    pub company_name: Option<String>,

    #[validate(length(max = 100, message = "Title must be at most 100 characters"))]
    pub title: Option<String>,

    #[validate(length(max = 100, message = "Industry must be at most 100 characters"))]
    pub industry: Option<String>,

    #[validate(length(max = 255, message = "Website must be at most 255 characters"))]
    pub website: Option<String>,

    pub lead_source: Option<LeadSource>,

    pub status: Option<LeadStatus>,

    pub score: Option<i32>,

    pub assigned_to: Option<Uuid>,

    #[validate(length(max = 1000, message = "Notes must be at most 1000 characters"))]
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ConvertLead {
    pub pipeline_id: Uuid,
    pub deal_title: Option<String>,
    pub deal_value: Option<rust_decimal::Decimal>,
}

#[derive(Debug, Serialize)]
pub struct ConvertLeadResult {
    pub contact_id: Option<Uuid>,
    pub company_id: Option<Uuid>,
    pub deal_id: Option<Uuid>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateLeadActivity {
    #[validate(length(min = 1, max = 50, message = "Type must be 1-50 characters"))]
    pub r#type: String,

    #[validate(length(min = 1, max = 255, message = "Subject must be 1-255 characters"))]
    pub subject: String,

    #[validate(length(max = 2000, message = "Description must be at most 2000 characters"))]
    pub description: Option<String>,

    pub due_date: Option<DateTime<Utc>>,
}
