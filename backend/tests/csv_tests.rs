use crm_backend::models::DealStage;
use crm_backend::models::csv::{escape_csv, parse_csv_rows, parse_deal_import_row};
use rust_decimal::Decimal;
use std::str::FromStr;

#[test]
fn parse_csv_rows_simple() {
    let input = "name,email\nAlice,alice@example.com\nBob,bob@example.com\n";
    let rows = parse_csv_rows(input);
    assert_eq!(rows.len(), 2);
    assert_eq!(rows[0], vec!["Alice", "alice@example.com"]);
    assert_eq!(rows[1], vec!["Bob", "bob@example.com"]);
}

#[test]
fn parse_csv_rows_quoted_fields_with_commas() {
    let input = "name,address\nAlice,\"123 Main St, Apt 4\"\n";
    let rows = parse_csv_rows(input);
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0], vec!["Alice", "123 Main St, Apt 4"]);
}

#[test]
fn parse_csv_rows_escaped_quotes() {
    let input = "name,note\nAlice,\"She said \"\"hello\"\"\"\n";
    let rows = parse_csv_rows(input);
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0], vec!["Alice", "She said \"hello\""]);
}

#[test]
fn parse_csv_rows_empty_input() {
    let rows = parse_csv_rows("");
    assert!(rows.is_empty());
}

#[test]
fn parse_csv_rows_header_only() {
    let input = "name,email\n";
    let rows = parse_csv_rows(input);
    assert!(rows.is_empty());
}

#[test]
fn escape_csv_plain() {
    assert_eq!(escape_csv("hello"), "hello");
    assert_eq!(escape_csv("123"), "123");
}

#[test]
fn escape_csv_comma() {
    assert_eq!(escape_csv("a,b"), "\"a,b\"");
}

#[test]
fn escape_csv_quote() {
    assert_eq!(escape_csv("say \"hi\""), "\"say \"\"hi\"\"\"");
}

#[test]
fn escape_csv_newline() {
    assert_eq!(escape_csv("line1\nline2"), "\"line1\nline2\"");
}

#[test]
fn escape_csv_carriage_return() {
    assert_eq!(escape_csv("line1\rline2"), "\"line1\rline2\"");
}

#[test]
fn escape_csv_combined() {
    assert_eq!(escape_csv("a,b\nc"), "\"a,b\nc\"");
}

#[test]
fn parse_deal_import_row_minimal_fields() {
    let fields = vec![
        "Enterprise renewal".to_string(),
        "12500.50".to_string(),
        "USD".to_string(),
    ];

    let row = parse_deal_import_row(&fields).expect("valid deal row");

    assert_eq!(row.title, "Enterprise renewal");
    assert_eq!(row.value, Decimal::from_str_exact("12500.50").unwrap());
    assert_eq!(row.currency, "USD");
    assert!(matches!(row.stage, DealStage::Lead));
    assert!(row.contact_id.is_none());
    assert!(row.company_id.is_none());
    assert!(row.expected_close_date.is_none());
    assert!(row.notes.is_none());
}

#[test]
fn parse_deal_import_row_optional_fields() {
    let contact_id = "550e8400-e29b-41d4-a716-446655440000";
    let company_id = "550e8400-e29b-41d4-a716-446655440001";
    let fields = vec![
        "Expansion".to_string(),
        "4000".to_string(),
        "CLP".to_string(),
        "Closed Won".to_string(),
        contact_id.to_string(),
        company_id.to_string(),
        "2026-07-01T12:30:00Z".to_string(),
        "Imported from sales ops".to_string(),
    ];

    let row = parse_deal_import_row(&fields).expect("valid deal row");

    assert!(matches!(row.stage, DealStage::ClosedWon));
    assert_eq!(
        row.contact_id.map(|id| id.to_string()).as_deref(),
        Some(contact_id)
    );
    assert_eq!(
        row.company_id.map(|id| id.to_string()).as_deref(),
        Some(company_id)
    );
    assert!(row.expected_close_date.is_some());
    assert_eq!(row.notes.as_deref(), Some("Imported from sales ops"));
}

#[test]
fn parse_deal_import_row_defaults_blank_currency_and_unknown_stage() {
    let fields = vec![
        "Discovery".to_string(),
        "900".to_string(),
        " ".to_string(),
        "unknown".to_string(),
    ];

    let row = parse_deal_import_row(&fields).expect("valid deal row");

    assert_eq!(row.currency, "USD");
    assert!(matches!(row.stage, DealStage::Lead));
}

#[test]
fn parse_deal_import_row_rejects_short_rows() {
    let fields = vec!["Only title".to_string(), "100".to_string()];

    let err = parse_deal_import_row(&fields).expect_err("short rows should fail");

    assert_eq!(err, "formato inválido");
}

#[test]
fn parse_deal_import_row_rejects_invalid_value() {
    let fields = vec![
        "Bad value".to_string(),
        "abc".to_string(),
        "USD".to_string(),
    ];

    let err = parse_deal_import_row(&fields).expect_err("invalid values should fail");

    assert_eq!(err, "valor inválido");
}
