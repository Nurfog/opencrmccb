use crm_backend::config::{Config, ServerConfig};

fn make_config(cors: &str) -> Config {
    Config {
        database: crm_backend::config::DatabaseConfig {
            url: "postgres://localhost/test".into(),
        },
        server: ServerConfig {
            host: "0.0.0.0".into(),
            port: 8000,
            cors_origins: cors.into(),
            frontend_url: "http://localhost:3000".into(),
        },
        auth: crm_backend::config::AuthConfig {
            jwt_secret: "a".repeat(32),
            refresh_token_secret: "b".repeat(32),
            token_encryption_key: None,
            access_token_expiry_minutes: 15,
            refresh_token_expiry_days: 30,
        },
        smtp: crm_backend::config::SmtpConfig {
            host: "localhost".into(),
            port: 587,
            user: String::new(),
            password: String::new(),
            from: "noreply@test.com".into(),
            enabled: false,
        },
        upload: crm_backend::config::UploadConfig {
            dir: "./uploads".into(),
            max_file_size_mb: 10,
        },
        oauth: crm_backend::config::OAuthProvidersConfig {
            google: None,
            microsoft: None,
            github: None,
        },
    }
}

#[test]
fn parse_cors_origins_empty_string() {
    let config = make_config("");
    let origins = config.parse_cors_origins();
    assert!(origins.is_empty());
}

#[test]
fn parse_cors_origins_single_origin() {
    let config = make_config("http://localhost:3000");
    let origins = config.parse_cors_origins();
    assert_eq!(origins, vec!["http://localhost:3000"]);
}

#[test]
fn parse_cors_origins_multiple_origins() {
    let config = make_config("http://localhost:3000,https://example.com,https://app.test.com");
    let origins = config.parse_cors_origins();
    assert_eq!(
        origins,
        vec![
            "http://localhost:3000",
            "https://example.com",
            "https://app.test.com"
        ]
    );
}

#[test]
fn parse_cors_origins_trims_whitespace() {
    let config = make_config("  http://a.com ,  http://b.com  ");
    let origins = config.parse_cors_origins();
    assert_eq!(origins, vec!["http://a.com", "http://b.com"]);
}

#[test]
fn parse_cors_origins_filters_empty_segments() {
    let config = make_config("http://a.com,,http://b.com,");
    let origins = config.parse_cors_origins();
    assert_eq!(origins, vec!["http://a.com", "http://b.com"]);
}
