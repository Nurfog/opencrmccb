use lettre::message::Mailbox;
use lettre::transport::smtp::authentication::Credentials;
use lettre::{AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor};
use tracing::{debug, warn};

#[derive(Debug, thiserror::Error)]
pub enum EmailError {
    #[error("Email sending is disabled")]
    Disabled,
    #[error("SMTP error: {0}")]
    Smtp(#[from] lettre::transport::smtp::Error),
    #[error("Invalid email address: {0}")]
    InvalidAddress(#[from] lettre::address::AddressError),
    #[error("Message error: {0}")]
    Message(#[from] lettre::error::Error),
}

#[allow(clippy::too_many_arguments)]
pub async fn send_email(
    host: &str,
    port: u16,
    user: &str,
    password: &str,
    from: &str,
    to: &str,
    subject: &str,
    body: &str,
) -> Result<(), EmailError> {
    let to_addr: Mailbox = to.parse()?;
    let from_addr: Mailbox = from.parse()?;

    let email = Message::builder()
        .from(from_addr)
        .to(to_addr)
        .subject(subject)
        .body(body.to_string())?;

    let credentials = if !user.is_empty() {
        Some(Credentials::new(user.to_string(), password.to_string()))
    } else {
        None
    };

    let transport = if let Some(creds) = credentials {
        AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(host)?
            .port(port)
            .credentials(creds)
            .build()
    } else {
        AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(host)?
            .port(port)
            .build()
    };

    match transport.send(email).await {
        Ok(_) => {
            debug!("Email sent successfully");
            Ok(())
        }
        Err(e) => {
            warn!(to = to, subject = subject, error = %e, "Failed to send email");
            Err(EmailError::Smtp(e))
        }
    }
}
