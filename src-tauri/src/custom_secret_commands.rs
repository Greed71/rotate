use crate::{db, secrets, security};
use base64::engine::general_purpose::{STANDARD, URL_SAFE_NO_PAD};
use base64::Engine;
use security::SessionState;
use serde::{Deserialize, Serialize};

fn require_custom_secret_integration(
    app: &tauri::AppHandle,
    integration_id: &str,
) -> Result<db::IntegrationDto, String> {
    let row = db::get_integration_by_id(app, integration_id)?
        .ok_or_else(|| "Integrazione non trovata.".to_string())?;
    if row.provider != "custom_secret" {
        return Err("L'integrazione non e custom_secret.".into());
    }
    Ok(row)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomSecretGenerateCommand {
    integration_id: String,
    name: String,
    env_key: String,
    profile: String,
    format: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomSecretRotateCommand {
    integration_id: String,
    id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomSecretDeleteCommand {
    integration_id: String,
    id: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomSecretRotateResult {
    id: String,
    name: String,
    env_key: String,
    profile: String,
    format: String,
    value: String,
}

fn normalize_env_key(value: &str) -> Result<String, String> {
    let key = value.trim().to_ascii_uppercase();
    if key.is_empty() {
        return Err("Nome variabile env obbligatorio.".into());
    }
    if !key
        .chars()
        .all(|c| c.is_ascii_uppercase() || c.is_ascii_digit() || c == '_')
    {
        return Err(
            "La variabile env puo contenere solo lettere maiuscole, numeri e underscore.".into(),
        );
    }
    Ok(key)
}

fn byte_len_for_profile(profile: &str) -> Result<usize, String> {
    match profile {
        "random_secret" | "hmac_sha256" | "aes_256_gcm" | "xchacha20_poly1305" | "jwt_hs256" => {
            Ok(32)
        }
        "jwt_hs512" => Ok(64),
        _ => Err("Profilo crittografico non supportato.".into()),
    }
}

fn validate_format(format: &str) -> Result<(), String> {
    match format {
        "base64" | "base64url" | "hex" => Ok(()),
        _ => Err("Formato secret non supportato.".into()),
    }
}

fn generate_secret(profile: &str, format: &str) -> Result<String, String> {
    sodiumoxide::init().map_err(|_| "Impossibile inizializzare libsodium.".to_string())?;
    let bytes = sodiumoxide::randombytes::randombytes(byte_len_for_profile(profile)?);
    validate_format(format)?;
    Ok(match format {
        "base64" => STANDARD.encode(bytes),
        "base64url" => URL_SAFE_NO_PAD.encode(bytes),
        "hex" => bytes.iter().map(|b| format!("{b:02x}")).collect(),
        _ => unreachable!(),
    })
}

fn result_from_row(row: db::CustomSecretDto, value: String) -> CustomSecretRotateResult {
    CustomSecretRotateResult {
        id: row.id,
        name: row.name,
        env_key: row.env_key,
        profile: row.profile,
        format: row.format,
        value,
    }
}

#[tauri::command]
pub fn custom_secret_list(
    app: tauri::AppHandle,
    session: tauri::State<SessionState>,
    integration_id: String,
) -> Result<Vec<db::CustomSecretDto>, String> {
    security::require_vault_access(&app, &session)?;
    require_custom_secret_integration(&app, &integration_id)?;
    db::list_custom_secrets(&app, &integration_id)
}

#[tauri::command]
pub fn custom_secret_generate(
    app: tauri::AppHandle,
    session: tauri::State<SessionState>,
    payload: CustomSecretGenerateCommand,
) -> Result<CustomSecretRotateResult, String> {
    security::require_vault_access(&app, &session)?;
    require_custom_secret_integration(&app, &payload.integration_id)?;
    let name = payload.name.trim();
    if name.is_empty() {
        return Err("Nome secret obbligatorio.".into());
    }
    let env_key = normalize_env_key(&payload.env_key)?;
    let value = generate_secret(&payload.profile, &payload.format)?;
    let row = db::upsert_custom_secret(
        &app,
        &payload.integration_id,
        name,
        &env_key,
        &payload.profile,
        &payload.format,
    )?;
    secrets::custom_secret_save(&app, &row.id, &value)?;
    Ok(result_from_row(row, value))
}

#[tauri::command]
pub fn custom_secret_rotate(
    app: tauri::AppHandle,
    session: tauri::State<SessionState>,
    payload: CustomSecretRotateCommand,
) -> Result<CustomSecretRotateResult, String> {
    security::require_vault_access(&app, &session)?;
    require_custom_secret_integration(&app, &payload.integration_id)?;
    let row = db::list_custom_secrets(&app, &payload.integration_id)?
        .into_iter()
        .find(|secret| secret.id == payload.id)
        .ok_or_else(|| "Custom secret non trovato.".to_string())?;
    let value = generate_secret(&row.profile, &row.format)?;
    secrets::custom_secret_save(&app, &row.id, &value)?;
    db::mark_custom_secret_rotated(&app, &row.id)?;
    Ok(result_from_row(row, value))
}

#[tauri::command]
pub fn custom_secret_delete(
    app: tauri::AppHandle,
    session: tauri::State<SessionState>,
    payload: CustomSecretDeleteCommand,
) -> Result<(), String> {
    security::require_vault_access(&app, &session)?;
    require_custom_secret_integration(&app, &payload.integration_id)?;
    let exists = db::list_custom_secrets(&app, &payload.integration_id)?
        .into_iter()
        .any(|secret| secret.id == payload.id);
    if !exists {
        return Err("Custom secret non trovato.".into());
    }
    secrets::custom_secret_delete(&app, &payload.id)?;
    db::delete_custom_secret(&app, &payload.id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn env_key_is_normalized_and_restricted() {
        assert_eq!(normalize_env_key(" app_secret_1 ").unwrap(), "APP_SECRET_1");
        assert!(normalize_env_key("APP-SECRET").is_err());
        assert!(normalize_env_key("").is_err());
    }

    #[test]
    fn generated_values_match_expected_formats() {
        let b64url = generate_secret("aes_256_gcm", "base64url").unwrap();
        assert!(!b64url.contains('+'));
        assert!(!b64url.contains('/'));
        assert!(!b64url.contains('='));

        let hex = generate_secret("jwt_hs512", "hex").unwrap();
        assert_eq!(hex.len(), 128);
        assert!(hex.chars().all(|c| c.is_ascii_hexdigit()));
    }
}
