use crm_backend::services::crypto::{decrypt, encrypt};

fn test_key() -> [u8; 32] {
    [0x42; 32]
}

#[test]
fn encrypt_decrypt_roundtrip() {
    let key = test_key();
    let plaintext = "hello world";
    let encrypted = encrypt(plaintext, Some(&key));
    let decrypted = decrypt(&encrypted, Some(&key));
    assert_eq!(decrypted, plaintext);
}

#[test]
fn decrypt_with_no_key_returns_original() {
    let key = test_key();
    let plaintext = "sensitive data";
    let encrypted = encrypt(plaintext, Some(&key));
    let result = decrypt(&encrypted, None);
    assert_eq!(result, encrypted);
}

#[test]
fn encrypt_with_no_key_returns_original() {
    let plaintext = "plain text";
    let result = encrypt(plaintext, None);
    assert_eq!(result, plaintext);
}

#[test]
fn encrypt_with_wrong_length_key_returns_original() {
    let short_key = [0x42; 16];
    let plaintext = "data";
    let result = encrypt(plaintext, Some(&short_key));
    assert_eq!(result, plaintext);
}

#[test]
fn encrypt_generates_different_ciphertext_each_time() {
    let key = test_key();
    let plaintext = "same input";
    let enc1 = encrypt(plaintext, Some(&key));
    let enc2 = encrypt(plaintext, Some(&key));
    assert_ne!(enc1, enc2, "encryption should use random nonces");
}

#[test]
fn decrypt_non_encrypted_string_returns_original() {
    let key = test_key();
    let result = decrypt("no-colon-here", Some(&key));
    assert_eq!(result, "no-colon-here");
}

#[test]
fn decrypt_with_wrong_key_returns_original() {
    let key = test_key();
    let wrong_key = [0x99; 32];
    let plaintext = "secret";
    let encrypted = encrypt(plaintext, Some(&key));
    let result = decrypt(&encrypted, Some(&wrong_key));
    assert_eq!(
        result, encrypted,
        "wrong key should return the ciphertext unchanged"
    );
}

#[test]
fn encrypt_output_format_has_two_hex_parts() {
    let key = test_key();
    let encrypted = encrypt("test", Some(&key));
    let parts: Vec<&str> = encrypted.split(':').collect();
    assert_eq!(
        parts.len(),
        2,
        "encrypted output should be nonce_hex:ciphertext_hex"
    );
    assert!(!parts[0].is_empty());
    assert!(!parts[1].is_empty());
}
