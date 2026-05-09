//! Rotate - backend Tauri (comandi IPC verso il frontend).

mod cf_api;
mod db;
mod secrets;
mod security;

use security::SessionState;
use serde::Serialize;
use std::time::Duration;

fn vault_unlock_with_saved_ttl(app: &tauri::AppHandle, session: &SessionState) -> Result<(), String> {
    let sec = db::get_session_ttl_seconds(app)?;
    session.unlock_vault(Duration::from_secs(u64::from(sec)));
    Ok(())
}

/// Diagnostica: non espone segreti.
#[tauri::command]
fn platform_blurb() -> String {
    format!(
        "Backend ready - OS: {} - arch: {} - v{}",
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
    vault_unlock_with_saved_ttl(&app, &session)?;
    security::build_status(&app, &session)
}

#[tauri::command]
fn security_unlock(
    app: tauri::AppHandle,
    session: tauri::State<SessionState>,
    pin: String,
) -> Result<security::SecurityStatusDto, String> {
    if !security::is_pin_configured(&app)? {
        return Err("Password vault non configurata.".into());
    }
    session.require_auth_allowed()?;
    if !security::verify_pin(&app, &pin)? {
        session.register_auth_failure();
        return Err("Password non valida.".into());
    }
    session.register_auth_success();
    vault_unlock_with_saved_ttl(&app, &session)?;
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
    session.require_auth_allowed()?;
    if !security::verify_pin(&app, &old_pin)? {
        session.register_auth_failure();
        return Err("Password attuale errata.".into());
    }
    if old_pin == new_pin {
        return Err("La nuova password del vault deve essere diversa da quella attuale.".into());
    }
    session.register_auth_success();
    security::replace_pin(&app, &new_pin)?;
    vault_unlock_with_saved_ttl(&app, &session)?;
    Ok(())
}

#[tauri::command]
fn security_set_session_ttl(
    app: tauri::AppHandle,
    session: tauri::State<SessionState>,
    ttl_seconds: u32,
) -> Result<security::SecurityStatusDto, String> {
    security::require_vault_access(&app, &session)?;
    db::set_session_ttl_seconds(&app, ttl_seconds)?;
    if session.is_unlocked() {
        session.unlock_vault(Duration::from_secs(u64::from(ttl_seconds)));
    }
    security::build_status(&app, &session)
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

fn require_cloudflare_integration(
    app: &tauri::AppHandle,
    integration_id: &str,
) -> Result<db::IntegrationDto, String> {
    let row = db::get_integration_by_id(app, integration_id)?
        .ok_or_else(|| "Integrazione non trovata.".to_string())?;
    if row.provider != "cloudflare" {
        return Err("L'integrazione non e Cloudflare.".into());
    }
    Ok(row)
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
    require_cloudflare_integration(&app, &integration_id)?;

    let account_id = account_id.trim().to_string();
    let api_token = api_token.trim().to_string();
    if account_id.is_empty() || api_token.is_empty() {
        return Err("Account ID e API Token sono obbligatori.".into());
    }

    let management_token_id = cf_api::verify_api_token(&api_token)?;
    cf_api::verify_account(&api_token, &account_id)?;
    secrets::cf_token_save(&app, &integration_id, &api_token)?;
    let saved_token = secrets::cf_token_get(&app, &integration_id)?.ok_or_else(|| {
        "Il token Cloudflare e valido, ma non e stato possibile rileggerlo dal portachiavi di sistema."
            .to_string()
    })?;
    if saved_token != api_token {
        return Err("Il portachiavi ha restituito un valore diverso dal token appena salvato.".into());
    }

    db::upsert_cloudflare_account(
        &app,
        &integration_id,
        &account_id,
        management_token_id.as_deref(),
    )?;
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
    require_cloudflare_integration(&app, &integration_id)?;

    let acc = db::get_cloudflare_account_id(&app, &integration_id)?;
    let tok = secrets::cf_token_get(&app, &integration_id)?;
    let linked = acc.is_some() && tok.is_some();
    Ok(CloudflareStatusDto {
        linked,
        account_id: acc,
    })
}

#[tauri::command]
fn cloudflare_secret_storage_diagnostics(
    app: tauri::AppHandle,
    session: tauri::State<SessionState>,
    integration_id: String,
) -> Result<secrets::SecretStorageDiagnosticsDto, String> {
    security::require_vault_access(&app, &session)?;
    require_cloudflare_integration(&app, &integration_id)?;
    Ok(secrets::diagnostics(&integration_id))
}

#[tauri::command]
fn cloudflare_list_tokens(
    app: tauri::AppHandle,
    session: tauri::State<SessionState>,
    integration_id: String,
) -> Result<Vec<cf_api::CfTokenRow>, String> {
    security::require_vault_access(&app, &session)?;
    require_cloudflare_integration(&app, &integration_id)?;

    let account_id = db::get_cloudflare_account_id(&app, &integration_id)?
        .ok_or_else(|| "Cloudflare non collegato.".to_string())?;
    let token = secrets::cf_token_get(&app, &integration_id)?
        .ok_or_else(|| "Token non trovato nel portachiavi.".to_string())?;
    cf_api::list_account_tokens(&token, &account_id)
}

#[tauri::command]
fn cloudflare_list_turnstile_widgets(
    app: tauri::AppHandle,
    session: tauri::State<SessionState>,
    integration_id: String,
) -> Result<Vec<cf_api::TurnstileWidgetRow>, String> {
    security::require_vault_access(&app, &session)?;
    require_cloudflare_integration(&app, &integration_id)?;

    let account_id = db::get_cloudflare_account_id(&app, &integration_id)?
        .ok_or_else(|| "Cloudflare non collegato.".to_string())?;
    let token = secrets::cf_token_get(&app, &integration_id)?
        .ok_or_else(|| "Token non trovato nello storage sicuro.".to_string())?;
    cf_api::list_turnstile_widgets(&token, &account_id)
}

#[tauri::command]
fn cloudflare_rotate_turnstile_secret(
    app: tauri::AppHandle,
    session: tauri::State<SessionState>,
    integration_id: String,
    sitekey: String,
    invalidate_immediately: bool,
) -> Result<cf_api::TurnstileRotateResult, String> {
    security::require_vault_access(&app, &session)?;
    require_cloudflare_integration(&app, &integration_id)?;

    let account_id = db::get_cloudflare_account_id(&app, &integration_id)?
        .ok_or_else(|| "Cloudflare non collegato.".to_string())?;
    let token = secrets::cf_token_get(&app, &integration_id)?
        .ok_or_else(|| "Token non trovato nello storage sicuro.".to_string())?;
    let sitekey = sitekey.trim();
    if sitekey.is_empty() {
        return Err("Sitekey Turnstile mancante.".into());
    }
    cf_api::rotate_turnstile_secret(&token, &account_id, sitekey, invalidate_immediately)
}

#[tauri::command]
fn cloudflare_reveal_managed_token(
    app: tauri::AppHandle,
    session: tauri::State<SessionState>,
    integration_id: String,
) -> Result<String, String> {
    security::require_vault_access(&app, &session)?;
    require_cloudflare_integration(&app, &integration_id)?;

    let linked = db::get_cloudflare_account_id(&app, &integration_id)?.is_some();
    if !linked {
        return Err("Cloudflare non collegato.".into());
    }
    secrets::cf_token_get(&app, &integration_id)?
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
    pub tracked_secret_updated: bool,
}

#[tauri::command]
fn cloudflare_managed_secrets_list(
    app: tauri::AppHandle,
    session: tauri::State<SessionState>,
    integration_id: String,
) -> Result<Vec<db::ManagedSecretDto>, String> {
    security::require_vault_access(&app, &session)?;
    require_cloudflare_integration(&app, &integration_id)?;
    db::list_managed_secrets(&app, &integration_id)
}

#[tauri::command]
fn cloudflare_track_managed_secret(
    app: tauri::AppHandle,
    session: tauri::State<SessionState>,
    integration_id: String,
    token_id: String,
    label: String,
    environment: String,
) -> Result<db::ManagedSecretDto, String> {
    security::require_vault_access(&app, &session)?;
    require_cloudflare_integration(&app, &integration_id)?;
    let token_id = token_id.trim();
    if token_id.is_empty() {
        return Err("ID token mancante.".into());
    }
    let environment = environment.trim();
    db::upsert_managed_secret(
        &app,
        &integration_id,
        "cloudflare",
        token_id,
        label.trim(),
        if environment.is_empty() { "production" } else { environment },
    )
}

/// Clona le policy di un token gestito, crea un nuovo token e opzionalmente revoca il vecchio.
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
    require_cloudflare_integration(&app, &integration_id)?;

    let account_id = db::get_cloudflare_account_id(&app, &integration_id)?
        .ok_or_else(|| "Cloudflare non collegato.".to_string())?;
    let mgmt = secrets::cf_token_get(&app, &integration_id)?
        .ok_or_else(|| "Token non trovato nel portachiavi.".to_string())?;

    let source_token_id = source_token_id.trim().to_string();
    if source_token_id.is_empty() {
        return Err("ID token sorgente mancante.".into());
    }
    if update_vault_secret {
        return Err(
            "La rotazione dei segreti gestiti non aggiorna il token di gestione di Rotate.".into(),
        );
    }
    if db::get_cloudflare_management_token_id(&app, &integration_id)?
        .as_deref()
        == Some(source_token_id.as_str())
    {
        return Err(
            "Questo e il token di gestione usato da Rotate. Ruotalo da un flusso dedicato.".into(),
        );
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
    let new_name = format!("{base_name} - rotate {ts}");

    let body = cf_api::build_token_create_body(&detail, &new_name)?;
    let (new_id, new_secret) = cf_api::create_account_token(&mgmt, &account_id, &body)?;

    let tracked_secret_updated =
        db::get_managed_secret_by_external_id(&app, &integration_id, &source_token_id)?.is_some();
    if tracked_secret_updated {
        db::mark_managed_secret_rotated(
            &app,
            &integration_id,
            &source_token_id,
            &new_id,
            &new_name,
        )?;
    }

    let revoked_old = if revoke_old {
        let mgmt_for_delete = secrets::cf_token_get(&app, &integration_id)?
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
        updated_vault_secret: false,
        tracked_secret_updated,
    })
}

#[tauri::command]
fn cloudflare_unlink(
    app: tauri::AppHandle,
    session: tauri::State<SessionState>,
    integration_id: String,
) -> Result<(), String> {
    security::require_vault_access(&app, &session)?;
    require_cloudflare_integration(&app, &integration_id)?;
    secrets::cf_token_delete(&app, &integration_id)?;
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
            security_set_session_ttl,
            integrations_list,
            integrations_add,
            cloudflare_link,
            cloudflare_status,
            cloudflare_secret_storage_diagnostics,
            cloudflare_list_tokens,
            cloudflare_list_turnstile_widgets,
            cloudflare_rotate_turnstile_secret,
            cloudflare_reveal_managed_token,
            cloudflare_managed_secrets_list,
            cloudflare_track_managed_secret,
            cloudflare_rotate_account_token,
            cloudflare_unlink,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
