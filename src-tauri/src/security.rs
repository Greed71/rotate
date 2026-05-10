//! Vault locale: password come hash Argon2id nel DB app, sessione in memoria a tempo limitato.

use crate::db;
use argon2::password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use argon2::Argon2;
use rand_core::OsRng;
use serde::Serialize;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::AppHandle;

pub const MIN_PIN_LEN: usize = 12;
const MAX_AUTH_FAILURES_BEFORE_COOLDOWN: u32 = 5;
const AUTH_COOLDOWN_SECONDS: u64 = 30;

fn validate_pin_strength(pin: &str) -> Result<(), String> {
    if pin.len() < MIN_PIN_LEN {
        return Err(format!(
            "La password del vault deve essere di almeno {MIN_PIN_LEN} caratteri."
        ));
    }
    if pin.trim() != pin {
        return Err("La password del vault non puo iniziare o finire con spazi.".into());
    }
    let lower = pin.to_lowercase();
    let weak_fragments = ["password", "123456", "qwerty", "rotate", "cloudflare"];
    if weak_fragments.iter().any(|frag| lower.contains(frag)) {
        return Err("La password del vault contiene una sequenza troppo prevedibile.".into());
    }
    let mut classes = 0;
    if pin.chars().any(|c| c.is_ascii_lowercase()) {
        classes += 1;
    }
    if pin.chars().any(|c| c.is_ascii_uppercase()) {
        classes += 1;
    }
    if pin.chars().any(|c| c.is_ascii_digit()) {
        classes += 1;
    }
    if pin.chars().any(|c| !c.is_ascii_alphanumeric()) {
        classes += 1;
    }
    if pin.len() < 16 && classes < 3 {
        return Err(
            "Usa almeno 16 caratteri, oppure almeno 3 categorie tra minuscole, maiuscole, numeri e simboli."
                .into(),
        );
    }
    Ok(())
}

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
    validate_pin_strength(pin)?;
    if is_pin_configured(app)? {
        return Err("Password vault gia configurata. Usa Cambia password.".into());
    }
    let phc = hash_pin(pin)?;
    db::set_vault_pin_phc(app, &phc)?;
    Ok(())
}

pub fn verify_pin(app: &AppHandle, pin: &str) -> Result<bool, String> {
    let Some(phc) = db::get_vault_pin_phc(app)? else {
        return Ok(false);
    };
    let parsed = PasswordHash::new(&phc)
        .map_err(|_| "Memorizzazione password vault non valida.".to_string())?;
    Ok(Argon2::default()
        .verify_password(pin.as_bytes(), &parsed)
        .is_ok())
}

pub fn replace_pin(app: &AppHandle, new_pin: &str) -> Result<(), String> {
    validate_pin_strength(new_pin)?;
    let phc = hash_pin(new_pin)?;
    db::set_vault_pin_phc(app, &phc)?;
    Ok(())
}

struct SessionInner {
    unlock_until: Option<Instant>,
    auth_failures: u32,
    auth_blocked_until: Option<Instant>,
}

pub struct SessionState {
    inner: Mutex<SessionInner>,
}

impl SessionState {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(SessionInner {
                unlock_until: None,
                auth_failures: 0,
                auth_blocked_until: None,
            }),
        }
    }

    pub fn lock_vault(&self) {
        self.inner.lock().expect("session mutex").unlock_until = None;
    }

    pub fn unlock_vault(&self, ttl: Duration) {
        self.inner.lock().expect("session mutex").unlock_until = Some(Instant::now() + ttl);
    }

    pub fn is_unlocked(&self) -> bool {
        let g = self.inner.lock().expect("session mutex");
        g.unlock_until.map(|t| Instant::now() < t).unwrap_or(false)
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

    pub fn require_auth_allowed(&self) -> Result<(), String> {
        let mut g = self.inner.lock().expect("session mutex");
        if let Some(until) = g.auth_blocked_until {
            let now = Instant::now();
            if now < until {
                let seconds = until.saturating_duration_since(now).as_secs().max(1);
                return Err(format!(
                    "Troppi tentativi non riusciti. Riprova tra {seconds} secondi."
                ));
            }
            g.auth_blocked_until = None;
            g.auth_failures = 0;
        }
        Ok(())
    }

    pub fn register_auth_failure(&self) {
        let mut g = self.inner.lock().expect("session mutex");
        g.auth_failures = g.auth_failures.saturating_add(1);
        if g.auth_failures >= MAX_AUTH_FAILURES_BEFORE_COOLDOWN {
            g.auth_blocked_until =
                Some(Instant::now() + Duration::from_secs(AUTH_COOLDOWN_SECONDS));
        }
    }

    pub fn register_auth_success(&self) {
        let mut g = self.inner.lock().expect("session mutex");
        g.auth_failures = 0;
        g.auth_blocked_until = None;
    }
}

impl Default for SessionState {
    fn default() -> Self {
        Self::new()
    }
}

pub fn require_vault_access(app: &AppHandle, session: &SessionState) -> Result<(), String> {
    if !is_pin_configured(app)? {
        return Err("Configura la password del vault per continuare.".into());
    }
    if !session.is_unlocked() {
        return Err("Vault bloccato. Inserisci la password.".into());
    }
    Ok(())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SecurityStatusDto {
    pub pin_configured: bool,
    pub unlocked: bool,
    pub session_seconds_remaining: Option<u32>,
    pub session_ttl_seconds: u32,
}

pub fn build_status(app: &AppHandle, session: &SessionState) -> Result<SecurityStatusDto, String> {
    let pin_configured = is_pin_configured(app)?;
    let unlocked = pin_configured && session.is_unlocked();
    let session_seconds_remaining = if unlocked {
        session.seconds_remaining()
    } else {
        None
    };
    let session_ttl_seconds = if pin_configured {
        db::get_session_ttl_seconds(app)?
    } else {
        db::DEFAULT_SESSION_TTL_SEC
    };
    Ok(SecurityStatusDto {
        pin_configured,
        unlocked,
        session_seconds_remaining,
        session_ttl_seconds,
    })
}
