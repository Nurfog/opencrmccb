#[derive(Clone)]
pub struct OAuthProviderConfig {
    pub client_id: String,
    pub client_secret: String,
    pub auth_url: String,
    pub token_url: String,
    pub userinfo_url: String,
    pub scope: String,
}

#[derive(Clone)]
pub struct DatabaseConfig {
    pub url: String,
}

#[derive(Clone)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
    pub cors_origins: String,
    pub frontend_url: String,
}

#[derive(Clone)]
pub struct AuthConfig {
    pub jwt_secret: String,
    pub refresh_token_secret: String,
    pub token_encryption_key: Option<Vec<u8>>,
    pub access_token_expiry_minutes: i64,
    pub refresh_token_expiry_days: i64,
}

#[derive(Clone)]
pub struct SmtpConfig {
    pub host: String,
    pub port: u16,
    pub user: String,
    pub password: String,
    pub from: String,
    pub enabled: bool,
}

#[derive(Clone)]
pub struct UploadConfig {
    pub dir: String,
    pub max_file_size_mb: u64,
}

#[derive(Clone)]
pub struct OAuthProvidersConfig {
    pub google: Option<OAuthProviderConfig>,
    pub microsoft: Option<OAuthProviderConfig>,
    pub github: Option<OAuthProviderConfig>,
}

pub struct Config {
    pub database: DatabaseConfig,
    pub server: ServerConfig,
    pub auth: AuthConfig,
    pub smtp: SmtpConfig,
    pub upload: UploadConfig,
    pub oauth: OAuthProvidersConfig,
}

impl Config {
    pub fn from_env() -> Self {
        dotenvy::dotenv().ok();

        let auth = Self::load_auth();
        let smtp = Self::load_smtp();
        let upload = Self::load_upload();
        let oauth = Self::load_oauth();

        Self {
            database: DatabaseConfig {
                url: std::env::var("DATABASE_URL")
                    .expect("DATABASE_URL environment variable must be set"),
            },
            server: ServerConfig {
                host: std::env::var("SERVER_HOST").unwrap_or_else(|_| "0.0.0.0".into()),
                port: std::env::var("SERVER_PORT")
                    .unwrap_or_else(|_| "8000".into())
                    .parse()
                    .unwrap_or(8000),
                cors_origins: std::env::var("CORS_ORIGINS")
                    .unwrap_or_else(|_| "http://localhost:3000".into()),
                frontend_url: std::env::var("FRONTEND_URL")
                    .unwrap_or_else(|_| "http://localhost:3000".into()),
            },
            auth,
            smtp,
            upload,
            oauth,
        }
    }

    fn load_auth() -> AuthConfig {
        let jwt_secret =
            std::env::var("JWT_SECRET").expect("JWT_SECRET environment variable must be set");
        if jwt_secret.len() < 32 {
            panic!(
                "JWT_SECRET must be at least 32 characters long (got {}). Generate with: openssl rand -base64 48",
                jwt_secret.len()
            );
        }

        let refresh_token_secret = std::env::var("REFRESH_TOKEN_SECRET")
            .expect("REFRESH_TOKEN_SECRET environment variable must be set");
        if refresh_token_secret.len() < 32 {
            panic!(
                "REFRESH_TOKEN_SECRET must be at least 32 characters long (got {}). Generate with: openssl rand -base64 48",
                refresh_token_secret.len()
            );
        }
        if refresh_token_secret == jwt_secret {
            panic!("REFRESH_TOKEN_SECRET must be different from JWT_SECRET");
        }

        let token_encryption_key = std::env::var("TOKEN_ENCRYPTION_KEY").ok().and_then(|k| {
            let decoded =
                base64::Engine::decode(&base64::engine::general_purpose::STANDARD, &k).ok()?;
            if decoded.len() == 32 {
                Some(decoded)
            } else {
                None
            }
        });

        AuthConfig {
            jwt_secret,
            refresh_token_secret,
            token_encryption_key,
            access_token_expiry_minutes: std::env::var("ACCESS_TOKEN_EXPIRY_MINUTES")
                .unwrap_or_else(|_| "15".into())
                .parse()
                .unwrap_or(15),
            refresh_token_expiry_days: std::env::var("REFRESH_TOKEN_EXPIRY_DAYS")
                .unwrap_or_else(|_| "30".into())
                .parse()
                .unwrap_or(30),
        }
    }

    fn load_smtp() -> SmtpConfig {
        SmtpConfig {
            host: std::env::var("SMTP_HOST").unwrap_or_else(|_| "localhost".into()),
            port: std::env::var("SMTP_PORT")
                .unwrap_or_else(|_| "587".into())
                .parse()
                .unwrap_or(587),
            user: std::env::var("SMTP_USER").unwrap_or_default(),
            password: std::env::var("SMTP_PASSWORD").unwrap_or_default(),
            from: std::env::var("SMTP_FROM").unwrap_or_else(|_| "noreply@crm.local".into()),
            enabled: std::env::var("EMAIL_ENABLED")
                .unwrap_or_else(|_| "false".into())
                .parse()
                .unwrap_or(false),
        }
    }

    fn load_upload() -> UploadConfig {
        UploadConfig {
            dir: std::env::var("UPLOAD_DIR").unwrap_or_else(|_| "./uploads".into()),
            max_file_size_mb: std::env::var("MAX_FILE_SIZE_MB")
                .unwrap_or_else(|_| "10".into())
                .parse()
                .unwrap_or(10),
        }
    }

    fn load_oauth() -> OAuthProvidersConfig {
        OAuthProvidersConfig {
            google: Self::load_oauth_provider(
                "GOOGLE",
                "https://accounts.google.com/o/oauth2/v2/auth",
                "https://oauth2.googleapis.com/token",
                "https://openidconnect.googleapis.com/v1/userinfo",
                "openid email profile",
            ),
            microsoft: Self::load_oauth_provider(
                "MICROSOFT",
                "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
                "https://login.microsoftonline.com/common/oauth2/v2.0/token",
                "https://graph.microsoft.com/oidc/userinfo",
                "openid email profile",
            ),
            github: Self::load_oauth_provider(
                "GITHUB",
                "https://github.com/login/oauth/authorize",
                "https://github.com/login/oauth/access_token",
                "https://api.github.com/user",
                "read:user user:email",
            ),
        }
    }

    fn load_oauth_provider(
        prefix: &str,
        default_auth: &str,
        default_token: &str,
        default_userinfo: &str,
        default_scope: &str,
    ) -> Option<OAuthProviderConfig> {
        let client_id = std::env::var(format!("OAUTH_{}_CLIENT_ID", prefix)).ok()?;
        if client_id.is_empty() {
            return None;
        }
        let client_secret = std::env::var(format!("OAUTH_{}_CLIENT_SECRET", prefix)).ok()?;
        Some(OAuthProviderConfig {
            client_id,
            client_secret,
            auth_url: std::env::var(format!("OAUTH_{}_AUTH_URL", prefix))
                .unwrap_or_else(|_| default_auth.into()),
            token_url: std::env::var(format!("OAUTH_{}_TOKEN_URL", prefix))
                .unwrap_or_else(|_| default_token.into()),
            userinfo_url: std::env::var(format!("OAUTH_{}_USERINFO_URL", prefix))
                .unwrap_or_else(|_| default_userinfo.into()),
            scope: std::env::var(format!("OAUTH_{}_SCOPE", prefix))
                .unwrap_or_else(|_| default_scope.into()),
        })
    }

    pub fn parse_cors_origins(&self) -> Vec<String> {
        self.server
            .cors_origins
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect()
    }
}
