//! Rotate — backend Tauri (comandi IPC verso il frontend).

mod cf_api;
mod db;
mod secrets;
mod security;

use security::SessionState;
use serde::Serialize;

/// Diagnostica: non espone segreti.
#[tauri::command]
fn platform_blurb() -> String {
    format!(
        "Rust backend attivo · OS: {} · arch: {} · crate v{}",
        std::env::consts::OS,
        std::env::consts::ARCH,
        env!("CARGO_PKG_VERSION")
    )
}

#[tauri::command]
fn security_status(
    app: tauri::AppHandle,
    session: tauri::State<SessionState>,
) -> Result<security::SecurityStatusDto, String> {
    security::build_status(&app, &session)
}

#[tauri::command]
fn security_set_pin(
    app: tauri::AppHandle,
    session: tauri::State<SessionState>,
    pin: String,
) -> Result<security::SecurityStatusDto, String> {
    security::set_initial_pin(&app, &pin)?;
    session.unlock_vault();
    security::build_status(&app, &session)
}

#[tauri::command]
fn security_unlock(
    app: tauri::AppHandle,
    session: tauri::State<SessionState>,
    pin: String,
) -> Result<security::SecurityStatusDto, String> {
    if !security::is_pin_configured(&app)? {
        return Err("PIN non configurato.".into());
    }
    if !security::verify_pin(&app, &pin)? {
        return Err("PIN non valido.".into());
    }
    session.unlock_vault();
    security::build_status(&app, &session)
}

#[tauri::command]
fn security_lock(
    app: tauri::AppHandle,
    session: tauri::State<SessionState>,
) -> Result<security::SecurityStatusDto, String> {
    session.lock_vault();
    security::build_status(&app, &session)
}

#[tauri::command]
fn security_change_pin(
    app: tauri::AppHandle,
    session: tauri::State<SessionState>,
    old_pin: String,
    new_pin: String,
) -> Result<(), String> {
    security::require_vault_access(&app, &session)?;
    if !security::verify_pin(&app, &old_pin)? {
        return Err("PIN attuale errato.".into());
    }
    security::replace_pin(&app, &new_pin)?;
    session.unlock_vault();
    Ok(())
}

#[tauri::command]
fn integrations_list(
    app: tauri::AppHandle,
    session: tauri::State<SessionState>,
) -> Result<Vec<db::IntegrationDto>, String> {
    security::require_vault_access(&app, &session)?;
    db::list_integrations(&app)
}

#[tauri::command]
fn integrations_add(
    app: tauri::AppHandle,
    session: tauri::State<SessionState>,
    provider: String,
    label: String,
) -> Result<db::IntegrationDto, String> {
    security::require_vault_access(&app, &session)?;
    db::add_integration(&app, &provider, &label)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CloudflareStatusDto {
    pub linked: bool,
    pub account_id: Option<String>,
}

#[tauri::command]
fn cloudflare_link(
    app: tauri::AppHandle,
    session: tauri::State<SessionState>,
    integration_id: String,
    account_id: String,
    api_token: String,
) -> Result<CloudflareStatusDto, String> {
    security::require_vault_access(&app, &session)?;
    let row = db::get_integration_by_id(&app, &integration_id)?
        .ok_or_else(|| "Integrazione non trovata.".to_string())?;
    if row.provider != "cloudflare" {
        return Err("L'integrazione non è Cloudflare.".into());
    }
    let account_id = account_id.trim().to_string();
    let api_token = api_token.trim().to_string();
    if account_id.is_empty() || api_token.is_empty() {
        return Err("Account ID e API Token sono obbligatori.".into());
    }
    cf_api::verify_api_token(&api_token)?;
    cf_api::verify_account(&api_token, &account_id)?;
    secrets::cf_token_save(&integration_id, &api_token)?;
    db::upsert_cloudflare_account(&app, &integration_id, &account_id)?;
    Ok(CloudflareStatusDto {
        linked: true,
        account_id: Some(account_id),
    })
}

#[tauri::command]
fn cloudflare_status(
    app: tauri::AppHandle,
    session: tauri::State<SessionState>,
    integration_id: String,
) -> Result<CloudflareStatusDto, String> {
    security::require_vault_access(&app, &session)?;
    let row = db::get_integration_by_id(&app, &integration_id)?
        .ok_or_else(|| "Integrazione non trovata.".to_string())?;
    if row.provider != "cloudflare" {
        return Err("L'integrazione non è Cloudflare.".into());
    }
    let acc = db::get_cloudflare_account_id(&app, &integration_id)?;
    let tok = secrets::cf_token_get(&integration_id)?;
    let linked = acc.is_some() && tok.is_some();
    Ok(CloudflareStatusDto {
        linked,
        account_id: if linked { acc } else { None },
    })
}

#[tauri::command]
fn cloudflare_list_tokens(
    app: tauri::AppHandle,
    session: tauri::State<SessionState>,
    integration_id: String,
) -> Result<Vec<cf_api::CfTokenRow>, String> {
    security::require_vault_access(&app, &session)?;
    let row = db::get_integration_by_id(&app, &integration_id)?
        .ok_or_else(|| "Integrazione non trovata.".to_string())?;
    if row.provider != "cloudflare" {
        return Err("L'integrazione non è Cloudflare.".into());
    }
    let account_id = db::get_cloudflare_account_id(&app, &integration_id)?
        .ok_or_else(|| "Cloudflare non collegato.".to_string())?;
    let token = secrets::cf_token_get(&integration_id)?
        .ok_or_else(|| "Token non trovato nel portachiavi.".to_string())?;
    cf_api::list_account_tokens(&token, &account_id)
}

#[tauri::command]
fn cloudflare_reveal_managed_token(
    app: tauri::AppHandle,
    session: tauri::State<SessionState>,
    integration_id: String,
) -> Result<String, String> {
    security::require_vault_access(&app, &session)?;
    let row = db::get_integration_by_id(&app, &integration_id)?
        .ok_or_else(|| "Integrazione non trovata.".to_string())?;
    if row.provider != "cloudflare" {
        return Err("L'integrazione non è Cloudflare.".into());
    }
    let linked = db::get_cloudflare_account_id(&app, &integration_id)?.is_some();
    if !linked {
        return Err("Cloudflare non collegato.".into());
    }
    secrets::cf_token_get(&integration_id)?
        .ok_or_else(|| "Token non trovato nel portachiavi.".to_string())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CloudflareRotateResultDto {
    pub new_token_id: String,
    pub new_token_secret: String,
    pub old_token_id: String,
    pub revoked_old: bool,
    pub updated_vault_secret: bool,
}

/// Clona le policy di un token, crea un nuovo token, opzionalmente aggiorna il vault e revoca il vecchio.
#[tauri::command]
fn cloudflare_rotate_account_token(
    app: tauri::AppHandle,
    session: tauri::State<SessionState>,
    integration_id: String,
    source_token_id: String,
    revoke_old: bool,
    update_vault_secret: bool,
) -> Result<CloudflareRotateResultDto, String> {
    security::require_vault_access(&app, &session)?;
    let row = db::get_integration_by_id(&app, &integration_id)?
        .ok_or_else(|| "Integrazione non trovata.".to_string())?;
    if row.provider != "cloudflare" {
        return Err("L'integrazione non è Cloudflare.".into());
    }
    let account_id = db::get_cloudflare_account_id(&app, &integration_id)?
        .ok_or_else(|| "Cloudflare non collegato.".to_string())?;
    let mgmt = secrets::cf_token_get(&integration_id)?
        .ok_or_else(|| "Token non trovato nel portachiavi.".to_string())?;

    let source_token_id = source_token_id.trim().to_string();
    if source_token_id.is_empty() {
        return Err("ID token sorgente mancante.".into());
    }

    let detail = cf_api::get_account_token_detail(&mgmt, &account_id, &source_token_id)?;
    let base_name = detail
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("API token");
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_secs();
    let new_name = format!("{base_name} · rotate {ts}");

    let body = cf_api::build_token_create_body(&detail, &new_name)?;
    let (new_id, new_secret) = cf_api::create_account_token(&mgmt, &account_id, &body)?;

    if update_vault_secret {
        secrets::cf_token_save(&integration_id, &new_secret)?;
    }

    let revoked_old = if revoke_old {
        let mgmt_for_delete = secrets::cf_token_get(&integration_id)?
            .ok_or_else(|| "Token di gestione assente nel portachiavi.".to_string())?;
        cf_api::delete_account_token(&mgmt_for_delete, &account_id, &source_token_id)?;
        true
    } else {
        false
    };

    Ok(CloudflareRotateResultDto {
        new_token_id: new_id,
        new_token_secret: new_secret,
        old_token_id: source_token_id,
        revoked_old,
        updated_vault_secret: update_vault_secret,
    })
}

#[tauri::command]
fn cloudflare_unlink(
    app: tauri::AppHandle,
    session: tauri::State<SessionState>,
    integration_id: String,
) -> Result<(), String> {
    security::require_vault_access(&app, &session)?;
    let row = db::get_integration_by_id(&app, &integration_id)?
        .ok_or_else(|| "Integrazione non trovata.".to_string())?;
    if row.provider != "cloudflare" {
        return Err("L'integrazione non è Cloudflare.".into());
    }
    secrets::cf_token_delete(&integration_id)?;
    db::delete_cloudflare_account_row(&app, &integration_id)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(SessionState::new())
        .setup(|app| {
            db::init(app.handle())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            platform_blurb,
            security_status,
            security_set_pin,
            security_unlock,
            security_lock,
            security_change_pin,
            integrations_list,
            integrations_add,
            cloudflare_link,
            cloudflare_status,
            cloudflare_list_tokens,
            cloudflare_reveal_managed_token,
            cloudflare_rotate_account_token,
            cloudflare_unlink,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
