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
            FOREIGN KEY (integration_id) REFERENCES integrations(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS vault_settings (
            key TEXT PRIMARY KEY NOT NULL,
            value TEXT NOT NULL
        );
        "#,
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

const VAULT_KEY_PIN_PHC: &str = "pin_phc";

/// Hash Argon2 (formato PHC) del PIN - non il PIN in chiaro.
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

/// Chiamare all’avvio per creare subito DB e cartella dati.
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
        "cloudflare" | "supabase" | "oauth_google" => Ok(()),
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
) -> Result<(), String> {
    let conn = open_conn(app)?;
    conn.execute(
        r#"
        INSERT INTO cloudflare_accounts (integration_id, account_id) VALUES (?1, ?2)
        ON CONFLICT(integration_id) DO UPDATE SET account_id = excluded.account_id
        "#,
        params![integration_id, account_id],
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

pub fn delete_cloudflare_account_row(app: &AppHandle, integration_id: &str) -> Result<(), String> {
    let conn = open_conn(app)?;
    conn.execute(
        "DELETE FROM cloudflare_accounts WHERE integration_id = ?1",
        params![integration_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn add_integration(app: &AppHandle, provider: &str, label: &str) -> Result<IntegrationDto, String> {
    validate_provider(provider)?;
    let conn = open_conn(app)?;
    let id = uuid::Uuid::new_v4().to_string();
    let created_at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis() as i64;

    conn.execute(
        "INSERT INTO integrations (id, provider, label, created_at) VALUES (?1, ?2, ?3, ?4)",
        params![id, provider, label, created_at],
    )
    .map_err(|e| {
        let msg = e.to_string();
        if msg.contains("UNIQUE") {
            "Questo provider è già nel pool.".to_string()
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
