use crate::{db, resend_api, secrets, security};
use security::SessionState;
use serde::{Deserialize, Serialize};

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

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResendStatusDto {
    pub linked: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OauthGoogleStatusDto {
    pub linked: bool,
    pub client_id: Option<String>,
    pub label: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResendRotateApiKeyCommand {
    integration_id: String,
    source_key_id: Option<String>,
    name: String,
    permission: String,
    delete_old: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OauthGoogleLinkCommand {
    integration_id: String,
    client_id: String,
    client_secret: Option<String>,
    label: Option<String>,
}

#[tauri::command]
pub fn resend_link(
    app: tauri::AppHandle,
    session: tauri::State<SessionState>,
    integration_id: String,
    api_token: String,
) -> Result<ResendStatusDto, String> {
    security::require_vault_access(&app, &session)?;
    require_provider_integration(&app, &integration_id, "resend")?;
    let api_token = api_token.trim().to_string();
    resend_api::verify_token(&api_token)?;
    secrets::resend_token_save(&app, &integration_id, &api_token)?;
    Ok(ResendStatusDto { linked: true })
}

#[tauri::command]
pub fn resend_status(
    app: tauri::AppHandle,
    session: tauri::State<SessionState>,
    integration_id: String,
) -> Result<ResendStatusDto, String> {
    security::require_vault_access(&app, &session)?;
    require_provider_integration(&app, &integration_id, "resend")?;
    Ok(ResendStatusDto {
        linked: secrets::resend_token_get(&app, &integration_id)?.is_some(),
    })
}

#[tauri::command]
pub fn resend_list_api_keys(
    app: tauri::AppHandle,
    session: tauri::State<SessionState>,
    integration_id: String,
) -> Result<Vec<resend_api::ResendApiKeyRow>, String> {
    security::require_vault_access(&app, &session)?;
    require_provider_integration(&app, &integration_id, "resend")?;
    let token = secrets::resend_token_get(&app, &integration_id)?
        .ok_or_else(|| "Token Resend non trovato.".to_string())?;
    resend_api::list_api_keys(&token)
}

#[tauri::command]
pub fn resend_rotate_api_key(
    app: tauri::AppHandle,
    session: tauri::State<SessionState>,
    payload: ResendRotateApiKeyCommand,
) -> Result<resend_api::ResendRotateResult, String> {
    security::require_vault_access(&app, &session)?;
    require_provider_integration(&app, &payload.integration_id, "resend")?;
    let token = secrets::resend_token_get(&app, &payload.integration_id)?
        .ok_or_else(|| "Token Resend non trovato.".to_string())?;
    let name = payload.name.trim();
    if name.is_empty() {
        return Err("Nome nuova API key Resend mancante.".into());
    }
    let (new_key_id, new_token) = resend_api::create_api_key(&token, name, &payload.permission)?;
    let deleted_old = if payload.delete_old {
        if let Some(old_id) = payload
            .source_key_id
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
        {
            resend_api::delete_api_key(&token, old_id)?;
            true
        } else {
            false
        }
    } else {
        false
    };
    Ok(resend_api::ResendRotateResult {
        old_key_id: payload.source_key_id,
        new_key_id,
        name: name.to_string(),
        token: new_token,
        deleted_old,
    })
}

#[tauri::command]
pub fn resend_unlink(
    app: tauri::AppHandle,
    session: tauri::State<SessionState>,
    integration_id: String,
) -> Result<(), String> {
    security::require_vault_access(&app, &session)?;
    require_provider_integration(&app, &integration_id, "resend")?;
    secrets::resend_token_delete(&app, &integration_id)
}

#[tauri::command]
pub fn oauth_google_link(
    app: tauri::AppHandle,
    session: tauri::State<SessionState>,
    payload: OauthGoogleLinkCommand,
) -> Result<OauthGoogleStatusDto, String> {
    security::require_vault_access(&app, &session)?;
    require_provider_integration(&app, &payload.integration_id, "oauth_google")?;
    let client_id = payload.client_id.trim();
    if client_id.is_empty() {
        return Err("Client ID obbligatorio.".into());
    }
    db::upsert_oauth_client(
        &app,
        &payload.integration_id,
        client_id,
        payload.label.as_deref(),
    )?;
    if let Some(client_secret) = payload
        .client_secret
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        secrets::oauth_google_secret_save(&app, &payload.integration_id, client_secret)?;
    }
    Ok(OauthGoogleStatusDto {
        linked: true,
        client_id: Some(client_id.to_string()),
        label: payload.label,
    })
}

#[tauri::command]
pub fn oauth_google_status(
    app: tauri::AppHandle,
    session: tauri::State<SessionState>,
    integration_id: String,
) -> Result<OauthGoogleStatusDto, String> {
    security::require_vault_access(&app, &session)?;
    require_provider_integration(&app, &integration_id, "oauth_google")?;
    let row = db::get_oauth_client(&app, &integration_id)?;
    Ok(OauthGoogleStatusDto {
        linked: row.is_some(),
        client_id: row.as_ref().map(|r| r.client_id.clone()),
        label: row.and_then(|r| r.label),
    })
}

#[tauri::command]
pub fn oauth_google_unlink(
    app: tauri::AppHandle,
    session: tauri::State<SessionState>,
    integration_id: String,
) -> Result<(), String> {
    security::require_vault_access(&app, &session)?;
    require_provider_integration(&app, &integration_id, "oauth_google")?;
    secrets::oauth_google_secret_delete(&app, &integration_id)?;
    db::delete_oauth_client_row(&app, &integration_id)
}
