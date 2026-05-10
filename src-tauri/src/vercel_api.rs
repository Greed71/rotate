//! Client minimale per Vercel REST API.

use reqwest::blocking::{Client, RequestBuilder};
use reqwest::header::{HeaderValue, AUTHORIZATION};
use serde::Serialize;
use serde_json::{json, Value};

const BASE: &str = "https://api.vercel.com";

fn http() -> Client {
    Client::builder()
        .user_agent(concat!("Rotate/", env!("CARGO_PKG_VERSION")))
        .build()
        .expect("reqwest client")
}

fn api_error_message(body: &Value) -> String {
    body.get("error")
        .and_then(|e| e.get("message"))
        .and_then(|m| m.as_str())
        .or_else(|| body.get("message").and_then(|m| m.as_str()))
        .unwrap_or("Errore API Vercel.")
        .to_string()
}

fn normalize_token(token: &str) -> Result<String, String> {
    let mut value = token.trim().trim_matches('\u{feff}').trim();
    if value.len() >= 7 && value[..7].eq_ignore_ascii_case("bearer ") {
        value = value[7..].trim();
    }
    value = value.trim_matches('"').trim_matches('\'').trim();
    if value.is_empty() {
        return Err("Token Vercel mancante.".into());
    }
    if value.chars().any(|c| c.is_control() || c.is_whitespace()) {
        return Err("Il token Vercel contiene spazi o caratteri invisibili. Incolla solo il valore del token.".into());
    }
    Ok(value.to_string())
}

fn with_bearer(builder: RequestBuilder, token: &str) -> Result<RequestBuilder, String> {
    let token = normalize_token(token)?;
    let value = HeaderValue::from_str(&format!("Bearer {token}")).map_err(|_| {
        "Il token Vercel non puo essere usato in un header HTTP valido.".to_string()
    })?;
    Ok(builder.header(AUTHORIZATION, value))
}

fn query_suffix(team_id: Option<&str>) -> String {
    match team_id.map(str::trim).filter(|s| !s.is_empty()) {
        Some(id) => format!("?teamId={id}"),
        None => String::new(),
    }
}

fn upsert_query_suffix(team_id: Option<&str>) -> String {
    match team_id.map(str::trim).filter(|s| !s.is_empty()) {
        Some(id) => format!("?upsert=true&teamId={id}"),
        None => "?upsert=true".into(),
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VercelUserDto {
    pub id: String,
    pub username: Option<String>,
    pub email: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VercelProjectRow {
    pub id: String,
    pub name: String,
    pub framework: Option<String>,
    pub updated_at: Option<i64>,
    pub env_keys: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VercelEnvVarRow {
    pub id: String,
    pub key: String,
    pub kind: String,
    pub targets: Vec<String>,
    pub updated_at: Option<i64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VercelEnvUpsertResult {
    pub key: String,
    pub project_id: String,
    pub project_name: String,
    pub targets: Vec<String>,
    pub kind: String,
}

pub fn verify_token(token: &str) -> Result<VercelUserDto, String> {
    let r = with_bearer(http().get(format!("{BASE}/v2/user")), token)?
        .send()
        .map_err(|e| e.to_string())?;
    let body: Value = r.json().map_err(|e| e.to_string())?;
    if body.get("error").is_some() {
        return Err(api_error_message(&body));
    }
    let user = body
        .get("user")
        .ok_or_else(|| "Risposta Vercel senza user.".to_string())?;
    let id = user
        .get("id")
        .or_else(|| user.get("uid"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    if id.is_empty() {
        return Err("Risposta Vercel senza ID utente.".into());
    }
    Ok(VercelUserDto {
        id,
        username: user
            .get("username")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        email: user
            .get("email")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
    })
}

pub fn list_projects(token: &str, team_id: Option<&str>) -> Result<Vec<VercelProjectRow>, String> {
    let r = with_bearer(
        http().get(format!("{BASE}/v10/projects{}", query_suffix(team_id))),
        token,
    )?
    .send()
    .map_err(|e| e.to_string())?;
    let body: Value = r.json().map_err(|e| e.to_string())?;
    if body.get("error").is_some() {
        return Err(api_error_message(&body));
    }
    let Some(arr) = body.get("projects").and_then(|v| v.as_array()) else {
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
        let env_keys = item
            .get("env")
            .and_then(|v| v.as_array())
            .map(|items| {
                items
                    .iter()
                    .filter_map(|env| {
                        env.get("key")
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string())
                    })
                    .collect()
            })
            .unwrap_or_default();
        out.push(VercelProjectRow {
            id,
            name,
            framework: item
                .get("framework")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            updated_at: item.get("updatedAt").and_then(|v| v.as_i64()),
            env_keys,
        });
    }
    Ok(out)
}

pub fn list_project_envs(
    token: &str,
    team_id: Option<&str>,
    project_id: &str,
) -> Result<Vec<VercelEnvVarRow>, String> {
    let r = with_bearer(
        http().get(format!(
            "{BASE}/v10/projects/{project_id}/env{}",
            query_suffix(team_id)
        )),
        token,
    )?
    .send()
    .map_err(|e| e.to_string())?;
    let body: Value = r.json().map_err(|e| e.to_string())?;
    if body.get("error").is_some() {
        return Err(api_error_message(&body));
    }
    let Some(arr) = body
        .as_array()
        .or_else(|| body.get("envs").and_then(|v| v.as_array()))
        .or_else(|| body.get("env").and_then(|v| v.as_array()))
    else {
        return Ok(vec![]);
    };
    let mut out = Vec::new();
    for item in arr {
        let key = item
            .get("key")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        if key.is_empty() {
            continue;
        }
        let targets = item
            .get("target")
            .and_then(|v| v.as_array())
            .map(|items| {
                items
                    .iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                    .collect()
            })
            .unwrap_or_default();
        out.push(VercelEnvVarRow {
            id: item
                .get("id")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            key,
            kind: item
                .get("type")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            targets,
            updated_at: item.get("updatedAt").and_then(|v| v.as_i64()),
        });
    }
    Ok(out)
}

pub fn upsert_project_env(
    token: &str,
    team_id: Option<&str>,
    project_id: &str,
    project_name: &str,
    key: &str,
    value: &str,
    targets: &[String],
) -> Result<VercelEnvUpsertResult, String> {
    let targets = if targets.is_empty() {
        vec!["production".to_string()]
    } else {
        targets.to_vec()
    };
    let body = json!({
        "key": key,
        "value": value,
        "type": "encrypted",
        "target": targets,
        "comment": "Updated by Rotate",
    });
    let r = with_bearer(
        http().post(format!(
            "{BASE}/v10/projects/{project_id}/env{}",
            upsert_query_suffix(team_id)
        )),
        token,
    )?
    .header("Content-Type", "application/json")
    .json(&body)
    .send()
    .map_err(|e| e.to_string())?;
    let resp: Value = r.json().map_err(|e| e.to_string())?;
    if resp.get("error").is_some() {
        return Err(api_error_message(&resp));
    }
    Ok(VercelEnvUpsertResult {
        key: key.to_string(),
        project_id: project_id.to_string(),
        project_name: project_name.to_string(),
        targets,
        kind: "encrypted".into(),
    })
}
