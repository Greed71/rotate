use crate::{db, github_api, resend_api, secrets, security};
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

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GithubStatusDto {
    pub linked: bool,
    pub login: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ManualSecretStatusDto {
    pub linked: bool,
    pub public_id: Option<String>,
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

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GithubActionsSecretUpsertCommand {
    integration_id: String,
    owner: String,
    repo: String,
    name: String,
    value: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManualSecretLinkCommand {
    integration_id: String,
    public_id: String,
    secret: Option<String>,
    label: Option<String>,
}

fn save_manual_secret_provider(
    app: &tauri::AppHandle,
    integration_id: &str,
    public_id: &str,
    label: Option<&str>,
    secret: Option<&str>,
    secret_save: fn(&tauri::AppHandle, &str, &str) -> Result<(), String>,
    secret_delete: fn(&tauri::AppHandle, &str) -> Result<(), String>,
) -> Result<ManualSecretStatusDto, String> {
    let public_id = public_id.trim();
    if public_id.is_empty() {
        return Err("Identificativo pubblico obbligatorio.".into());
    }

    let saved_secret = if let Some(secret) = secret.map(str::trim).filter(|s| !s.is_empty()) {
        secret_save(app, integration_id, secret)?;
        true
    } else {
        false
    };

    if let Err(err) = db::upsert_oauth_client(app, integration_id, public_id, label) {
        if saved_secret {
            let _ = secret_delete(app, integration_id);
        }
        return Err(err);
    }

    Ok(ManualSecretStatusDto {
        linked: true,
        public_id: Some(public_id.to_string()),
        label: label.map(str::to_string),
    })
}

fn manual_secret_provider_status(
    app: &tauri::AppHandle,
    integration_id: &str,
    secret_get: fn(&tauri::AppHandle, &str) -> Result<Option<String>, String>,
) -> Result<ManualSecretStatusDto, String> {
    let row = db::get_oauth_client(app, integration_id)?;
    let mut status = ManualSecretStatusDto {
        linked: row.is_some(),
        public_id: row.as_ref().map(|r| r.client_id.clone()),
        label: row.and_then(|r| r.label),
    };
    if status.linked && secret_get(app, integration_id)?.is_none() {
        status.label = status.label.or_else(|| Some("Secret non salvato".into()));
    }
    Ok(status)
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

#[tauri::command]
pub fn github_link(
    app: tauri::AppHandle,
    session: tauri::State<SessionState>,
    integration_id: String,
    api_token: String,
) -> Result<GithubStatusDto, String> {
    security::require_vault_access(&app, &session)?;
    require_provider_integration(&app, &integration_id, "github")?;
    let user = github_api::verify_token(&api_token)?;
    secrets::github_token_save(&app, &integration_id, &api_token)?;
    Ok(GithubStatusDto {
        linked: true,
        login: Some(user.login),
    })
}

#[tauri::command]
pub fn github_status(
    app: tauri::AppHandle,
    session: tauri::State<SessionState>,
    integration_id: String,
) -> Result<GithubStatusDto, String> {
    security::require_vault_access(&app, &session)?;
    require_provider_integration(&app, &integration_id, "github")?;
    let Some(token) = secrets::github_token_get(&app, &integration_id)? else {
        return Ok(GithubStatusDto {
            linked: false,
            login: None,
        });
    };
    let login = github_api::verify_token(&token).ok().map(|user| user.login);
    Ok(GithubStatusDto {
        linked: true,
        login,
    })
}

#[tauri::command]
pub fn github_upsert_actions_secret(
    app: tauri::AppHandle,
    session: tauri::State<SessionState>,
    payload: GithubActionsSecretUpsertCommand,
) -> Result<github_api::GithubActionsSecretUpsertResult, String> {
    security::require_vault_access(&app, &session)?;
    require_provider_integration(&app, &payload.integration_id, "github")?;
    let token = secrets::github_token_get(&app, &payload.integration_id)?
        .ok_or_else(|| "Token GitHub non trovato.".to_string())?;
    github_api::upsert_actions_secret(
        &token,
        &payload.owner,
        &payload.repo,
        &payload.name,
        &payload.value,
    )
}

#[tauri::command]
pub fn github_unlink(
    app: tauri::AppHandle,
    session: tauri::State<SessionState>,
    integration_id: String,
) -> Result<(), String> {
    security::require_vault_access(&app, &session)?;
    require_provider_integration(&app, &integration_id, "github")?;
    secrets::github_token_delete(&app, &integration_id)
}

macro_rules! manual_provider_commands {
    (
        $provider:literal,
        $link_fn:ident,
        $status_fn:ident,
        $unlink_fn:ident,
        $save_fn:path,
        $get_fn:path,
        $delete_fn:path
    ) => {
        #[tauri::command]
        pub fn $link_fn(
            app: tauri::AppHandle,
            session: tauri::State<SessionState>,
            payload: ManualSecretLinkCommand,
        ) -> Result<ManualSecretStatusDto, String> {
            security::require_vault_access(&app, &session)?;
            require_provider_integration(&app, &payload.integration_id, $provider)?;
            save_manual_secret_provider(
                &app,
                &payload.integration_id,
                &payload.public_id,
                payload.label.as_deref(),
                payload.secret.as_deref(),
                $save_fn,
                $delete_fn,
            )
        }

        #[tauri::command]
        pub fn $status_fn(
            app: tauri::AppHandle,
            session: tauri::State<SessionState>,
            integration_id: String,
        ) -> Result<ManualSecretStatusDto, String> {
            security::require_vault_access(&app, &session)?;
            require_provider_integration(&app, &integration_id, $provider)?;
            manual_secret_provider_status(&app, &integration_id, $get_fn)
        }

        #[tauri::command]
        pub fn $unlink_fn(
            app: tauri::AppHandle,
            session: tauri::State<SessionState>,
            integration_id: String,
        ) -> Result<(), String> {
            security::require_vault_access(&app, &session)?;
            require_provider_integration(&app, &integration_id, $provider)?;
            $delete_fn(&app, &integration_id)?;
            db::delete_oauth_client_row(&app, &integration_id)
        }
    };
}

manual_provider_commands!(
    "stripe",
    stripe_link,
    stripe_status,
    stripe_unlink,
    secrets::stripe_secret_save,
    secrets::stripe_secret_get,
    secrets::stripe_secret_delete
);
manual_provider_commands!(
    "paypal",
    paypal_link,
    paypal_status,
    paypal_unlink,
    secrets::paypal_secret_save,
    secrets::paypal_secret_get,
    secrets::paypal_secret_delete
);
manual_provider_commands!(
    "facebook",
    facebook_link,
    facebook_status,
    facebook_unlink,
    secrets::facebook_secret_save,
    secrets::facebook_secret_get,
    secrets::facebook_secret_delete
);
manual_provider_commands!(
    "discord",
    discord_link,
    discord_status,
    discord_unlink,
    secrets::discord_secret_save,
    secrets::discord_secret_get,
    secrets::discord_secret_delete
);
manual_provider_commands!(
    "twitch",
    twitch_link,
    twitch_status,
    twitch_unlink,
    secrets::twitch_secret_save,
    secrets::twitch_secret_get,
    secrets::twitch_secret_delete
);
