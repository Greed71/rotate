//! Rotate - backend Tauri (comandi IPC verso il frontend).

mod cf_api;
mod db;
mod secrets;
mod security;
mod supabase_api;
mod vercel_api;

use security::SessionState;
use serde::{Deserialize, Serialize};
use std::time::Duration;

fn vault_unlock_with_saved_ttl(
    app: &tauri::AppHandle,
    session: &SessionState,
) -> Result<(), String> {
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

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VercelStatusDto {
    pub linked: bool,
    pub user_email: Option<String>,
    pub team_id: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SupabaseStatusDto {
    pub linked: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct VercelEnvUpsertCommand {
    integration_id: String,
    project_id: String,
    project_name: String,
    key: String,
    value: String,
    targets: Vec<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SupabaseSecretsBulkUpsertCommand {
    integration_id: String,
    project_ref: String,
    project_name: String,
    names: Vec<String>,
    value: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SupabaseApiKeyRotateCommand {
    integration_id: String,
    project_ref: String,
    key_id: String,
    delete_old: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SupabaseDatabasePasswordRotateCommand {
    integration_id: String,
    project_ref: String,
    confirm_project_ref: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SecretsStoreUpsertCommand {
    integration_id: String,
    store_id: String,
    secret_id: Option<String>,
    secret_name: String,
    secret_value: String,
    scopes: Vec<String>,
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

fn require_provider_integration(
    app: &tauri::AppHandle,
    integration_id: &str,
    provider: &str,
) -> Result<db::IntegrationDto, String> {
    let row = db::get_integration_by_id(app, integration_id)?
        .ok_or_else(|| "Integrazione non trovata.".to_string())?;
    if row.provider != provider {
        return Err(format!("L'integrazione non e {provider}."));
    }
    Ok(row)
}

struct CloudflareContext {
    account_id: String,
    token: String,
}

fn cloudflare_context(
    app: &tauri::AppHandle,
    integration_id: &str,
) -> Result<CloudflareContext, String> {
    require_cloudflare_integration(app, integration_id)?;
    let account_id = db::get_cloudflare_account_id(app, integration_id)?
        .ok_or_else(|| "Cloudflare non collegato.".to_string())?;
    let token = secrets::cf_token_get(app, integration_id)?
        .ok_or_else(|| "Token non trovato nello storage sicuro.".to_string())?;
    Ok(CloudflareContext { account_id, token })
}

fn cloudflare_context_keyring_message(
    app: &tauri::AppHandle,
    integration_id: &str,
) -> Result<CloudflareContext, String> {
    require_cloudflare_integration(app, integration_id)?;
    let account_id = db::get_cloudflare_account_id(app, integration_id)?
        .ok_or_else(|| "Cloudflare non collegato.".to_string())?;
    let token = secrets::cf_token_get(app, integration_id)?
        .ok_or_else(|| "Token non trovato nel portachiavi.".to_string())?;
    Ok(CloudflareContext { account_id, token })
}

fn vercel_context(
    app: &tauri::AppHandle,
    integration_id: &str,
) -> Result<(String, Option<String>), String> {
    require_provider_integration(app, integration_id, "vercel")?;
    let acc = db::get_vercel_account(app, integration_id)?
        .ok_or_else(|| "Vercel non collegato.".to_string())?;
    let token = secrets::vercel_token_get(app, integration_id)?
        .ok_or_else(|| "Token Vercel non trovato nello storage sicuro.".to_string())?;
    Ok((token, acc.team_id))
}

fn supabase_context(app: &tauri::AppHandle, integration_id: &str) -> Result<String, String> {
    require_provider_integration(app, integration_id, "supabase")?;
    secrets::supabase_token_get(app, integration_id)?
        .ok_or_else(|| "Token Supabase non trovato nello storage sicuro.".to_string())
}

#[tauri::command]
fn supabase_link(
    app: tauri::AppHandle,
    session: tauri::State<SessionState>,
    integration_id: String,
    access_token: String,
) -> Result<SupabaseStatusDto, String> {
    security::require_vault_access(&app, &session)?;
    require_provider_integration(&app, &integration_id, "supabase")?;

    let access_token = access_token.trim().to_string();
    if access_token.is_empty() {
        return Err("Personal Access Token Supabase obbligatorio.".into());
    }
    supabase_api::verify_token(&access_token)?;
    secrets::supabase_token_save(&app, &integration_id, &access_token)?;
    let saved = secrets::supabase_token_get(&app, &integration_id)?.ok_or_else(|| {
        "Il token Supabase e valido, ma non e stato possibile rileggerlo.".to_string()
    })?;
    if saved != access_token {
        return Err(
            "Lo storage sicuro ha restituito un valore diverso dal token Supabase appena salvato."
                .into(),
        );
    }
    Ok(SupabaseStatusDto { linked: true })
}

#[tauri::command]
fn supabase_status(
    app: tauri::AppHandle,
    session: tauri::State<SessionState>,
    integration_id: String,
) -> Result<SupabaseStatusDto, String> {
    security::require_vault_access(&app, &session)?;
    require_provider_integration(&app, &integration_id, "supabase")?;
    let token = secrets::supabase_token_get(&app, &integration_id)?;
    Ok(SupabaseStatusDto {
        linked: token.is_some(),
    })
}

#[tauri::command]
fn supabase_list_projects(
    app: tauri::AppHandle,
    session: tauri::State<SessionState>,
    integration_id: String,
) -> Result<Vec<supabase_api::SupabaseProjectRow>, String> {
    security::require_vault_access(&app, &session)?;
    let token = supabase_context(&app, &integration_id)?;
    supabase_api::list_projects(&token)
}

#[tauri::command]
fn supabase_list_project_secrets(
    app: tauri::AppHandle,
    session: tauri::State<SessionState>,
    integration_id: String,
    project_ref: String,
) -> Result<Vec<supabase_api::SupabaseSecretRow>, String> {
    security::require_vault_access(&app, &session)?;
    let token = supabase_context(&app, &integration_id)?;
    let project_ref = project_ref.trim();
    if project_ref.is_empty() {
        return Err("Project ref Supabase mancante.".into());
    }
    supabase_api::list_project_secrets(&token, project_ref)
}

#[tauri::command]
fn supabase_upsert_project_secrets(
    app: tauri::AppHandle,
    session: tauri::State<SessionState>,
    payload: SupabaseSecretsBulkUpsertCommand,
) -> Result<Vec<supabase_api::SupabaseSecretUpsertResult>, String> {
    security::require_vault_access(&app, &session)?;
    let token = supabase_context(&app, &payload.integration_id)?;
    let project_ref = payload.project_ref.trim();
    let project_name = payload.project_name.trim();
    if project_ref.is_empty() {
        return Err("Project ref Supabase mancante.".into());
    }
    if payload.value.is_empty() {
        return Err("Valore secret Supabase mancante.".into());
    }
    let names: Vec<String> = payload
        .names
        .iter()
        .map(|name| name.trim())
        .filter(|name| !name.is_empty())
        .map(str::to_string)
        .collect();
    if names.is_empty() {
        return Err("Seleziona almeno un secret Supabase.".into());
    }
    if names.iter().any(|name| name.starts_with("SUPABASE_")) {
        return Err("I secret Supabase non possono iniziare con SUPABASE_.".into());
    }
    let items: Vec<(String, String)> = names
        .into_iter()
        .map(|name| (name, payload.value.clone()))
        .collect();
    supabase_api::upsert_project_secrets(&token, project_ref, project_name, &items)
}

#[tauri::command]
fn supabase_list_project_api_keys(
    app: tauri::AppHandle,
    session: tauri::State<SessionState>,
    integration_id: String,
    project_ref: String,
) -> Result<Vec<supabase_api::SupabaseApiKeyRow>, String> {
    security::require_vault_access(&app, &session)?;
    let token = supabase_context(&app, &integration_id)?;
    let project_ref = project_ref.trim();
    if project_ref.is_empty() {
        return Err("Project ref Supabase mancante.".into());
    }
    supabase_api::list_project_api_keys(&token, project_ref)
}

#[tauri::command]
fn supabase_rotate_project_api_key(
    app: tauri::AppHandle,
    session: tauri::State<SessionState>,
    payload: SupabaseApiKeyRotateCommand,
) -> Result<supabase_api::SupabaseApiKeyRotateResult, String> {
    security::require_vault_access(&app, &session)?;
    let token = supabase_context(&app, &payload.integration_id)?;
    let project_ref = payload.project_ref.trim();
    let key_id = payload.key_id.trim();
    if project_ref.is_empty() {
        return Err("Project ref Supabase mancante.".into());
    }
    if key_id.is_empty() {
        return Err("API key Supabase mancante.".into());
    }
    let keys = supabase_api::list_project_api_keys(&token, project_ref)?;
    let source = keys
        .into_iter()
        .find(|key| key.id == key_id)
        .ok_or_else(|| "API key Supabase non trovata.".to_string())?;
    supabase_api::rotate_project_api_key(&token, project_ref, &source, payload.delete_old)
}

#[tauri::command]
fn supabase_rotate_database_password(
    app: tauri::AppHandle,
    session: tauri::State<SessionState>,
    payload: SupabaseDatabasePasswordRotateCommand,
) -> Result<supabase_api::SupabaseDatabasePasswordRotateResult, String> {
    security::require_vault_access(&app, &session)?;
    let token = supabase_context(&app, &payload.integration_id)?;
    let project_ref = payload.project_ref.trim();
    if project_ref.is_empty() {
        return Err("Project ref Supabase mancante.".into());
    }
    if payload.confirm_project_ref.trim() != project_ref {
        return Err("Conferma il project ref prima di ruotare la password del database.".into());
    }
    supabase_api::rotate_database_password(&token, project_ref)
}

#[tauri::command]
fn supabase_unlink(
    app: tauri::AppHandle,
    session: tauri::State<SessionState>,
    integration_id: String,
) -> Result<(), String> {
    security::require_vault_access(&app, &session)?;
    require_provider_integration(&app, &integration_id, "supabase")?;
    secrets::supabase_token_delete(&app, &integration_id)
}

#[tauri::command]
fn vercel_link(
    app: tauri::AppHandle,
    session: tauri::State<SessionState>,
    integration_id: String,
    api_token: String,
    team_id: Option<String>,
) -> Result<VercelStatusDto, String> {
    security::require_vault_access(&app, &session)?;
    require_provider_integration(&app, &integration_id, "vercel")?;

    let api_token = api_token.trim().to_string();
    if api_token.is_empty() {
        return Err("Token Vercel obbligatorio.".into());
    }
    let team_id = team_id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string());

    let user = vercel_api::verify_token(&api_token)?;
    secrets::vercel_token_save(&app, &integration_id, &api_token)?;
    let saved = secrets::vercel_token_get(&app, &integration_id)?.ok_or_else(|| {
        "Il token Vercel e valido, ma non e stato possibile rileggerlo.".to_string()
    })?;
    if saved != api_token {
        return Err(
            "Lo storage sicuro ha restituito un valore diverso dal token Vercel appena salvato."
                .into(),
        );
    }
    db::upsert_vercel_account(
        &app,
        &integration_id,
        &user.id,
        user.email.as_deref(),
        team_id.as_deref(),
    )?;
    Ok(VercelStatusDto {
        linked: true,
        user_email: user.email,
        team_id,
    })
}

#[tauri::command]
fn vercel_status(
    app: tauri::AppHandle,
    session: tauri::State<SessionState>,
    integration_id: String,
) -> Result<VercelStatusDto, String> {
    security::require_vault_access(&app, &session)?;
    require_provider_integration(&app, &integration_id, "vercel")?;
    let acc = db::get_vercel_account(&app, &integration_id)?;
    let token = secrets::vercel_token_get(&app, &integration_id)?;
    Ok(VercelStatusDto {
        linked: acc.is_some() && token.is_some(),
        user_email: acc.as_ref().and_then(|a| a.user_email.clone()),
        team_id: acc.and_then(|a| a.team_id),
    })
}

#[tauri::command]
fn vercel_list_projects(
    app: tauri::AppHandle,
    session: tauri::State<SessionState>,
    integration_id: String,
) -> Result<Vec<vercel_api::VercelProjectRow>, String> {
    security::require_vault_access(&app, &session)?;
    let (token, team_id) = vercel_context(&app, &integration_id)?;
    vercel_api::list_projects(&token, team_id.as_deref())
}

#[tauri::command]
fn vercel_list_project_envs(
    app: tauri::AppHandle,
    session: tauri::State<SessionState>,
    integration_id: String,
    project_id: String,
) -> Result<Vec<vercel_api::VercelEnvVarRow>, String> {
    security::require_vault_access(&app, &session)?;
    let (token, team_id) = vercel_context(&app, &integration_id)?;
    let project_id = project_id.trim();
    if project_id.is_empty() {
        return Err("Progetto Vercel mancante.".into());
    }
    vercel_api::list_project_envs(&token, team_id.as_deref(), project_id)
}

#[tauri::command]
fn vercel_upsert_project_env(
    app: tauri::AppHandle,
    session: tauri::State<SessionState>,
    payload: VercelEnvUpsertCommand,
) -> Result<vercel_api::VercelEnvUpsertResult, String> {
    security::require_vault_access(&app, &session)?;
    let (token, team_id) = vercel_context(&app, &payload.integration_id)?;
    let project_id = payload.project_id.trim();
    let project_name = payload.project_name.trim();
    let key = payload.key.trim();
    if project_id.is_empty() {
        return Err("Progetto Vercel mancante.".into());
    }
    if key.is_empty() {
        return Err("Nome variabile Vercel mancante.".into());
    }
    if payload.value.is_empty() {
        return Err("Valore variabile Vercel mancante.".into());
    }
    vercel_api::upsert_project_env(
        &token,
        team_id.as_deref(),
        project_id,
        project_name,
        key,
        &payload.value,
        &payload.targets,
    )
}

#[tauri::command]
fn vercel_unlink(
    app: tauri::AppHandle,
    session: tauri::State<SessionState>,
    integration_id: String,
) -> Result<(), String> {
    security::require_vault_access(&app, &session)?;
    require_provider_integration(&app, &integration_id, "vercel")?;
    secrets::vercel_token_delete(&app, &integration_id)?;
    db::delete_vercel_account_row(&app, &integration_id)
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
        return Err(
            "Il portachiavi ha restituito un valore diverso dal token appena salvato.".into(),
        );
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
    let cf = cloudflare_context_keyring_message(&app, &integration_id)?;
    cf_api::list_account_tokens(&cf.token, &cf.account_id)
}

#[tauri::command]
fn cloudflare_list_turnstile_widgets(
    app: tauri::AppHandle,
    session: tauri::State<SessionState>,
    integration_id: String,
) -> Result<Vec<cf_api::TurnstileWidgetRow>, String> {
    security::require_vault_access(&app, &session)?;
    let cf = cloudflare_context(&app, &integration_id)?;
    cf_api::list_turnstile_widgets(&cf.token, &cf.account_id)
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
    let cf = cloudflare_context(&app, &integration_id)?;
    let sitekey = sitekey.trim();
    if sitekey.is_empty() {
        return Err("Sitekey Turnstile mancante.".into());
    }
    cf_api::rotate_turnstile_secret(&cf.token, &cf.account_id, sitekey, invalidate_immediately)
}

#[tauri::command]
fn cloudflare_list_worker_scripts(
    app: tauri::AppHandle,
    session: tauri::State<SessionState>,
    integration_id: String,
) -> Result<Vec<cf_api::WorkerScriptRow>, String> {
    security::require_vault_access(&app, &session)?;
    let cf = cloudflare_context(&app, &integration_id)?;
    cf_api::list_worker_scripts(&cf.token, &cf.account_id)
}

#[tauri::command]
fn cloudflare_list_worker_secrets(
    app: tauri::AppHandle,
    session: tauri::State<SessionState>,
    integration_id: String,
    script_name: String,
) -> Result<Vec<cf_api::WorkerSecretRow>, String> {
    security::require_vault_access(&app, &session)?;
    let cf = cloudflare_context(&app, &integration_id)?;
    let script_name = script_name.trim();
    if script_name.is_empty() {
        return Err("Worker mancante.".into());
    }
    cf_api::list_worker_secrets(&cf.token, &cf.account_id, script_name)
}

#[tauri::command]
fn cloudflare_update_worker_secret(
    app: tauri::AppHandle,
    session: tauri::State<SessionState>,
    integration_id: String,
    script_name: String,
    secret_name: String,
    secret_value: String,
) -> Result<cf_api::WorkerSecretRow, String> {
    security::require_vault_access(&app, &session)?;
    let cf = cloudflare_context(&app, &integration_id)?;
    let script_name = script_name.trim();
    let secret_name = secret_name.trim();
    if script_name.is_empty() {
        return Err("Worker mancante.".into());
    }
    if secret_name.is_empty() {
        return Err("Nome secret Workers mancante.".into());
    }
    if secret_value.is_empty() {
        return Err("Valore secret mancante.".into());
    }
    cf_api::update_worker_secret(
        &cf.token,
        &cf.account_id,
        script_name,
        secret_name,
        &secret_value,
    )
}

#[tauri::command]
fn cloudflare_list_access_service_tokens(
    app: tauri::AppHandle,
    session: tauri::State<SessionState>,
    integration_id: String,
) -> Result<Vec<cf_api::AccessServiceTokenRow>, String> {
    security::require_vault_access(&app, &session)?;
    let cf = cloudflare_context(&app, &integration_id)?;
    cf_api::list_access_service_tokens(&cf.token, &cf.account_id)
}

#[tauri::command]
fn cloudflare_rotate_access_service_token(
    app: tauri::AppHandle,
    session: tauri::State<SessionState>,
    integration_id: String,
    service_token_id: String,
    previous_client_secret_expires_at: Option<String>,
) -> Result<cf_api::AccessServiceTokenRotateResult, String> {
    security::require_vault_access(&app, &session)?;
    let cf = cloudflare_context(&app, &integration_id)?;
    let service_token_id = service_token_id.trim();
    if service_token_id.is_empty() {
        return Err("ID Service Token mancante.".into());
    }
    cf_api::rotate_access_service_token(
        &cf.token,
        &cf.account_id,
        service_token_id,
        previous_client_secret_expires_at.as_deref(),
    )
}

#[tauri::command]
fn cloudflare_list_pages_projects(
    app: tauri::AppHandle,
    session: tauri::State<SessionState>,
    integration_id: String,
) -> Result<Vec<cf_api::PagesProjectRow>, String> {
    security::require_vault_access(&app, &session)?;
    let cf = cloudflare_context(&app, &integration_id)?;
    cf_api::list_pages_projects(&cf.token, &cf.account_id)
}

#[tauri::command]
fn cloudflare_update_pages_secret(
    app: tauri::AppHandle,
    session: tauri::State<SessionState>,
    integration_id: String,
    project_name: String,
    environment: String,
    secret_name: String,
    secret_value: String,
) -> Result<cf_api::PagesEnvVarRow, String> {
    security::require_vault_access(&app, &session)?;
    let cf = cloudflare_context(&app, &integration_id)?;
    let project_name = project_name.trim();
    let secret_name = secret_name.trim();
    if project_name.is_empty() {
        return Err("Progetto Pages mancante.".into());
    }
    if secret_name.is_empty() {
        return Err("Nome secret Pages mancante.".into());
    }
    if secret_value.is_empty() {
        return Err("Valore secret mancante.".into());
    }
    cf_api::update_pages_secret(
        &cf.token,
        &cf.account_id,
        project_name,
        environment.trim(),
        secret_name,
        &secret_value,
    )
}

#[tauri::command]
fn cloudflare_list_secrets_stores(
    app: tauri::AppHandle,
    session: tauri::State<SessionState>,
    integration_id: String,
) -> Result<Vec<cf_api::SecretsStoreRow>, String> {
    security::require_vault_access(&app, &session)?;
    let cf = cloudflare_context(&app, &integration_id)?;
    cf_api::list_secrets_stores(&cf.token, &cf.account_id)
}

#[tauri::command]
fn cloudflare_list_secrets_store_secrets(
    app: tauri::AppHandle,
    session: tauri::State<SessionState>,
    integration_id: String,
    store_id: String,
) -> Result<Vec<cf_api::SecretsStoreSecretRow>, String> {
    security::require_vault_access(&app, &session)?;
    let cf = cloudflare_context(&app, &integration_id)?;
    let store_id = store_id.trim();
    if store_id.is_empty() {
        return Err("Secrets Store mancante.".into());
    }
    cf_api::list_secrets_store_secrets(&cf.token, &cf.account_id, store_id)
}

#[tauri::command]
fn cloudflare_upsert_secrets_store_secret(
    app: tauri::AppHandle,
    session: tauri::State<SessionState>,
    payload: SecretsStoreUpsertCommand,
) -> Result<cf_api::SecretsStoreSecretRow, String> {
    security::require_vault_access(&app, &session)?;
    let cf = cloudflare_context(&app, &payload.integration_id)?;
    let store_id = payload.store_id.trim();
    let secret_name = payload.secret_name.trim();
    if store_id.is_empty() {
        return Err("Secrets Store mancante.".into());
    }
    if secret_name.is_empty() {
        return Err("Nome secret Secrets Store mancante.".into());
    }
    if payload.secret_value.is_empty() {
        return Err("Valore secret mancante.".into());
    }
    cf_api::upsert_secrets_store_secret(
        &cf.token,
        &cf.account_id,
        cf_api::SecretsStoreSecretUpsert {
            store_id,
            secret_id: payload.secret_id.as_deref(),
            secret_name,
            secret_value: &payload.secret_value,
            scopes: &payload.scopes,
            comment: Some("Updated by Rotate"),
        },
    )
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
        if environment.is_empty() {
            "production"
        } else {
            environment
        },
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
    let cf = cloudflare_context_keyring_message(&app, &integration_id)?;

    let source_token_id = source_token_id.trim().to_string();
    if source_token_id.is_empty() {
        return Err("ID token sorgente mancante.".into());
    }
    if update_vault_secret {
        return Err(
            "La rotazione dei segreti gestiti non aggiorna il token di gestione di Rotate.".into(),
        );
    }
    if db::get_cloudflare_management_token_id(&app, &integration_id)?.as_deref()
        == Some(source_token_id.as_str())
    {
        return Err(
            "Questo e il token di gestione usato da Rotate. Ruotalo da un flusso dedicato.".into(),
        );
    }

    let detail = cf_api::get_account_token_detail(&cf.token, &cf.account_id, &source_token_id)?;
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
    let (new_id, new_secret) = cf_api::create_account_token(&cf.token, &cf.account_id, &body)?;

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
        cf_api::delete_account_token(&cf.token, &cf.account_id, &source_token_id)?;
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
            supabase_link,
            supabase_status,
            supabase_list_projects,
            supabase_list_project_secrets,
            supabase_upsert_project_secrets,
            supabase_list_project_api_keys,
            supabase_rotate_project_api_key,
            supabase_rotate_database_password,
            supabase_unlink,
            vercel_link,
            vercel_status,
            vercel_list_projects,
            vercel_list_project_envs,
            vercel_upsert_project_env,
            vercel_unlink,
            cloudflare_link,
            cloudflare_status,
            cloudflare_secret_storage_diagnostics,
            cloudflare_list_tokens,
            cloudflare_list_turnstile_widgets,
            cloudflare_rotate_turnstile_secret,
            cloudflare_list_worker_scripts,
            cloudflare_list_worker_secrets,
            cloudflare_update_worker_secret,
            cloudflare_list_access_service_tokens,
            cloudflare_rotate_access_service_token,
            cloudflare_list_pages_projects,
            cloudflare_update_pages_secret,
            cloudflare_list_secrets_stores,
            cloudflare_list_secrets_store_secrets,
            cloudflare_upsert_secrets_store_secret,
            cloudflare_reveal_managed_token,
            cloudflare_managed_secrets_list,
            cloudflare_track_managed_secret,
            cloudflare_rotate_account_token,
            cloudflare_unlink,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
