use rust_decimal::Decimal;
use serde::Serialize;
use uuid::Uuid;

use super::deal::DealStage;

#[derive(Serialize)]
pub struct ImportResult {
    pub imported: u32,
    pub errors: Vec<String>,
}

#[derive(Debug)]
pub struct DealImportRow {
    pub title: String,
    pub value: Decimal,
    pub currency: String,
    pub stage: DealStage,
    pub contact_id: Option<Uuid>,
    pub company_id: Option<Uuid>,
    pub expected_close_date: Option<chrono::DateTime<chrono::Utc>>,
    pub notes: Option<String>,
}

pub fn escape_csv(value: &str) -> String {
    if value.contains(',') || value.contains('"') || value.contains('\n') || value.contains('\r') {
        format!("\"{}\"", value.replace('"', "\"\""))
    } else {
        value.to_string()
    }
}

pub fn parse_csv_rows(content: &str) -> Vec<Vec<String>> {
    let mut rdr = csv::Reader::from_reader(content.as_bytes());
    let mut rows = Vec::new();

    for result in rdr.records() {
        match result {
            Ok(record) => {
                rows.push(record.iter().map(|s| s.to_string()).collect());
            }
            Err(_) => continue,
        }
    }

    rows
}

pub fn parse_deal_import_row(fields: &[String]) -> Result<DealImportRow, &'static str> {
    if fields.len() < 3 {
        return Err("formato inválido");
    }

    let value = fields[1]
        .trim()
        .parse::<Decimal>()
        .map_err(|_| "valor inválido")?;

    Ok(DealImportRow {
        title: fields[0].trim().to_string(),
        value,
        currency: optional_field(fields, 2).unwrap_or_else(|| "USD".to_string()),
        stage: fields
            .get(3)
            .map(|field| parse_deal_stage(field))
            .unwrap_or(DealStage::Lead),
        contact_id: optional_field(fields, 4).and_then(|value| value.parse::<Uuid>().ok()),
        company_id: optional_field(fields, 5).and_then(|value| value.parse::<Uuid>().ok()),
        expected_close_date: optional_field(fields, 6)
            .and_then(|value| chrono::DateTime::parse_from_rfc3339(&value).ok())
            .map(|date| date.with_timezone(&chrono::Utc)),
        notes: optional_field(fields, 7),
    })
}

fn optional_field(fields: &[String], index: usize) -> Option<String> {
    fields
        .get(index)
        .map(|field| field.trim().to_string())
        .filter(|field| !field.is_empty())
}

fn parse_deal_stage(value: &str) -> DealStage {
    match value.trim() {
        "lead" | "Lead" => DealStage::Lead,
        "qualified" | "Qualified" => DealStage::Qualified,
        "proposal" | "Proposal" => DealStage::Proposal,
        "negotiation" | "Negotiation" => DealStage::Negotiation,
        "closed_won" | "Closed Won" | "closedwon" => DealStage::ClosedWon,
        "closed_lost" | "Closed Lost" | "closedlost" => DealStage::ClosedLost,
        _ => DealStage::Lead,
    }
}
