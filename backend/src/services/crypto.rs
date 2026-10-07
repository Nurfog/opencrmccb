use aes_gcm::aead::Aead;
use aes_gcm::{Aes256Gcm, KeyInit, Nonce};

/// Encrypt a plaintext string using AES-256-GCM.
/// Returns `nonce_hex:ciphertext_hex`.
/// FAIL-CLOSED in production: if `TOKEN_ENCRYPTION_KEY` is missing/invalid and
/// `ENV` is neither `development` nor `test`, this panics instead of storing
/// plaintext. In dev/test it falls back to plaintext with warn + error logs —
/// configure a 32-byte base64 `TOKEN_ENCRYPTION_KEY` for production.
pub fn encrypt(plaintext: &str, key: Option<&[u8]>) -> String {
    let key = match key {
        Some(k) if k.len() == 32 => k,
        _ => {
            // Logical column: distinguish envs. Production must never silently
            // store OAuth/WhatsApp tokens in plaintext.
            let env = std::env::var("ENV").unwrap_or_else(|_| "development".into());
            if env != "development" && env != "test" {
                panic!(
                    "TOKEN_ENCRYPTION_KEY missing/invalid in ENV='{env}': refusing to store tokens in PLAINTEXT. Set a 32-byte base64 key."
                );
            }
            tracing::warn!(
                "TOKEN_ENCRYPTION_KEY missing/invalid: storing OAuth/WhatsApp token in PLAINTEXT. Set a 32-byte base64 key for production."
            );
            tracing::error!(
                "plaintext token storage active (ENV='{env}'): dev-only fallback, fix TOKEN_ENCRYPTION_KEY before deploying"
            );
            return plaintext.to_string();
        }
    };

    let cipher = Aes256Gcm::new_from_slice(key).expect("valid 32-byte key");
    let mut nonce_bytes = [0u8; 12];
    rand::RngCore::fill_bytes(&mut rand::thread_rng(), &mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .expect("encryption never fails for AES-GCM");

    format!("{}:{}", hex::encode(nonce_bytes), hex::encode(ciphertext))
}

/// Decrypt a `nonce_hex:ciphertext_hex` string using AES-256-GCM.
/// Returns the original plaintext or the input unchanged if not encrypted / no key.
pub fn decrypt(ciphertext: &str, key: Option<&[u8]>) -> String {
    let key = match key {
        Some(k) if k.len() == 32 => k,
        _ => return ciphertext.to_string(),
    };

    // Detect non-encrypted values (no colon separator)
    let (nonce_hex, ct_hex) = match ciphertext.split_once(':') {
        Some((n, c)) => (n, c),
        None => return ciphertext.to_string(),
    };

    let nonce_bytes = match hex::decode(nonce_hex) {
        Ok(b) if b.len() == 12 => b,
        _ => return ciphertext.to_string(),
    };

    let ct_bytes = match hex::decode(ct_hex) {
        Ok(b) => b,
        _ => return ciphertext.to_string(),
    };

    let cipher = Aes256Gcm::new_from_slice(key).expect("valid 32-byte key");
    let nonce = Nonce::from_slice(&nonce_bytes);

    match cipher.decrypt(nonce, ct_bytes.as_ref()) {
        Ok(plaintext) => String::from_utf8(plaintext).unwrap_or_else(|_| ciphertext.to_string()),
        Err(_) => ciphertext.to_string(),
    }
}
