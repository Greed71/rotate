//! Token e segreti nel portachiavi del sistema.

use keyring::Entry;
use serde::Serialize;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

const SERVICE: &str = "com.longo.rotate";
const PROBE_USER: &str = "rotate-keyring-probe";
const PROBE_SECRET: &str = "rotate-probe-secret";

#[derive(Clone, Copy)]
pub enum ProviderToken {
    Cloudflare,
    Vercel,
    Supabase,
    Resend,
    OauthGoogle,
    Github,
    Stripe,
    Paypal,
    Facebook,
    Discord,
    Twitch,
}

impl ProviderToken {
    fn id(self) -> &'static str {
        match self {
            Self::Cloudflare => "cloudflare",
            Self::Vercel => "vercel",
            Self::Supabase => "supabase",
            Self::Resend => "resend",
            Self::OauthGoogle => "oauth_google",
            Self::Github => "github",
            Self::Stripe => "stripe",
            Self::Paypal => "paypal",
            Self::Facebook => "facebook",
            Self::Discord => "discord",
            Self::Twitch => "twitch",
        }
    }

    fn label(self) -> &'static str {
        match self {
            Self::Cloudflare => "Cloudflare",
            Self::Vercel => "Vercel",
            Self::Supabase => "Supabase",
            Self::Resend => "Resend",
            Self::OauthGoogle => "Google OAuth",
            Self::Github => "GitHub",
            Self::Stripe => "Stripe",
            Self::Paypal => "PayPal",
            Self::Facebook => "Facebook",
            Self::Discord => "Discord",
            Self::Twitch => "Twitch",
        }
    }
}

fn token_key(provider: &str, integration_id: &str) -> String {
    format!("{provider}-token-{integration_id}")
}

fn cf_key(integration_id: &str) -> String {
    token_key("cloudflare", integration_id)
}

fn token_entry(provider: &str, integration_id: &str) -> Result<Entry, String> {
    let user = token_key(provider, integration_id);
    Entry::new_with_target(&windows_target_name(&user), SERVICE, &user).map_err(|e| e.to_string())
}

fn cf_entry(integration_id: &str) -> Result<Entry, String> {
    token_entry("cloudflare", integration_id)
}

fn cf_legacy_entry(integration_id: &str) -> Result<Entry, String> {
    Entry::new(SERVICE, &format!("cloudflare:token:{integration_id}")).map_err(|e| e.to_string())
}

fn windows_target_name(user: &str) -> String {
    format!("{user}.{SERVICE}")
}

fn fallback_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("secrets");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn fallback_path_for_key(app: &AppHandle, key: &str) -> Result<PathBuf, String> {
    Ok(fallback_dir(app)?.join(format!("{key}.dpapi")))
}

#[cfg(windows)]
fn dpapi_protect(data: &[u8]) -> Result<Vec<u8>, String> {
    use std::ptr::{null, null_mut};
    use windows_sys::Win32::Foundation::{GetLastError, LocalFree};
    use windows_sys::Win32::Security::Cryptography::{
        CryptProtectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
    };

    let input = CRYPT_INTEGER_BLOB {
        cbData: data.len() as u32,
        pbData: data.as_ptr() as *mut u8,
    };
    let mut output = CRYPT_INTEGER_BLOB {
        cbData: 0,
        pbData: null_mut(),
    };
    let ok = unsafe {
        CryptProtectData(
            &input,
            null(),
            null(),
            null_mut(),
            null(),
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut output,
        )
    };
    if ok == 0 {
        return Err(format!(
            "DPAPI CryptProtectData failed: Windows error {}",
            unsafe { GetLastError() }
        ));
    }
    let encrypted =
        unsafe { std::slice::from_raw_parts(output.pbData, output.cbData as usize) }.to_vec();
    unsafe {
        LocalFree(output.pbData as *mut std::ffi::c_void);
    }
    Ok(encrypted)
}

#[cfg(windows)]
fn dpapi_unprotect(data: &[u8]) -> Result<Vec<u8>, String> {
    use std::ptr::{null, null_mut};
    use windows_sys::Win32::Foundation::{GetLastError, LocalFree};
    use windows_sys::Win32::Security::Cryptography::{
        CryptUnprotectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
    };

    let input = CRYPT_INTEGER_BLOB {
        cbData: data.len() as u32,
        pbData: data.as_ptr() as *mut u8,
    };
    let mut output = CRYPT_INTEGER_BLOB {
        cbData: 0,
        pbData: null_mut(),
    };
    let ok = unsafe {
        CryptUnprotectData(
            &input,
            null_mut(),
            null(),
            null_mut(),
            null(),
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut output,
        )
    };
    if ok == 0 {
        return Err(format!(
            "DPAPI CryptUnprotectData failed: Windows error {}",
            unsafe { GetLastError() }
        ));
    }
    let decrypted =
        unsafe { std::slice::from_raw_parts(output.pbData, output.cbData as usize) }.to_vec();
    unsafe {
        LocalFree(output.pbData as *mut std::ffi::c_void);
    }
    Ok(decrypted)
}

#[cfg(not(windows))]
fn dpapi_protect(_data: &[u8]) -> Result<Vec<u8>, String> {
    Err("Fallback cifrato disponibile solo su Windows.".into())
}

#[cfg(not(windows))]
fn dpapi_unprotect(_data: &[u8]) -> Result<Vec<u8>, String> {
    Err("Fallback cifrato disponibile solo su Windows.".into())
}

fn fallback_save_key(app: &AppHandle, key: &str, token: &str) -> Result<(), String> {
    let path = fallback_path_for_key(app, key)?;
    let encrypted = dpapi_protect(token.as_bytes())?;
    std::fs::write(path, encrypted).map_err(|e| e.to_string())
}

fn fallback_get_key(app: &AppHandle, key: &str) -> Result<Option<String>, String> {
    let path = fallback_path_for_key(app, key)?;
    let encrypted = match std::fs::read(path) {
        Ok(bytes) => bytes,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(e) => return Err(e.to_string()),
    };
    let decrypted = dpapi_unprotect(&encrypted)?;
    let token = String::from_utf8(decrypted).map_err(|e| e.to_string())?;
    if token.trim().is_empty() {
        Ok(None)
    } else {
        Ok(Some(token))
    }
}

fn fallback_delete_key(app: &AppHandle, key: &str) -> Result<(), String> {
    let path = fallback_path_for_key(app, key)?;
    match std::fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

fn fallback_get(app: &AppHandle, integration_id: &str) -> Result<Option<String>, String> {
    fallback_get_key(app, &cf_key(integration_id))
}

fn fallback_delete(app: &AppHandle, integration_id: &str) -> Result<(), String> {
    fallback_delete_key(app, &cf_key(integration_id))
}

fn token_save(
    app: &AppHandle,
    integration_id: &str,
    provider: &str,
    provider_label: &str,
    token: &str,
) -> Result<(), String> {
    let token = token.trim();
    if token.is_empty() {
        return Err(format!("Token {provider_label} vuoto."));
    }
    let key = token_key(provider, integration_id);

    let keyring_ok = match token_entry(provider, integration_id) {
        Ok(entry) => match entry.set_password(token) {
            Ok(()) => match token_entry(provider, integration_id).and_then(|fresh| {
                fresh
                    .get_password()
                    .map_err(|e| format!("Errore rilettura Windows Credential Manager: {e}"))
            }) {
                Ok(saved) => saved == token,
                Err(_) => false,
            },
            Err(_) => false,
        },
        Err(_) => false,
    };

    if keyring_ok {
        let _ = fallback_delete_key(app, &key);
        return Ok(());
    }

    fallback_save_key(app, &key, token)?;
    let saved = fallback_get_key(app, &key)?
        .ok_or_else(|| "Fallback DPAPI scritto ma non riletto.".to_string())?;
    if saved != token {
        return Err(
            "Fallback DPAPI ha restituito un valore diverso dal token appena salvato.".into(),
        );
    }
    Ok(())
}

fn token_get(
    app: &AppHandle,
    integration_id: &str,
    provider: &str,
    provider_label: &str,
) -> Result<Option<String>, String> {
    let key = token_key(provider, integration_id);
    if let Ok(entry) = token_entry(provider, integration_id) {
        match entry.get_password() {
            Ok(s) => return Ok(Some(s)),
            Err(keyring::Error::NoEntry) => {}
            Err(err) => {
                return Err(format!(
                    "Errore lettura Windows Credential Manager per {}: {err}",
                    windows_target_name(&key),
                ));
            }
        }
    }
    fallback_get_key(app, &key).map_err(|e| format!("Errore lettura token {provider_label}: {e}"))
}

fn token_delete(app: &AppHandle, integration_id: &str, provider: &str) -> Result<(), String> {
    let key = token_key(provider, integration_id);
    if let Ok(entry) = token_entry(provider, integration_id) {
        match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => {}
            Err(_) => {}
        }
    }
    fallback_delete_key(app, &key)
}

pub fn provider_token_save(
    app: &AppHandle,
    integration_id: &str,
    provider: ProviderToken,
    token: &str,
) -> Result<(), String> {
    token_save(app, integration_id, provider.id(), provider.label(), token)
}

pub fn provider_token_get(
    app: &AppHandle,
    integration_id: &str,
    provider: ProviderToken,
) -> Result<Option<String>, String> {
    token_get(app, integration_id, provider.id(), provider.label())
}

pub fn provider_token_delete(
    app: &AppHandle,
    integration_id: &str,
    provider: ProviderToken,
) -> Result<(), String> {
    token_delete(app, integration_id, provider.id())
}

pub fn cf_token_save(app: &AppHandle, integration_id: &str, token: &str) -> Result<(), String> {
    provider_token_save(app, integration_id, ProviderToken::Cloudflare, token)
}

pub fn cf_token_get(app: &AppHandle, integration_id: &str) -> Result<Option<String>, String> {
    if let Ok(entry) = cf_entry(integration_id) {
        match entry.get_password() {
            Ok(s) => return Ok(Some(s)),
            Err(keyring::Error::NoEntry) => {}
            Err(err) => {
                return Err(format!(
                    "Errore lettura Windows Credential Manager per {}: {err}",
                    windows_target_name(&cf_key(integration_id)),
                ));
            }
        }
    }

    if let Ok(legacy) = cf_legacy_entry(integration_id) {
        match legacy.get_password() {
            Ok(s) => {
                let _ = cf_token_save(app, integration_id, &s);
                return Ok(Some(s));
            }
            Err(keyring::Error::NoEntry) => {}
            Err(err) => {
                return Err(format!(
                    "Errore lettura credenziale legacy Windows Credential Manager: {err}",
                ));
            }
        }
    }

    fallback_get(app, integration_id)
}

pub fn cf_token_delete(app: &AppHandle, integration_id: &str) -> Result<(), String> {
    if let Ok(entry) = cf_entry(integration_id) {
        match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => {}
            Err(_) => {}
        }
    }
    if let Ok(legacy) = cf_legacy_entry(integration_id) {
        match legacy.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => {}
            Err(_) => {}
        }
    }
    fallback_delete(app, integration_id)
}

pub fn vercel_token_save(app: &AppHandle, integration_id: &str, token: &str) -> Result<(), String> {
    provider_token_save(app, integration_id, ProviderToken::Vercel, token)
}

pub fn vercel_token_get(app: &AppHandle, integration_id: &str) -> Result<Option<String>, String> {
    provider_token_get(app, integration_id, ProviderToken::Vercel)
}

pub fn vercel_token_delete(app: &AppHandle, integration_id: &str) -> Result<(), String> {
    provider_token_delete(app, integration_id, ProviderToken::Vercel)
}

pub fn supabase_token_save(
    app: &AppHandle,
    integration_id: &str,
    token: &str,
) -> Result<(), String> {
    provider_token_save(app, integration_id, ProviderToken::Supabase, token)
}

pub fn supabase_token_get(app: &AppHandle, integration_id: &str) -> Result<Option<String>, String> {
    provider_token_get(app, integration_id, ProviderToken::Supabase)
}

pub fn supabase_token_delete(app: &AppHandle, integration_id: &str) -> Result<(), String> {
    provider_token_delete(app, integration_id, ProviderToken::Supabase)
}

pub fn resend_token_save(app: &AppHandle, integration_id: &str, token: &str) -> Result<(), String> {
    provider_token_save(app, integration_id, ProviderToken::Resend, token)
}

pub fn resend_token_get(app: &AppHandle, integration_id: &str) -> Result<Option<String>, String> {
    provider_token_get(app, integration_id, ProviderToken::Resend)
}

pub fn resend_token_delete(app: &AppHandle, integration_id: &str) -> Result<(), String> {
    provider_token_delete(app, integration_id, ProviderToken::Resend)
}

pub fn oauth_google_secret_save(
    app: &AppHandle,
    integration_id: &str,
    token: &str,
) -> Result<(), String> {
    provider_token_save(app, integration_id, ProviderToken::OauthGoogle, token)
}

pub fn oauth_google_secret_delete(app: &AppHandle, integration_id: &str) -> Result<(), String> {
    provider_token_delete(app, integration_id, ProviderToken::OauthGoogle)
}

pub fn github_token_save(app: &AppHandle, integration_id: &str, token: &str) -> Result<(), String> {
    provider_token_save(app, integration_id, ProviderToken::Github, token)
}

pub fn github_token_get(app: &AppHandle, integration_id: &str) -> Result<Option<String>, String> {
    provider_token_get(app, integration_id, ProviderToken::Github)
}

pub fn github_token_delete(app: &AppHandle, integration_id: &str) -> Result<(), String> {
    provider_token_delete(app, integration_id, ProviderToken::Github)
}

pub fn stripe_secret_save(
    app: &AppHandle,
    integration_id: &str,
    token: &str,
) -> Result<(), String> {
    provider_token_save(app, integration_id, ProviderToken::Stripe, token)
}

pub fn stripe_secret_get(app: &AppHandle, integration_id: &str) -> Result<Option<String>, String> {
    provider_token_get(app, integration_id, ProviderToken::Stripe)
}

pub fn stripe_secret_delete(app: &AppHandle, integration_id: &str) -> Result<(), String> {
    provider_token_delete(app, integration_id, ProviderToken::Stripe)
}

pub fn paypal_secret_save(
    app: &AppHandle,
    integration_id: &str,
    token: &str,
) -> Result<(), String> {
    provider_token_save(app, integration_id, ProviderToken::Paypal, token)
}

pub fn paypal_secret_get(app: &AppHandle, integration_id: &str) -> Result<Option<String>, String> {
    provider_token_get(app, integration_id, ProviderToken::Paypal)
}

pub fn paypal_secret_delete(app: &AppHandle, integration_id: &str) -> Result<(), String> {
    provider_token_delete(app, integration_id, ProviderToken::Paypal)
}

pub fn facebook_secret_save(
    app: &AppHandle,
    integration_id: &str,
    token: &str,
) -> Result<(), String> {
    provider_token_save(app, integration_id, ProviderToken::Facebook, token)
}

pub fn facebook_secret_get(
    app: &AppHandle,
    integration_id: &str,
) -> Result<Option<String>, String> {
    provider_token_get(app, integration_id, ProviderToken::Facebook)
}

pub fn facebook_secret_delete(app: &AppHandle, integration_id: &str) -> Result<(), String> {
    provider_token_delete(app, integration_id, ProviderToken::Facebook)
}

pub fn discord_secret_save(
    app: &AppHandle,
    integration_id: &str,
    token: &str,
) -> Result<(), String> {
    provider_token_save(app, integration_id, ProviderToken::Discord, token)
}

pub fn discord_secret_get(app: &AppHandle, integration_id: &str) -> Result<Option<String>, String> {
    provider_token_get(app, integration_id, ProviderToken::Discord)
}

pub fn discord_secret_delete(app: &AppHandle, integration_id: &str) -> Result<(), String> {
    provider_token_delete(app, integration_id, ProviderToken::Discord)
}

pub fn twitch_secret_save(
    app: &AppHandle,
    integration_id: &str,
    token: &str,
) -> Result<(), String> {
    provider_token_save(app, integration_id, ProviderToken::Twitch, token)
}

pub fn twitch_secret_get(app: &AppHandle, integration_id: &str) -> Result<Option<String>, String> {
    provider_token_get(app, integration_id, ProviderToken::Twitch)
}

pub fn twitch_secret_delete(app: &AppHandle, integration_id: &str) -> Result<(), String> {
    provider_token_delete(app, integration_id, ProviderToken::Twitch)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SecretStorageDiagnosticsDto {
    pub service: String,
    pub credential_user: String,
    pub credential_target: String,
    pub probe_user: String,
    pub probe_target: String,
    pub entry_new: String,
    pub set_password: String,
    pub get_password: String,
    pub delete_credential: String,
    pub dpapi_roundtrip: String,
    pub ok: bool,
}

pub fn diagnostics(integration_id: &str) -> SecretStorageDiagnosticsDto {
    let credential_user = cf_key(integration_id);
    let mut dto = SecretStorageDiagnosticsDto {
        service: SERVICE.to_string(),
        credential_target: windows_target_name(&credential_user),
        credential_user,
        probe_user: PROBE_USER.to_string(),
        probe_target: windows_target_name(PROBE_USER),
        entry_new: "not_run".into(),
        set_password: "not_run".into(),
        get_password: "not_run".into(),
        delete_credential: "not_run".into(),
        dpapi_roundtrip: "not_run".into(),
        ok: false,
    };

    let entry = match Entry::new(SERVICE, PROBE_USER) {
        Ok(entry) => {
            dto.entry_new = "ok".into();
            entry
        }
        Err(err) => {
            dto.entry_new = format!("err: {err}");
            return dto;
        }
    };

    match entry.set_password(PROBE_SECRET) {
        Ok(()) => dto.set_password = "ok".into(),
        Err(err) => {
            dto.set_password = format!("err: {err}");
            return dto;
        }
    }

    match entry.get_password() {
        Ok(value) if value == PROBE_SECRET => {
            dto.get_password = "ok: matched".into();
            dto.ok = true;
        }
        Ok(value) => {
            dto.get_password = format!("err: mismatch_len={}", value.len());
        }
        Err(err) => {
            dto.get_password = format!("err: {err}");
        }
    }

    match entry.delete_credential() {
        Ok(()) => dto.delete_credential = "ok".into(),
        Err(keyring::Error::NoEntry) => dto.delete_credential = "ok: no_entry".into(),
        Err(err) => dto.delete_credential = format!("err: {err}"),
    }

    match dpapi_protect(PROBE_SECRET.as_bytes()).and_then(|bytes| dpapi_unprotect(&bytes)) {
        Ok(value) if value == PROBE_SECRET.as_bytes() => dto.dpapi_roundtrip = "ok: matched".into(),
        Ok(value) => dto.dpapi_roundtrip = format!("err: mismatch_len={}", value.len()),
        Err(err) => dto.dpapi_roundtrip = format!("err: {err}"),
    }

    dto.ok = dto.ok || dto.dpapi_roundtrip.starts_with("ok:");
    dto
}
