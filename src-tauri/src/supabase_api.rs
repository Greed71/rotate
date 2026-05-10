//! Client minimale per Supabase Management API.

use rand_core::{OsRng, RngCore};
use reqwest::blocking::{Client, RequestBuilder};
use reqwest::header::{HeaderValue, AUTHORIZATION};
use serde::Serialize;
use serde_json::{json, Value};

const BASE: &str = "https://api.supabase.com";

fn http() -> Client {
    Client::builder()
        .user_agent(concat!("Rotate/", env!("CARGO_PKG_VERSION")))
        .build()
        .expect("reqwest client")
}

fn api_error_message(status: reqwest::StatusCode, body: &Value) -> String {
    body.get("message")
        .and_then(|m| m.as_str())
        .or_else(|| body.get("error").and_then(|m| m.as_str()))
        .or_else(|| body.get("error_description").and_then(|m| m.as_str()))
        .map(|msg| format!("{msg} (Supabase HTTP {status})"))
        .unwrap_or_else(|| format!("Errore API Supabase (HTTP {status})."))
}

fn normalize_token(token: &str) -> Result<String, String> {
    let mut value = token.trim().trim_matches('\u{feff}').trim();
    if value.len() >= 7 && value[..7].eq_ignore_ascii_case("bearer ") {
        value = value[7..].trim();
    }
    value = value.trim_matches('"').trim_matches('\'').trim();
    if value.is_empty() {
        return Err("Token Supabase mancante.".into());
    }
    if value.chars().any(|c| c.is_control() || c.is_whitespace()) {
        return Err("Il token Supabase contiene spazi o caratteri invisibili. Incolla solo il valore del token.".into());
    }
    Ok(value.to_string())
}

fn with_bearer(builder: RequestBuilder, token: &str) -> Result<RequestBuilder, String> {
    let token = normalize_token(token)?;
    let value = HeaderValue::from_str(&format!("Bearer {token}")).map_err(|_| {
        "Il token Supabase non puo essere usato in un header HTTP valido.".to_string()
    })?;
    Ok(builder.header(AUTHORIZATION, value))
}

fn read_json_response(r: reqwest::blocking::Response) -> Result<Value, String> {
    let status = r.status();
    let text = r.text().map_err(|e| e.to_string())?;
    let body = if text.trim().is_empty() {
        json!({})
    } else {
        serde_json::from_str::<Value>(&text).unwrap_or_else(|_| json!({ "message": text }))
    };
    if !status.is_success() {
        return Err(api_error_message(status, &body));
    }
    Ok(body)
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SupabaseProjectRow {
    pub id: String,
    pub reference: String,
    pub name: String,
    pub organization_id: Option<String>,
    pub organization_slug: Option<String>,
    pub region: Option<String>,
    pub status: Option<String>,
    pub created_at: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SupabaseSecretRow {
    pub name: String,
    pub updated_at: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SupabaseSecretUpsertResult {
    pub project_ref: String,
    pub project_name: String,
    pub name: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SupabaseApiKeyRow {
    pub id: String,
    pub key_type: String,
    pub prefix: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub inserted_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SupabaseApiKeyRotateResult {
    pub old_key_id: String,
    pub new_key_id: String,
    pub key_type: String,
    pub name: String,
    pub api_key: String,
    pub deleted_old: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SupabaseDatabasePasswordRotateResult {
    pub project_ref: String,
    pub password: String,
}

fn generate_database_password() -> String {
    const ALPHABET: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!#$%*-_=+?";
    let mut bytes = [0u8; 40];
    OsRng.fill_bytes(&mut bytes);
    bytes
        .iter()
        .map(|b| ALPHABET[*b as usize % ALPHABET.len()] as char)
        .collect()
}

pub fn verify_token(token: &str) -> Result<(), String> {
    let _ = list_projects(token)?;
    Ok(())
}

pub fn list_projects(token: &str) -> Result<Vec<SupabaseProjectRow>, String> {
    let body = read_json_response(
        with_bearer(http().get(format!("{BASE}/v1/projects")), token)?
            .send()
            .map_err(|e| e.to_string())?,
    )?;
    let Some(arr) = body.as_array() else {
        return Ok(vec![]);
    };
    let mut out = Vec::new();
    for item in arr {
        let reference = item
            .get("ref")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let name = item
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        if reference.is_empty() || name.is_empty() {
            continue;
        }
        out.push(SupabaseProjectRow {
            id: item
                .get("id")
                .and_then(|v| v.as_str())
                .unwrap_or(&reference)
                .to_string(),
            reference,
            name,
            organization_id: item
                .get("organization_id")
                .and_then(|v| v.as_str())
                .map(str::to_string),
            organization_slug: item
                .get("organization_slug")
                .and_then(|v| v.as_str())
                .map(str::to_string),
            region: item
                .get("region")
                .and_then(|v| v.as_str())
                .map(str::to_string),
            status: item
                .get("status")
                .and_then(|v| v.as_str())
                .map(str::to_string),
            created_at: item
                .get("created_at")
                .and_then(|v| v.as_str())
                .map(str::to_string),
        });
    }
    Ok(out)
}

pub fn list_project_secrets(
    token: &str,
    project_ref: &str,
) -> Result<Vec<SupabaseSecretRow>, String> {
    let body = read_json_response(
        with_bearer(
            http().get(format!("{BASE}/v1/projects/{project_ref}/secrets")),
            token,
        )?
        .send()
        .map_err(|e| e.to_string())?,
    )?;
    let Some(arr) = body.as_array() else {
        return Ok(vec![]);
    };
    let mut out = Vec::new();
    for item in arr {
        let name = item
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        if name.is_empty() {
            continue;
        }
        out.push(SupabaseSecretRow {
            name,
            updated_at: item
                .get("updated_at")
                .and_then(|v| v.as_str())
                .map(str::to_string),
        });
    }
    Ok(out)
}

pub fn upsert_project_secrets(
    token: &str,
    project_ref: &str,
    project_name: &str,
    secrets: &[(String, String)],
) -> Result<Vec<SupabaseSecretUpsertResult>, String> {
    let body: Vec<Value> = secrets
        .iter()
        .map(|(name, value)| json!({ "name": name, "value": value }))
        .collect();
    let _ = read_json_response(
        with_bearer(
            http()
                .post(format!("{BASE}/v1/projects/{project_ref}/secrets"))
                .header("Content-Type", "application/json")
                .json(&body),
            token,
        )?
        .send()
        .map_err(|e| e.to_string())?,
    )?;
    Ok(secrets
        .iter()
        .map(|(name, _)| SupabaseSecretUpsertResult {
            project_ref: project_ref.to_string(),
            project_name: project_name.to_string(),
            name: name.to_string(),
        })
        .collect())
}

pub fn list_project_api_keys(
    token: &str,
    project_ref: &str,
) -> Result<Vec<SupabaseApiKeyRow>, String> {
    let body = read_json_response(
        with_bearer(
            http().get(format!("{BASE}/v1/projects/{project_ref}/api-keys")),
            token,
        )?
        .send()
        .map_err(|e| e.to_string())?,
    )?;
    let Some(arr) = body.as_array() else {
        return Ok(vec![]);
    };
    let mut out = Vec::new();
    for item in arr {
        let id = item
            .get("id")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let key_type = item
            .get("type")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let name = item
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        if id.is_empty() || key_type.is_empty() || name.is_empty() {
            continue;
        }
        out.push(SupabaseApiKeyRow {
            id,
            key_type,
            prefix: item
                .get("prefix")
                .and_then(|v| v.as_str())
                .map(str::to_string),
            name,
            description: item
                .get("description")
                .and_then(|v| v.as_str())
                .map(str::to_string),
            inserted_at: item
                .get("inserted_at")
                .and_then(|v| v.as_str())
                .map(str::to_string),
            updated_at: item
                .get("updated_at")
                .and_then(|v| v.as_str())
                .map(str::to_string),
        });
    }
    Ok(out)
}

pub fn rotate_project_api_key(
    token: &str,
    project_ref: &str,
    source: &SupabaseApiKeyRow,
    delete_old: bool,
) -> Result<SupabaseApiKeyRotateResult, String> {
    let key_type = source.key_type.trim();
    if key_type != "publishable" && key_type != "secret" {
        return Err("Rotate puo ruotare solo API key Supabase publishable o secret.".into());
    }
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_secs();
    let name = format!("{} - rotate {ts}", source.name);
    let mut body = json!({
        "type": key_type,
        "name": name,
        "description": source.description.clone().unwrap_or_else(|| "Created by Rotate".into()),
    });
    if key_type == "secret" {
        body["secret_jwt_template"] = json!({ "role": "service_role" });
    }
    let created = read_json_response(
        with_bearer(
            http()
                .post(format!(
                    "{BASE}/v1/projects/{project_ref}/api-keys?reveal=true"
                ))
                .header("Content-Type", "application/json")
                .json(&body),
            token,
        )?
        .send()
        .map_err(|e| e.to_string())?,
    )?;
    let new_key_id = created
        .get("id")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let api_key = created
        .get("api_key")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    if new_key_id.is_empty() || api_key.is_empty() {
        return Err("Supabase ha creato la key ma non ha restituito il valore rivelabile.".into());
    }
    let deleted_old = if delete_old {
        let _ = read_json_response(
            with_bearer(
                http().delete(format!(
                    "{BASE}/v1/projects/{project_ref}/api-keys/{}",
                    source.id
                )),
                token,
            )?
            .send()
            .map_err(|e| e.to_string())?,
        )?;
        true
    } else {
        false
    };
    Ok(SupabaseApiKeyRotateResult {
        old_key_id: source.id.clone(),
        new_key_id,
        key_type: key_type.to_string(),
        name,
        api_key,
        deleted_old,
    })
}

pub fn rotate_database_password(
    token: &str,
    project_ref: &str,
) -> Result<SupabaseDatabasePasswordRotateResult, String> {
    let password = generate_database_password();
    let body = json!({ "password": password });
    let _ = read_json_response(
        with_bearer(
            http()
                .patch(format!(
                    "{BASE}/v1/projects/{project_ref}/database/password"
                ))
                .header("Content-Type", "application/json")
                .json(&body),
            token,
        )?
        .send()
        .map_err(|e| e.to_string())?,
    )?;
    Ok(SupabaseDatabasePasswordRotateResult {
        project_ref: project_ref.to_string(),
        password,
    })
}
