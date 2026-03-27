use std::fs;
use std::path::PathBuf;

use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Nonce};
use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use base64::Engine;
use keyring::Entry;
use rand::rngs::OsRng;
use rand::RngCore;
use serde_json::Value;
use tauri::{AppHandle, Manager};

const KEYRING_SERVICE: &str = "RitoHub";
const KEYRING_ACCOUNT: &str = "accounts-encryption-key";
const STORAGE_FILE_NAME: &str = "accounts.dat";
const LEGACY_STORAGE_FILE_NAME: &str = "accounts.json";
const FILE_MAGIC: &[u8] = b"RITOHUB1";
const NONCE_LENGTH: usize = 12;
const KEY_LENGTH: usize = 32;

pub fn load_accounts(app: &AppHandle) -> Result<Value, String> {
    let storage_path = storage_path(app)?;

    if storage_path.exists() {
        let encrypted = fs::read(&storage_path)
            .map_err(|error| format!("Failed to read account storage: {error}"))?;
        let accounts = decrypt_accounts(&encrypted)?;
        delete_legacy_store(app);
        return Ok(accounts);
    }

    migrate_legacy_accounts(app, &storage_path)
}

pub fn save_accounts(app: &AppHandle, accounts: Value) -> Result<(), String> {
    if !accounts.is_array() {
        return Err("Accounts payload must be an array.".to_string());
    }

    let storage_path = storage_path(app)?;
    let storage_dir = storage_path
        .parent()
        .ok_or_else(|| "Failed to resolve account storage directory.".to_string())?;

    fs::create_dir_all(storage_dir)
        .map_err(|error| format!("Failed to create account storage directory: {error}"))?;

    let encrypted = encrypt_accounts(&accounts)?;

    fs::write(&storage_path, encrypted)
        .map_err(|error| format!("Failed to write account storage: {error}"))?;

    delete_legacy_store(app);

    Ok(())
}

fn migrate_legacy_accounts(app: &AppHandle, storage_path: &PathBuf) -> Result<Value, String> {
    let legacy_path = legacy_storage_path(app)?;

    if !legacy_path.exists() {
        return Ok(Value::Array(Vec::new()));
    }

    let legacy_contents = fs::read_to_string(&legacy_path)
        .map_err(|error| format!("Failed to read legacy account storage: {error}"))?;
    let legacy_value: Value = serde_json::from_str(&legacy_contents)
        .map_err(|error| format!("Failed to parse legacy account storage: {error}"))?;

    let accounts = legacy_value
        .get("accounts")
        .cloned()
        .or_else(|| {
            legacy_value
                .as_array()
                .map(|entries| Value::Array(entries.clone()))
        })
        .unwrap_or_else(|| Value::Array(Vec::new()));

    let encrypted = encrypt_accounts(&accounts)?;
    let storage_dir = storage_path
        .parent()
        .ok_or_else(|| "Failed to resolve account storage directory.".to_string())?;

    fs::create_dir_all(storage_dir)
        .map_err(|error| format!("Failed to create account storage directory: {error}"))?;
    fs::write(storage_path, encrypted)
        .map_err(|error| format!("Failed to write migrated account storage: {error}"))?;

    delete_legacy_store(app);

    Ok(accounts)
}

fn encrypt_accounts(accounts: &Value) -> Result<Vec<u8>, String> {
    let cipher = build_cipher()?;
    let plaintext = serde_json::to_vec(accounts)
        .map_err(|error| format!("Failed to serialize accounts: {error}"))?;

    let mut nonce_bytes = [0u8; NONCE_LENGTH];
    OsRng.fill_bytes(&mut nonce_bytes);

    let ciphertext = cipher
        .encrypt(Nonce::from_slice(&nonce_bytes), plaintext.as_ref())
        .map_err(|_| "Failed to encrypt account storage.".to_string())?;

    let mut output = Vec::with_capacity(FILE_MAGIC.len() + NONCE_LENGTH + ciphertext.len());
    output.extend_from_slice(FILE_MAGIC);
    output.extend_from_slice(&nonce_bytes);
    output.extend_from_slice(&ciphertext);
    Ok(output)
}

fn decrypt_accounts(encrypted: &[u8]) -> Result<Value, String> {
    if encrypted.len() < FILE_MAGIC.len() + NONCE_LENGTH {
        return Err("Encrypted account storage is invalid.".to_string());
    }

    let (magic, rest) = encrypted.split_at(FILE_MAGIC.len());
    if magic != FILE_MAGIC {
        return Err("Encrypted account storage has an unknown format.".to_string());
    }

    let (nonce_bytes, ciphertext) = rest.split_at(NONCE_LENGTH);
    let cipher = build_cipher()?;
    let plaintext = cipher
        .decrypt(Nonce::from_slice(nonce_bytes), ciphertext)
        .map_err(|_| "Failed to decrypt account storage.".to_string())?;

    serde_json::from_slice(&plaintext)
        .map_err(|error| format!("Failed to decode account storage: {error}"))
}

fn build_cipher() -> Result<Aes256Gcm, String> {
    let key = load_or_create_key()?;
    Aes256Gcm::new_from_slice(&key)
        .map_err(|_| "Failed to initialize the account storage cipher.".to_string())
}

fn load_or_create_key() -> Result<[u8; KEY_LENGTH], String> {
    let entry = Entry::new(KEYRING_SERVICE, KEYRING_ACCOUNT)
        .map_err(|error| format!("Failed to open the OS credential store: {error}"))?;

    match entry.get_password() {
        Ok(encoded_key) => decode_key(&encoded_key),
        Err(keyring::Error::NoEntry) => {
            let mut key = [0u8; KEY_LENGTH];
            OsRng.fill_bytes(&mut key);

            entry
                .set_password(&BASE64_STANDARD.encode(key))
                .map_err(|error| format!("Failed to save the encryption key: {error}"))?;

            Ok(key)
        }
        Err(error) => Err(format!("Failed to read the encryption key: {error}")),
    }
}

fn decode_key(encoded_key: &str) -> Result<[u8; KEY_LENGTH], String> {
    let bytes = BASE64_STANDARD
        .decode(encoded_key)
        .map_err(|error| format!("Stored encryption key is invalid: {error}"))?;

    bytes
        .try_into()
        .map_err(|_| "Stored encryption key has an unexpected length.".to_string())
}

fn storage_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|error| format!("Failed to resolve the app data directory: {error}"))
        .map(|path| path.join(STORAGE_FILE_NAME))
}

fn legacy_storage_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|error| format!("Failed to resolve the app data directory: {error}"))
        .map(|path| path.join(LEGACY_STORAGE_FILE_NAME))
}

fn delete_legacy_store(app: &AppHandle) {
    if let Ok(legacy_path) = legacy_storage_path(app) {
        if legacy_path.exists() {
            if let Err(error) = fs::remove_file(legacy_path) {
                eprintln!("Failed to remove legacy account storage: {error}");
            }
        }
    }
}
