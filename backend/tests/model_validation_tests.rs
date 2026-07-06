use crm_backend::models::company::CreateCompany;
use crm_backend::models::contact::CreateContact;
use crm_backend::models::deal::CreateDeal;
use crm_backend::models::user::{CreateUser, LoginRequest};
use rust_decimal::Decimal;
use validator::Validate;

#[test]
fn create_contact_valid_data_passes() {
    let contact = CreateContact {
        first_name: "Alice".to_string(),
        last_name: "Smith".to_string(),
        email: Some("alice@example.com".to_string()),
        phone: Some("+1234567890".to_string()),
        company_id: None,
        position: Some("Engineer".to_string()),
        notes: Some("A note".to_string()),
    };
    assert!(contact.validate().is_ok());
}

#[test]
fn create_contact_empty_first_name_fails() {
    let contact = CreateContact {
        first_name: "".to_string(),
        last_name: "Smith".to_string(),
        email: None,
        phone: None,
        company_id: None,
        position: None,
        notes: None,
    };
    let err = contact.validate().unwrap_err();
    assert!(err.field_errors().contains_key("first_name"));
}

#[test]
fn create_contact_long_email_fails() {
    let contact = CreateContact {
        first_name: "Alice".to_string(),
        last_name: "Smith".to_string(),
        email: Some("not-an-email".to_string()),
        phone: None,
        company_id: None,
        position: None,
        notes: None,
    };
    let err = contact.validate().unwrap_err();
    assert!(err.field_errors().contains_key("email"));
}

#[test]
fn create_company_valid_data_passes() {
    let company = CreateCompany {
        name: "Acme Corp".to_string(),
        industry: Some("Tech".to_string()),
        website: Some("https://acme.com".to_string()),
        phone: None,
        email: Some("info@acme.com".to_string()),
        address: None,
        city: None,
        country: None,
        notes: None,
    };
    assert!(company.validate().is_ok());
}

#[test]
fn create_company_empty_name_fails() {
    let company = CreateCompany {
        name: "".to_string(),
        industry: None,
        website: None,
        phone: None,
        email: None,
        address: None,
        city: None,
        country: None,
        notes: None,
    };
    let err = company.validate().unwrap_err();
    assert!(err.field_errors().contains_key("name"));
}

#[test]
fn create_company_invalid_url_fails() {
    let company = CreateCompany {
        name: "Acme Corp".to_string(),
        industry: None,
        website: Some("not-a-url".to_string()),
        phone: None,
        email: None,
        address: None,
        city: None,
        country: None,
        notes: None,
    };
    let err = company.validate().unwrap_err();
    assert!(err.field_errors().contains_key("website"));
}

#[test]
fn create_deal_valid_data_passes() {
    let deal = CreateDeal {
        title: "Big Deal".to_string(),
        value: Decimal::from(50000),
        currency: Some("USD".to_string()),
        stage: None,
        contact_id: None,
        company_id: None,
        expected_close_date: None,
        notes: None,
    };
    assert!(deal.validate().is_ok());
}

#[test]
fn create_deal_negative_value_fails() {
    let deal = CreateDeal {
        title: "Big Deal".to_string(),
        value: Decimal::from(-100),
        currency: None,
        stage: None,
        contact_id: None,
        company_id: None,
        expected_close_date: None,
        notes: None,
    };
    let err = deal.validate().unwrap_err();
    assert!(err.field_errors().contains_key("value"));
}

#[test]
fn create_deal_empty_title_fails() {
    let deal = CreateDeal {
        title: "".to_string(),
        value: Decimal::from(1000),
        currency: None,
        stage: None,
        contact_id: None,
        company_id: None,
        expected_close_date: None,
        notes: None,
    };
    let err = deal.validate().unwrap_err();
    assert!(err.field_errors().contains_key("title"));
}

#[test]
fn create_user_valid_data_passes() {
    let user = CreateUser {
        email: "user@example.com".to_string(),
        password: "secure123".to_string(),
        first_name: "Bob".to_string(),
        last_name: "Jones".to_string(),
    };
    assert!(user.validate().is_ok());
}

#[test]
fn create_user_short_password_fails() {
    let user = CreateUser {
        email: "user@example.com".to_string(),
        password: "ab".to_string(),
        first_name: "Bob".to_string(),
        last_name: "Jones".to_string(),
    };
    let err = user.validate().unwrap_err();
    assert!(err.field_errors().contains_key("password"));
}

#[test]
fn create_user_invalid_email_fails() {
    let user = CreateUser {
        email: "not-valid".to_string(),
        password: "secure123".to_string(),
        first_name: "Bob".to_string(),
        last_name: "Jones".to_string(),
    };
    let err = user.validate().unwrap_err();
    assert!(err.field_errors().contains_key("email"));
}

#[test]
fn login_request_valid_data_passes() {
    let login = LoginRequest {
        email: "user@example.com".to_string(),
        password: "secret".to_string(),
    };
    assert!(login.validate().is_ok());
}

#[test]
fn login_request_empty_email_fails() {
    let login = LoginRequest {
        email: "".to_string(),
        password: "secret".to_string(),
    };
    let err = login.validate().unwrap_err();
    assert!(err.field_errors().contains_key("email"));
}
