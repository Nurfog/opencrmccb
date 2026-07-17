use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

use crate::models::date_flex;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type)]
#[serde(rename_all = "snake_case")]
#[sqlx(type_name = "deal_stage", rename_all = "snake_case")]
pub enum DealStage {
    Lead,
    Qualified,
    Proposal,
    Negotiation,
    ClosedWon,
    ClosedLost,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Deal {
    pub id: Uuid,
    pub title: String,
    pub value: Decimal,
    pub currency: String,
    pub stage: DealStage,
    pub position: Option<i32>,
    pub contact_id: Option<Uuid>,
    pub company_id: Option<Uuid>,
    #[sqlx(default)]
    pub pipeline_id: Option<Uuid>,
    #[sqlx(default)]
    pub pipeline_stage_id: Option<Uuid>,
    pub expected_close_date: Option<DateTime<Utc>>,
    pub notes: Option<String>,
    #[sqlx(default)]
    pub contact_name: Option<String>,
    #[sqlx(default)]
    pub company_name: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateDealStage {
    pub stage: DealStage,
    pub position: Option<i32>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateDeal {
    #[validate(length(min = 1, max = 200, message = "Title must be 1-200 characters"))]
    pub title: String,

    #[validate(custom(function = "validate_non_negative_decimal"))]
    pub value: Decimal,

    #[validate(length(max = 3, message = "Currency must be at most 3 characters"))]
    pub currency: Option<String>,

    pub stage: Option<DealStage>,

    pub contact_id: Option<Uuid>,

    pub company_id: Option<Uuid>,

    #[serde(default, with = "date_flex")]
    pub expected_close_date: Option<DateTime<Utc>>,

    #[validate(length(max = 1000, message = "Notes must be at most 1000 characters"))]
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateDeal {
    #[validate(length(min = 1, max = 200, message = "Title must be 1-200 characters"))]
    pub title: Option<String>,

    #[validate(custom(function = "validate_non_negative_decimal_opt"))]
    pub value: Option<Decimal>,

    #[validate(length(max = 3, message = "Currency must be at most 3 characters"))]
    pub currency: Option<String>,

    pub stage: Option<DealStage>,

    pub contact_id: Option<Uuid>,

    pub company_id: Option<Uuid>,

    #[serde(default, with = "date_flex")]
    pub expected_close_date: Option<DateTime<Utc>>,

    #[validate(length(max = 1000, message = "Notes must be at most 1000 characters"))]
    pub notes: Option<String>,
}

fn validate_non_negative_decimal(value: &Decimal) -> Result<(), validator::ValidationError> {
    if *value < Decimal::ZERO {
        return Err(validator::ValidationError::new(
            "Value must be non-negative",
        ));
    }
    Ok(())
}

fn validate_non_negative_decimal_opt(value: &&Decimal) -> Result<(), validator::ValidationError> {
    if **value < Decimal::ZERO {
        return Err(validator::ValidationError::new(
            "Value must be non-negative",
        ));
    }
    Ok(())
}
