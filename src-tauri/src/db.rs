//! SQLite locale (metadati integrazioni). Percorso: directory dati app Tauri.

use rusqlite::{params, Connection};
use serde::Serialize;
use tauri::AppHandle;
use tauri::Manager;

const DB_FILE: &str = "rotate.db";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IntegrationDto {
    pub id: String,
    pub provider: String,
    pub label: String,
    pub created_at: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ManagedSecretDto {
    pub id: String,
    pub integration_id: String,
    pub provider: String,
    pub external_id: String,
    pub label: String,
    pub environment: String,
    pub secret_kind: String,
    pub created_at: i64,
    pub last_rotated_at: Option<i64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VercelAccountDto {
    pub integration_id: String,
    pub user_id: String,
    pub user_email: Option<String>,
    pub team_id: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OauthClientDto {
    pub integration_id: String,
    pub client_id: String,
    pub label: Option<String>,
}

fn now_ms() -> Result<i64, String> {
    Ok(std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis() as i64)
}

fn open_conn(app: &AppHandle) -> Result<Connection, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join(DB_FILE);
    let conn = Connection::open(path).map_err(|e| e.to_string())?;
    conn.execute_batch("PRAGMA foreign_keys = ON;")
        .map_err(|e| e.to_string())?;
    migrate(&conn)?;
    Ok(conn)
}

fn migrate(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS integrations (
            id TEXT PRIMARY KEY NOT NULL,
            provider TEXT NOT NULL UNIQUE,
            label TEXT NOT NULL,
            created_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS cloudflare_accounts (
            integration_id TEXT PRIMARY KEY NOT NULL,
            account_id TEXT NOT NULL,
            management_token_id TEXT,
            FOREIGN KEY (integration_id) REFERENCES integrations(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS vercel_accounts (
            integration_id TEXT PRIMARY KEY NOT NULL,
            user_id TEXT NOT NULL,
            user_email TEXT,
            team_id TEXT,
            FOREIGN KEY (integration_id) REFERENCES integrations(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS oauth_clients (
            integration_id TEXT PRIMARY KEY NOT NULL,
            client_id TEXT NOT NULL,
            label TEXT,
            FOREIGN KEY (integration_id) REFERENCES integrations(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS vault_settings (
            key TEXT PRIMARY KEY NOT NULL,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS managed_secrets (
            id TEXT PRIMARY KEY NOT NULL,
            integration_id TEXT NOT NULL,
            provider TEXT NOT NULL,
            external_id TEXT NOT NULL,
            label TEXT NOT NULL,
            environment TEXT NOT NULL DEFAULT 'production',
            secret_kind TEXT NOT NULL DEFAULT 'api_token',
            created_at INTEGER NOT NULL,
            last_rotated_at INTEGER,
            UNIQUE(integration_id, external_id),
            FOREIGN KEY (integration_id) REFERENCES integrations(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS secret_destinations (
            id TEXT PRIMARY KEY NOT NULL,
            managed_secret_id TEXT NOT NULL,
            destination_type TEXT NOT NULL,
            label TEXT NOT NULL,
            target_ref TEXT NOT NULL,
            key_name TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (managed_secret_id) REFERENCES managed_secrets(id) ON DELETE CASCADE
        );
        "#,
    )
    .map_err(|e| e.to_string())?;
    conn.execute_batch("ALTER TABLE cloudflare_accounts ADD COLUMN management_token_id TEXT;")
        .or_else(|e| {
            if e.to_string().contains("duplicate column name") {
                Ok(())
            } else {
                Err(e.to_string())
            }
        })?;
    Ok(())
}

const VAULT_KEY_PIN_PHC: &str = "pin_phc";
const VAULT_KEY_SESSION_TTL_SEC: &str = "session_ttl_sec";

pub const DEFAULT_SESSION_TTL_SEC: u32 = 15 * 60;
pub const MIN_SESSION_TTL_SEC: u32 = 60;
pub const MAX_SESSION_TTL_SEC: u32 = 8 * 60 * 60;

pub fn get_vault_pin_phc(app: &AppHandle) -> Result<Option<String>, String> {
    let conn = open_conn(app)?;
    let mut stmt = conn
        .prepare("SELECT value FROM vault_settings WHERE key = ?1")
        .map_err(|e| e.to_string())?;
    let mut rows = stmt
        .query_map(params![VAULT_KEY_PIN_PHC], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?;
    match rows.next() {
        Some(r) => {
            let s = r.map_err(|e| e.to_string())?;
            if s.is_empty() {
                Ok(None)
            } else {
                Ok(Some(s))
            }
        }
        None => Ok(None),
    }
}

pub fn set_vault_pin_phc(app: &AppHandle, phc: &str) -> Result<(), String> {
    let conn = open_conn(app)?;
    conn.execute(
        r#"
        INSERT INTO vault_settings (key, value) VALUES (?1, ?2)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
        "#,
        params![VAULT_KEY_PIN_PHC, phc],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn get_session_ttl_seconds(app: &AppHandle) -> Result<u32, String> {
    let conn = open_conn(app)?;
    let mut stmt = conn
        .prepare("SELECT value FROM vault_settings WHERE key = ?1")
        .map_err(|e| e.to_string())?;
    let mut rows = stmt
        .query_map(params![VAULT_KEY_SESSION_TTL_SEC], |row| {
            row.get::<_, String>(0)
        })
        .map_err(|e| e.to_string())?;
    let raw = match rows.next() {
        Some(r) => r.map_err(|e| e.to_string())?,
        None => return Ok(DEFAULT_SESSION_TTL_SEC),
    };
    let n: u32 = raw
        .parse()
        .map_err(|_| "Valore session_ttl non valido.".to_string())?;
    Ok(n.clamp(MIN_SESSION_TTL_SEC, MAX_SESSION_TTL_SEC))
}

pub fn set_session_ttl_seconds(app: &AppHandle, seconds: u32) -> Result<(), String> {
    if !(MIN_SESSION_TTL_SEC..=MAX_SESSION_TTL_SEC).contains(&seconds) {
        return Err(format!(
            "Durata sessione: tra {MIN_SESSION_TTL_SEC} e {MAX_SESSION_TTL_SEC} secondi."
        ));
    }
    let conn = open_conn(app)?;
    conn.execute(
        r#"
        INSERT INTO vault_settings (key, value) VALUES (?1, ?2)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
        "#,
        params![VAULT_KEY_SESSION_TTL_SEC, seconds.to_string()],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[allow(dead_code)]
pub fn delete_vault_pin_phc(app: &AppHandle) -> Result<(), String> {
    let conn = open_conn(app)?;
    conn.execute(
        "DELETE FROM vault_settings WHERE key = ?1",
        params![VAULT_KEY_PIN_PHC],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn init(app: &AppHandle) -> Result<(), String> {
    let _ = open_conn(app)?;
    Ok(())
}

pub fn list_integrations(app: &AppHandle) -> Result<Vec<IntegrationDto>, String> {
    let conn = open_conn(app)?;
    let mut stmt = conn
        .prepare("SELECT id, provider, label, created_at FROM integrations ORDER BY created_at ASC")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(IntegrationDto {
                id: row.get(0)?,
                provider: row.get(1)?,
                label: row.get(2)?,
                created_at: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

fn validate_provider(provider: &str) -> Result<(), String> {
    match provider {
        "cloudflare" | "vercel" | "supabase" | "resend" | "oauth_google" => Ok(()),
        _ => Err("Provider non supportato".into()),
    }
}

pub fn get_integration_by_id(app: &AppHandle, id: &str) -> Result<Option<IntegrationDto>, String> {
    let conn = open_conn(app)?;
    let mut stmt = conn
        .prepare("SELECT id, provider, label, created_at FROM integrations WHERE id = ?1")
        .map_err(|e| e.to_string())?;
    let mut rows = stmt
        .query_map(params![id], |row| {
            Ok(IntegrationDto {
                id: row.get(0)?,
                provider: row.get(1)?,
                label: row.get(2)?,
                created_at: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?;
    match rows.next() {
        Some(r) => Ok(Some(r.map_err(|e| e.to_string())?)),
        None => Ok(None),
    }
}

pub fn upsert_cloudflare_account(
    app: &AppHandle,
    integration_id: &str,
    account_id: &str,
    management_token_id: Option<&str>,
) -> Result<(), String> {
    let conn = open_conn(app)?;
    conn.execute(
        r#"
        INSERT INTO cloudflare_accounts (integration_id, account_id, management_token_id) VALUES (?1, ?2, ?3)
        ON CONFLICT(integration_id) DO UPDATE SET
            account_id = excluded.account_id,
            management_token_id = excluded.management_token_id
        "#,
        params![integration_id, account_id, management_token_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn get_cloudflare_account_id(
    app: &AppHandle,
    integration_id: &str,
) -> Result<Option<String>, String> {
    let conn = open_conn(app)?;
    let mut stmt = conn
        .prepare("SELECT account_id FROM cloudflare_accounts WHERE integration_id = ?1")
        .map_err(|e| e.to_string())?;
    let mut rows = stmt
        .query_map(params![integration_id], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?;
    match rows.next() {
        Some(r) => Ok(Some(r.map_err(|e| e.to_string())?)),
        None => Ok(None),
    }
}

pub fn get_cloudflare_management_token_id(
    app: &AppHandle,
    integration_id: &str,
) -> Result<Option<String>, String> {
    let conn = open_conn(app)?;
    let mut stmt = conn
        .prepare("SELECT management_token_id FROM cloudflare_accounts WHERE integration_id = ?1")
        .map_err(|e| e.to_string())?;
    let mut rows = stmt
        .query_map(params![integration_id], |row| {
            row.get::<_, Option<String>>(0)
        })
        .map_err(|e| e.to_string())?;
    match rows.next() {
        Some(r) => Ok(r.map_err(|e| e.to_string())?),
        None => Ok(None),
    }
}

pub fn delete_cloudflare_account_row(app: &AppHandle, integration_id: &str) -> Result<(), String> {
    let conn = open_conn(app)?;
    conn.execute(
        "DELETE FROM cloudflare_accounts WHERE integration_id = ?1",
        params![integration_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn upsert_vercel_account(
    app: &AppHandle,
    integration_id: &str,
    user_id: &str,
    user_email: Option<&str>,
    team_id: Option<&str>,
) -> Result<(), String> {
    let conn = open_conn(app)?;
    conn.execute(
        r#"
        INSERT INTO vercel_accounts (integration_id, user_id, user_email, team_id)
        VALUES (?1, ?2, ?3, ?4)
        ON CONFLICT(integration_id) DO UPDATE SET
            user_id = excluded.user_id,
            user_email = excluded.user_email,
            team_id = excluded.team_id
        "#,
        params![integration_id, user_id, user_email, team_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn get_vercel_account(
    app: &AppHandle,
    integration_id: &str,
) -> Result<Option<VercelAccountDto>, String> {
    let conn = open_conn(app)?;
    let mut stmt = conn
        .prepare(
            "SELECT integration_id, user_id, user_email, team_id FROM vercel_accounts WHERE integration_id = ?1",
        )
        .map_err(|e| e.to_string())?;
    let mut rows = stmt
        .query_map(params![integration_id], |row| {
            Ok(VercelAccountDto {
                integration_id: row.get(0)?,
                user_id: row.get(1)?,
                user_email: row.get(2)?,
                team_id: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?;
    match rows.next() {
        Some(r) => Ok(Some(r.map_err(|e| e.to_string())?)),
        None => Ok(None),
    }
}

pub fn delete_vercel_account_row(app: &AppHandle, integration_id: &str) -> Result<(), String> {
    let conn = open_conn(app)?;
    conn.execute(
        "DELETE FROM vercel_accounts WHERE integration_id = ?1",
        params![integration_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn upsert_oauth_client(
    app: &AppHandle,
    integration_id: &str,
    client_id: &str,
    label: Option<&str>,
) -> Result<(), String> {
    let conn = open_conn(app)?;
    conn.execute(
        r#"
        INSERT INTO oauth_clients (integration_id, client_id, label)
        VALUES (?1, ?2, ?3)
        ON CONFLICT(integration_id) DO UPDATE SET
            client_id = excluded.client_id,
            label = excluded.label
        "#,
        params![integration_id, client_id, label],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn get_oauth_client(
    app: &AppHandle,
    integration_id: &str,
) -> Result<Option<OauthClientDto>, String> {
    let conn = open_conn(app)?;
    let mut stmt = conn
        .prepare(
            "SELECT integration_id, client_id, label FROM oauth_clients WHERE integration_id = ?1",
        )
        .map_err(|e| e.to_string())?;
    let mut rows = stmt
        .query_map(params![integration_id], |row| {
            Ok(OauthClientDto {
                integration_id: row.get(0)?,
                client_id: row.get(1)?,
                label: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?;
    match rows.next() {
        Some(r) => Ok(Some(r.map_err(|e| e.to_string())?)),
        None => Ok(None),
    }
}

pub fn delete_oauth_client_row(app: &AppHandle, integration_id: &str) -> Result<(), String> {
    let conn = open_conn(app)?;
    conn.execute(
        "DELETE FROM oauth_clients WHERE integration_id = ?1",
        params![integration_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn add_integration(
    app: &AppHandle,
    provider: &str,
    label: &str,
) -> Result<IntegrationDto, String> {
    validate_provider(provider)?;
    let conn = open_conn(app)?;
    let id = uuid::Uuid::new_v4().to_string();
    let created_at = now_ms()?;
    conn.execute(
        "INSERT INTO integrations (id, provider, label, created_at) VALUES (?1, ?2, ?3, ?4)",
        params![id, provider, label, created_at],
    )
    .map_err(|e| {
        let msg = e.to_string();
        if msg.contains("UNIQUE") {
            "Questo provider e gia nel pool.".to_string()
        } else {
            msg
        }
    })?;
    Ok(IntegrationDto {
        id,
        provider: provider.to_string(),
        label: label.to_string(),
        created_at,
    })
}

pub fn delete_integration(app: &AppHandle, integration_id: &str) -> Result<(), String> {
    let conn = open_conn(app)?;
    conn.execute(
        "DELETE FROM integrations WHERE id = ?1",
        params![integration_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn list_managed_secrets(
    app: &AppHandle,
    integration_id: &str,
) -> Result<Vec<ManagedSecretDto>, String> {
    let conn = open_conn(app)?;
    let mut stmt = conn
        .prepare(
            r#"
            SELECT id, integration_id, provider, external_id, label, environment, secret_kind, created_at, last_rotated_at
            FROM managed_secrets
            WHERE integration_id = ?1
            ORDER BY created_at ASC
            "#,
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![integration_id], |row| {
            Ok(ManagedSecretDto {
                id: row.get(0)?,
                integration_id: row.get(1)?,
                provider: row.get(2)?,
                external_id: row.get(3)?,
                label: row.get(4)?,
                environment: row.get(5)?,
                secret_kind: row.get(6)?,
                created_at: row.get(7)?,
                last_rotated_at: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

pub fn upsert_managed_secret(
    app: &AppHandle,
    integration_id: &str,
    provider: &str,
    external_id: &str,
    label: &str,
    environment: &str,
) -> Result<ManagedSecretDto, String> {
    validate_provider(provider)?;
    let conn = open_conn(app)?;
    let id = uuid::Uuid::new_v4().to_string();
    let created_at = now_ms()?;
    conn.execute(
        r#"
        INSERT INTO managed_secrets (
            id, integration_id, provider, external_id, label, environment, secret_kind, created_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'api_token', ?7)
        ON CONFLICT(integration_id, external_id) DO UPDATE SET
            label = excluded.label,
            environment = excluded.environment
        "#,
        params![
            id,
            integration_id,
            provider,
            external_id,
            label,
            environment,
            created_at
        ],
    )
    .map_err(|e| e.to_string())?;
    get_managed_secret_by_external_id(app, integration_id, external_id)?
        .ok_or_else(|| "Segreto gestito non trovato dopo il salvataggio.".to_string())
}

pub fn get_managed_secret_by_external_id(
    app: &AppHandle,
    integration_id: &str,
    external_id: &str,
) -> Result<Option<ManagedSecretDto>, String> {
    let conn = open_conn(app)?;
    let mut stmt = conn
        .prepare(
            r#"
            SELECT id, integration_id, provider, external_id, label, environment, secret_kind, created_at, last_rotated_at
            FROM managed_secrets
            WHERE integration_id = ?1 AND external_id = ?2
            "#,
        )
        .map_err(|e| e.to_string())?;
    let mut rows = stmt
        .query_map(params![integration_id, external_id], |row| {
            Ok(ManagedSecretDto {
                id: row.get(0)?,
                integration_id: row.get(1)?,
                provider: row.get(2)?,
                external_id: row.get(3)?,
                label: row.get(4)?,
                environment: row.get(5)?,
                secret_kind: row.get(6)?,
                created_at: row.get(7)?,
                last_rotated_at: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?;
    match rows.next() {
        Some(r) => Ok(Some(r.map_err(|e| e.to_string())?)),
        None => Ok(None),
    }
}

pub fn mark_managed_secret_rotated(
    app: &AppHandle,
    integration_id: &str,
    old_external_id: &str,
    new_external_id: &str,
    new_label: &str,
) -> Result<(), String> {
    let conn = open_conn(app)?;
    conn.execute(
        r#"
        UPDATE managed_secrets
        SET external_id = ?3, label = ?4, last_rotated_at = ?5
        WHERE integration_id = ?1 AND external_id = ?2
        "#,
        params![
            integration_id,
            old_external_id,
            new_external_id,
            new_label,
            now_ms()?
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}
