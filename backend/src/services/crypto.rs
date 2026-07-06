use aes_gcm::aead::Aead;
use aes_gcm::{Aes256Gcm, KeyInit, Nonce};

/// Encrypt a plaintext string using AES-256-GCM.
/// Returns `nonce_hex:ciphertext_hex` or the original value if no key is provided.
pub fn encrypt(plaintext: &str, key: Option<&[u8]>) -> String {
    let key = match key {
        Some(k) if k.len() == 32 => k,
        _ => return plaintext.to_string(),
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
