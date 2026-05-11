//! Client minimale per Resend REST API.

use reqwest::blocking::{Client, RequestBuilder};
use reqwest::header::{HeaderValue, AUTHORIZATION};
use serde::Serialize;
use serde_json::{json, Value};

const BASE: &str = "https://api.resend.com";

fn http() -> Client {
    Client::builder()
        .user_agent(concat!("Rotate/", env!("CARGO_PKG_VERSION")))
        .build()
        .expect("reqwest client")
}

fn normalize_token(token: &str) -> Result<String, String> {
    let mut value = token.trim().trim_matches('\u{feff}').trim();
    if value.len() >= 7 && value[..7].eq_ignore_ascii_case("bearer ") {
        value = value[7..].trim();
    }
    value = value.trim_matches('"').trim_matches('\'').trim();
    if value.is_empty() {
        return Err("Token Resend mancante.".into());
    }
    if value.chars().any(|c| c.is_control() || c.is_whitespace()) {
        return Err("Il token Resend contiene spazi o caratteri invisibili. Incolla solo il valore del token.".into());
    }
    Ok(value.to_string())
}

fn with_bearer(builder: RequestBuilder, token: &str) -> Result<RequestBuilder, String> {
    let token = normalize_token(token)?;
    let value = HeaderValue::from_str(&format!("Bearer {token}")).map_err(|_| {
        "Il token Resend non puo essere usato in un header HTTP valido.".to_string()
    })?;
    Ok(builder.header(AUTHORIZATION, value))
}

fn api_error_message(body: &Value) -> String {
    body.get("message")
        .and_then(|v| v.as_str())
        .or_else(|| {
            body.get("error")
                .and_then(|e| e.get("message"))
                .and_then(|v| v.as_str())
        })
        .unwrap_or("Errore API Resend.")
        .to_string()
}

fn read_json(r: reqwest::blocking::Response) -> Result<Value, String> {
    let status = r.status();
    let body: Value = r.json().map_err(|e| e.to_string())?;
    if !status.is_success() || body.get("error").is_some() || body.get("message").is_some() {
        return Err(api_error_message(&body));
    }
    Ok(body)
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResendApiKeyRow {
    pub id: String,
    pub name: String,
    pub created_at: Option<String>,
    pub last_used_at: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResendRotateResult {
    pub old_key_id: Option<String>,
    pub new_key_id: String,
    pub name: String,
    pub token: String,
    pub deleted_old: bool,
}

pub fn verify_token(token: &str) -> Result<(), String> {
    let _ = list_api_keys(token)?;
    Ok(())
}

pub fn list_api_keys(token: &str) -> Result<Vec<ResendApiKeyRow>, String> {
    let body = read_json(
        with_bearer(http().get(format!("{BASE}/api-keys")), token)?
            .send()
            .map_err(|e| e.to_string())?,
    )?;
    let Some(arr) = body.get("data").and_then(|v| v.as_array()) else {
        return Ok(vec![]);
    };
    let mut out = Vec::new();
    for item in arr {
        let id = item
            .get("id")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let name = item
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        if id.is_empty() || name.is_empty() {
            continue;
        }
        out.push(ResendApiKeyRow {
            id,
            name,
            created_at: item
                .get("created_at")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            last_used_at: item
                .get("last_used_at")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
        });
    }
    Ok(out)
}

pub fn create_api_key(
    token: &str,
    name: &str,
    permission: &str,
) -> Result<(String, String), String> {
    let permission = match permission {
        "sending_access" => "sending_access",
        _ => "full_access",
    };
    let body = read_json(
        with_bearer(http().post(format!("{BASE}/api-keys")), token)?
            .json(&json!({ "name": name, "permission": permission }))
            .send()
            .map_err(|e| e.to_string())?,
    )?;
    let id = body
        .get("id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Resend non ha restituito l'ID della nuova API key.".to_string())?
        .to_string();
    let token = body
        .get("token")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Resend non ha restituito il token della nuova API key.".to_string())?
        .to_string();
    Ok((id, token))
}

pub fn delete_api_key(token: &str, key_id: &str) -> Result<(), String> {
    let status = with_bearer(http().delete(format!("{BASE}/api-keys/{key_id}")), token)?
        .send()
        .map_err(|e| e.to_string())?
        .status();
    if status.is_success() {
        Ok(())
    } else {
        Err(format!(
            "Resend ha rifiutato l'eliminazione della API key: HTTP {status}."
        ))
    }
}
