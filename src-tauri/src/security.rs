//! Vault locale: PIN come hash Argon2id (PHC) nel DB app, sessione in memoria a tempo limitato.
//!
//! L’hash è in `rotate.db` (directory dati Tauri), non nel portachiavi Windows: lì `set_password`
//! può bloccarsi indefinitamente su alcune macchine. I segreti provider (es. token Cloudflare)
//! restano nel portachiavi (`secrets.rs`).

use crate::db;
use argon2::Argon2;
use argon2::password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use rand_core::OsRng;
use serde::Serialize;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::AppHandle;

/// Durata sessione dopo sblocco (nessun dato sensibile lasciato su disco oltre l’hash).
const SESSION_TTL: Duration = Duration::from_secs(15 * 60);
pub const MIN_PIN_LEN: usize = 10;

fn hash_pin(pin: &str) -> Result<String, String> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    argon2
        .hash_password(pin.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|e| e.to_string())
}

pub fn is_pin_configured(app: &AppHandle) -> Result<bool, String> {
    Ok(db::get_vault_pin_phc(app)?.is_some())
}

pub fn set_initial_pin(app: &AppHandle, pin: &str) -> Result<(), String> {
    if pin.len() < MIN_PIN_LEN {
        return Err(format!(
            "Il PIN deve essere di almeno {MIN_PIN_LEN} caratteri."
        ));
    }
    if is_pin_configured(app)? {
        return Err("PIN già configurato. Usa «Cambia PIN».".into());
    }
    let phc = hash_pin(pin)?;
    db::set_vault_pin_phc(app, &phc)?;
    Ok(())
}

pub fn verify_pin(app: &AppHandle, pin: &str) -> Result<bool, String> {
    let Some(phc) = db::get_vault_pin_phc(app)? else {
        return Ok(false);
    };
    let parsed = PasswordHash::new(&phc).map_err(|_| "Memorizzazione PIN non valida.".to_string())?;
    Ok(Argon2::default()
        .verify_password(pin.as_bytes(), &parsed)
        .is_ok())
}

pub fn replace_pin(app: &AppHandle, new_pin: &str) -> Result<(), String> {
    if new_pin.len() < MIN_PIN_LEN {
        return Err(format!(
            "Il PIN deve essere di almeno {MIN_PIN_LEN} caratteri."
        ));
    }
    let phc = hash_pin(new_pin)?;
    db::set_vault_pin_phc(app, &phc)?;
    Ok(())
}

struct SessionInner {
    unlock_until: Option<Instant>,
}

pub struct SessionState {
    inner: Mutex<SessionInner>,
}

impl SessionState {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(SessionInner {
                unlock_until: None,
            }),
        }
    }

    pub fn lock_vault(&self) {
        self.inner.lock().expect("session mutex").unlock_until = None;
    }

    pub fn unlock_vault(&self) {
        self.inner.lock().expect("session mutex").unlock_until =
            Some(Instant::now() + SESSION_TTL);
    }

    pub fn is_unlocked(&self) -> bool {
        let g = self.inner.lock().expect("session mutex");
        g.unlock_until
            .map(|t| Instant::now() < t)
            .unwrap_or(false)
    }

    pub fn seconds_remaining(&self) -> Option<u32> {
        let g = self.inner.lock().expect("session mutex");
        let until = g.unlock_until?;
        let now = Instant::now();
        if now >= until {
            return Some(0);
        }
        Some(
            until
                .saturating_duration_since(now)
                .as_secs()
                .min(u64::from(u32::MAX)) as u32,
        )
    }
}

impl Default for SessionState {
    fn default() -> Self {
        Self::new()
    }
}

/// Accesso a dati sensibili: PIN obbligatorio + sessione attiva.
pub fn require_vault_access(app: &AppHandle, session: &SessionState) -> Result<(), String> {
    if !is_pin_configured(app)? {
        return Err("Configura il PIN del vault per continuare.".into());
    }
    if !session.is_unlocked() {
        return Err("Vault bloccato. Inserisci il PIN.".into());
    }
    Ok(())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SecurityStatusDto {
    pub pin_configured: bool,
    pub unlocked: bool,
    pub session_seconds_remaining: Option<u32>,
}

pub fn build_status(app: &AppHandle, session: &SessionState) -> Result<SecurityStatusDto, String> {
    let pin_configured = is_pin_configured(app)?;
    let unlocked = pin_configured && session.is_unlocked();
    let session_seconds_remaining = if unlocked {
        session.seconds_remaining()
    } else {
        None
    };
    Ok(SecurityStatusDto {
        pin_configured,
        unlocked,
        session_seconds_remaining,
    })
}
