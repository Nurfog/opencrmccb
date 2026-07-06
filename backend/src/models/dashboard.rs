use chrono::{DateTime, Utc};
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct DashboardStats {
    pub total_contacts: i64,
    pub total_companies: i64,
    pub total_deals: i64,
    pub total_revenue: f64,
    pub active_deals: i64,
    pub won_deals: i64,
    pub lost_deals: i64,
}

#[derive(Debug, Serialize)]
pub struct PipelineStage {
    pub stage: String,
    pub count: i64,
    pub total_value: f64,
}

#[derive(Debug, Serialize)]
pub struct PipelineResponse {
    pub stages: Vec<PipelineStage>,
}

#[derive(Debug, Serialize)]
pub struct TopDeal {
    pub id: uuid::Uuid,
    pub title: String,
    pub value: f64,
    pub stage: String,
    pub company_name: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct TopDealsResponse {
    pub deals: Vec<TopDeal>,
}

#[derive(Debug, Serialize)]
pub struct RecentActivity {
    pub id: uuid::Uuid,
    #[serde(rename = "type")]
    pub activity_type: String,
    pub subject: String,
    pub contact_name: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct RecentActivitiesResponse {
    pub activities: Vec<RecentActivity>,
}
