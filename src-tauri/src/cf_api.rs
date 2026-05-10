//! Client minimale per Cloudflare API v4.

use reqwest::blocking::{Client, RequestBuilder};
use reqwest::header::{HeaderValue, AUTHORIZATION};
use serde::Serialize;
use serde_json::{json, Map, Value};

const BASE: &str = "https://api.cloudflare.com/client/v4";

fn http() -> Client {
    Client::builder()
        .user_agent(concat!("Rotate/", env!("CARGO_PKG_VERSION")))
        .build()
        .expect("reqwest client")
}

fn cf_error_message(body: &Value) -> String {
    let message = body
        .get("errors")
        .and_then(|e| e.as_array())
        .and_then(|a| a.first())
        .and_then(|o| o.get("message"))
        .and_then(|m| m.as_str())
        .unwrap_or("Errore API Cloudflare.");
    let code = body
        .get("errors")
        .and_then(|e| e.as_array())
        .and_then(|a| a.first())
        .and_then(|o| o.get("code"))
        .and_then(|m| m.as_i64());
    match code {
        Some(code) => format!("{message} (Cloudflare code {code})"),
        None => message.to_string(),
    }
}

fn normalize_api_token(token: &str) -> Result<String, String> {
    let mut value = token.trim().trim_matches('\u{feff}').trim();
    if value.len() >= 7 && value[..7].eq_ignore_ascii_case("bearer ") {
        value = value[7..].trim();
    }
    value = value.trim_matches('"').trim_matches('\'').trim();

    if value.is_empty() {
        return Err("API token Cloudflare mancante.".into());
    }
    if value.chars().any(|c| c.is_control() || c.is_whitespace()) {
        return Err(
            "Il token Cloudflare contiene spazi, ritorni a capo o caratteri invisibili. Incolla solo il valore del token, senza prefisso Bearer.".into(),
        );
    }

    Ok(value.to_string())
}

fn with_bearer(builder: RequestBuilder, token: &str) -> Result<RequestBuilder, String> {
    let token = normalize_api_token(token)?;
    let value = HeaderValue::from_str(&format!("Bearer {token}")).map_err(|_| {
        "Il token Cloudflare non puo essere usato in un header HTTP valido.".to_string()
    })?;
    Ok(builder.header(AUTHORIZATION, value))
}

pub fn verify_api_token(token: &str) -> Result<Option<String>, String> {
    let r = with_bearer(http().get(format!("{BASE}/user/tokens/verify")), token)?
        .send()
        .map_err(|e| e.to_string())?;
    let body: Value = r.json().map_err(|e| e.to_string())?;
    if !body
        .get("success")
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
    {
        return Err(cf_error_message(&body));
    }
    Ok(body
        .get("result")
        .and_then(|r| r.get("id"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string()))
}

pub fn verify_account(token: &str, account_id: &str) -> Result<(), String> {
    let r = with_bearer(http().get(format!("{BASE}/accounts/{account_id}")), token)?
        .send()
        .map_err(|e| e.to_string())?;
    let body: Value = r.json().map_err(|e| e.to_string())?;
    if !body
        .get("success")
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
    {
        return Err(cf_error_message(&body));
    }
    Ok(())
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CfTokenRow {
    pub id: String,
    pub name: String,
    pub status: String,
    pub expires_on: Option<String>,
}

pub fn list_account_tokens(token: &str, account_id: &str) -> Result<Vec<CfTokenRow>, String> {
    let r = with_bearer(
        http().get(format!("{BASE}/accounts/{account_id}/tokens")),
        token,
    )?
    .send()
    .map_err(|e| e.to_string())?;
    let body: Value = r.json().map_err(|e| e.to_string())?;
    if !body
        .get("success")
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
    {
        return Err(cf_error_message(&body));
    }
    let Some(arr) = body.get("result").and_then(|v| v.as_array()) else {
        return Ok(vec![]);
    };
    let mut out = Vec::new();
    for item in arr {
        let id = item
            .get("id")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        if id.is_empty() {
            continue;
        }
        let name = item
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let status = item
            .get("status")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let expires_on = item.get("expires_on").and_then(|v| {
            if v.is_null() {
                None
            } else {
                v.as_str().map(|s| s.to_string())
            }
        });
        out.push(CfTokenRow {
            id,
            name,
            status,
            expires_on,
        });
    }
    Ok(out)
}

pub fn get_account_token_detail(
    mgmt_token: &str,
    account_id: &str,
    token_id: &str,
) -> Result<Value, String> {
    let r = with_bearer(
        http().get(format!("{BASE}/accounts/{account_id}/tokens/{token_id}")),
        mgmt_token,
    )?
    .send()
    .map_err(|e| e.to_string())?;
    let body: Value = r.json().map_err(|e| e.to_string())?;
    if !body
        .get("success")
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
    {
        return Err(cf_error_message(&body));
    }
    body.get("result")
        .cloned()
        .ok_or_else(|| "Risposta Cloudflare senza result.".into())
}

fn strip_policy_for_create(policy: &Value) -> Result<Value, String> {
    let mut obj = policy
        .as_object()
        .cloned()
        .ok_or_else(|| "Policy non valida.".to_string())?;
    obj.remove("id");
    let groups_val = obj
        .remove("permission_groups")
        .ok_or_else(|| "Policy senza permission_groups.".to_string())?;
    let groups = groups_val
        .as_array()
        .ok_or_else(|| "permission_groups non e un array.".to_string())?;
    let mut new_groups = Vec::new();
    for g in groups {
        let go = g
            .as_object()
            .ok_or_else(|| "permission_group non valido.".to_string())?;
        let id = go
            .get("id")
            .cloned()
            .ok_or_else(|| "permission_group senza id.".to_string())?;
        let meta = go.get("meta").cloned().unwrap_or(json!({}));
        let mut m = Map::new();
        m.insert("id".into(), id);
        m.insert("meta".into(), meta);
        new_groups.push(Value::Object(m));
    }
    obj.insert("permission_groups".into(), Value::Array(new_groups));
    Ok(Value::Object(obj))
}

pub fn build_token_create_body(detail: &Value, new_name: &str) -> Result<Value, String> {
    let policies = detail
        .get("policies")
        .and_then(|p| p.as_array())
        .ok_or_else(|| "Il token non ha policies.".to_string())?;
    if policies.is_empty() {
        return Err("Nessuna policy da clonare.".into());
    }
    let mut out_policies = Vec::new();
    for pol in policies {
        out_policies.push(strip_policy_for_create(pol)?);
    }
    let mut body = Map::new();
    body.insert("name".into(), json!(new_name));
    body.insert("policies".into(), Value::Array(out_policies));
    if let Some(c) = detail.get("condition") {
        if !c.is_null() {
            body.insert("condition".into(), c.clone());
        }
    }
    if let Some(e) = detail.get("expires_on") {
        if !e.is_null() {
            body.insert("expires_on".into(), e.clone());
        }
    }
    if let Some(n) = detail.get("not_before") {
        if !n.is_null() {
            body.insert("not_before".into(), n.clone());
        }
    }
    Ok(Value::Object(body))
}

pub fn create_account_token(
    mgmt_token: &str,
    account_id: &str,
    body: &Value,
) -> Result<(String, String), String> {
    let r = with_bearer(
        http().post(format!("{BASE}/accounts/{account_id}/tokens")),
        mgmt_token,
    )?
    .header("Content-Type", "application/json")
    .json(body)
    .send()
    .map_err(|e| e.to_string())?;
    let resp: Value = r.json().map_err(|e| e.to_string())?;
    if !resp
        .get("success")
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
    {
        return Err(cf_error_message(&resp));
    }
    let result = resp
        .get("result")
        .ok_or_else(|| "Risposta senza result.".to_string())?;
    let id = result
        .get("id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Nuovo token senza id.".to_string())?
        .to_string();
    let value = result
        .get("value")
        .and_then(|v| v.as_str())
        .ok_or_else(|| {
            "Cloudflare non ha restituito il valore del nuovo token. Controlla i permessi Account API Tokens Edit."
                .to_string()
        })?
        .to_string();
    Ok((id, value))
}

pub fn delete_account_token(
    mgmt_token: &str,
    account_id: &str,
    token_id: &str,
) -> Result<(), String> {
    let r = with_bearer(
        http().delete(format!("{BASE}/accounts/{account_id}/tokens/{token_id}")),
        mgmt_token,
    )?
    .send()
    .map_err(|e| e.to_string())?;
    let body: Value = r.json().map_err(|e| e.to_string())?;
    if !body
        .get("success")
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
    {
        return Err(cf_error_message(&body));
    }
    Ok(())
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TurnstileWidgetRow {
    pub sitekey: String,
    pub name: String,
    pub mode: String,
    pub domains: Vec<String>,
    pub modified_on: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TurnstileRotateResult {
    pub sitekey: String,
    pub name: String,
    pub secret: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkerScriptRow {
    pub id: String,
    pub created_on: Option<String>,
    pub modified_on: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkerSecretRow {
    pub name: String,
    pub kind: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccessServiceTokenRow {
    pub id: String,
    pub name: String,
    pub client_id: String,
    pub duration: Option<String>,
    pub expires_at: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccessServiceTokenRotateResult {
    pub id: String,
    pub name: String,
    pub client_id: String,
    pub client_secret: String,
    pub duration: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PagesEnvVarRow {
    pub name: String,
    pub kind: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PagesProjectRow {
    pub id: String,
    pub name: String,
    pub production_branch: Option<String>,
    pub production_env_vars: Vec<PagesEnvVarRow>,
    pub preview_env_vars: Vec<PagesEnvVarRow>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SecretsStoreRow {
    pub id: String,
    pub name: String,
    pub created: Option<String>,
    pub modified: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SecretsStoreSecretRow {
    pub id: String,
    pub name: String,
    pub status: String,
    pub store_id: String,
    pub comment: Option<String>,
    pub scopes: Vec<String>,
}

pub struct SecretsStoreSecretUpsert<'a> {
    pub store_id: &'a str,
    pub secret_id: Option<&'a str>,
    pub secret_name: &'a str,
    pub secret_value: &'a str,
    pub scopes: &'a [String],
    pub comment: Option<&'a str>,
}

pub fn list_turnstile_widgets(
    token: &str,
    account_id: &str,
) -> Result<Vec<TurnstileWidgetRow>, String> {
    let r = with_bearer(
        http().get(format!("{BASE}/accounts/{account_id}/challenges/widgets")),
        token,
    )?
    .send()
    .map_err(|e| e.to_string())?;
    let body: Value = r.json().map_err(|e| e.to_string())?;
    if !body
        .get("success")
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
    {
        return Err(cf_error_message(&body));
    }
    let Some(arr) = body.get("result").and_then(|v| v.as_array()) else {
        return Ok(vec![]);
    };
    let mut out = Vec::new();
    for item in arr {
        let sitekey = item
            .get("sitekey")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        if sitekey.is_empty() {
            continue;
        }
        let name = item
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or("Turnstile widget")
            .to_string();
        let mode = item
            .get("mode")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let domains = item
            .get("domains")
            .and_then(|v| v.as_array())
            .map(|items| {
                items
                    .iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                    .collect()
            })
            .unwrap_or_default();
        let modified_on = item
            .get("modified_on")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        out.push(TurnstileWidgetRow {
            sitekey,
            name,
            mode,
            domains,
            modified_on,
        });
    }
    Ok(out)
}

pub fn rotate_turnstile_secret(
    token: &str,
    account_id: &str,
    sitekey: &str,
    invalidate_immediately: bool,
) -> Result<TurnstileRotateResult, String> {
    let body = json!({ "invalidate_immediately": invalidate_immediately });
    let r = with_bearer(
        http().post(format!(
            "{BASE}/accounts/{account_id}/challenges/widgets/{sitekey}/rotate_secret"
        )),
        token,
    )?
    .json(&body)
    .send()
    .map_err(|e| e.to_string())?;
    let resp: Value = r.json().map_err(|e| e.to_string())?;
    if !resp
        .get("success")
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
    {
        let msg = cf_error_message(&resp);
        if msg.contains("Cloudflare code 10406") {
            return Err(
                "Rotazione Turnstile gia in corso per questo widget. Hai probabilmente scelto una rotazione con grace period: aspetta che finisca la finestra di 2 ore prima di ruotare di nuovo."
                    .into(),
            );
        }
        if msg.to_lowercase().contains("authentication") || msg.contains("Cloudflare code 10000") {
            return Err(
                "Cloudflare ha rifiutato la rotazione Turnstile: il token di gestione puo leggere il widget, ma non ha permessi di scrittura. Ricollega Cloudflare con Turnstile Sites Write oppure Account Settings Write."
                    .into(),
            );
        }
        return Err(msg);
    }
    let result = resp
        .get("result")
        .ok_or_else(|| "Risposta Turnstile senza result.".to_string())?;
    let secret = result
        .get("secret")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Cloudflare non ha restituito il nuovo secret Turnstile.".to_string())?
        .to_string();
    let name = result
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("Turnstile widget")
        .to_string();
    let sitekey = result
        .get("sitekey")
        .and_then(|v| v.as_str())
        .unwrap_or(sitekey)
        .to_string();
    Ok(TurnstileRotateResult {
        sitekey,
        name,
        secret,
    })
}

pub fn list_worker_scripts(token: &str, account_id: &str) -> Result<Vec<WorkerScriptRow>, String> {
    let r = with_bearer(
        http().get(format!("{BASE}/accounts/{account_id}/workers/scripts")),
        token,
    )?
    .send()
    .map_err(|e| e.to_string())?;
    let body: Value = r.json().map_err(|e| e.to_string())?;
    if !body
        .get("success")
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
    {
        return Err(cf_error_message(&body));
    }
    let Some(arr) = body.get("result").and_then(|v| v.as_array()) else {
        return Ok(vec![]);
    };
    let mut out = Vec::new();
    for item in arr {
        let id = item
            .get("id")
            .or_else(|| item.get("script_name"))
            .or_else(|| item.get("name"))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        if id.is_empty() {
            continue;
        }
        let created_on = item
            .get("created_on")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        let modified_on = item
            .get("modified_on")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        out.push(WorkerScriptRow {
            id,
            created_on,
            modified_on,
        });
    }
    Ok(out)
}

pub fn list_worker_secrets(
    token: &str,
    account_id: &str,
    script_name: &str,
) -> Result<Vec<WorkerSecretRow>, String> {
    let r = with_bearer(
        http().get(format!(
            "{BASE}/accounts/{account_id}/workers/scripts/{script_name}/secrets"
        )),
        token,
    )?
    .send()
    .map_err(|e| e.to_string())?;
    let body: Value = r.json().map_err(|e| e.to_string())?;
    if !body
        .get("success")
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
    {
        return Err(cf_error_message(&body));
    }
    let Some(arr) = body.get("result").and_then(|v| v.as_array()) else {
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
        let kind = item
            .get("type")
            .and_then(|v| v.as_str())
            .unwrap_or("secret_text")
            .to_string();
        out.push(WorkerSecretRow { name, kind });
    }
    Ok(out)
}

pub fn update_worker_secret(
    token: &str,
    account_id: &str,
    script_name: &str,
    secret_name: &str,
    secret_value: &str,
) -> Result<WorkerSecretRow, String> {
    let body = json!({
        "name": secret_name,
        "text": secret_value,
        "type": "secret_text",
    });
    let r = with_bearer(
        http().put(format!(
            "{BASE}/accounts/{account_id}/workers/scripts/{script_name}/secrets"
        )),
        token,
    )?
    .header("Content-Type", "application/json")
    .json(&body)
    .send()
    .map_err(|e| e.to_string())?;
    let resp: Value = r.json().map_err(|e| e.to_string())?;
    if !resp
        .get("success")
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
    {
        let msg = cf_error_message(&resp);
        if msg.to_lowercase().contains("authentication") || msg.contains("Cloudflare code 10000") {
            return Err(
                "Cloudflare ha rifiutato l'aggiornamento del secret Workers: ricollega il token manager con Workers Scripts Write."
                    .into(),
            );
        }
        return Err(msg);
    }
    let result = resp
        .get("result")
        .ok_or_else(|| "Risposta Workers senza result.".to_string())?;
    let name = result
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or(secret_name)
        .to_string();
    let kind = result
        .get("type")
        .and_then(|v| v.as_str())
        .unwrap_or("secret_text")
        .to_string();
    Ok(WorkerSecretRow { name, kind })
}

pub fn list_access_service_tokens(
    token: &str,
    account_id: &str,
) -> Result<Vec<AccessServiceTokenRow>, String> {
    let r = with_bearer(
        http().get(format!(
            "{BASE}/accounts/{account_id}/access/service_tokens"
        )),
        token,
    )?
    .send()
    .map_err(|e| e.to_string())?;
    let body: Value = r.json().map_err(|e| e.to_string())?;
    if !body
        .get("success")
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
    {
        return Err(cf_error_message(&body));
    }
    let Some(arr) = body.get("result").and_then(|v| v.as_array()) else {
        return Ok(vec![]);
    };
    let mut out = Vec::new();
    for item in arr {
        let id = item
            .get("id")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        if id.is_empty() {
            continue;
        }
        let name = item
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or("Access service token")
            .to_string();
        let client_id = item
            .get("client_id")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let duration = item
            .get("duration")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        let expires_at = item
            .get("expires_at")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        out.push(AccessServiceTokenRow {
            id,
            name,
            client_id,
            duration,
            expires_at,
        });
    }
    Ok(out)
}

pub fn rotate_access_service_token(
    token: &str,
    account_id: &str,
    service_token_id: &str,
    previous_client_secret_expires_at: Option<&str>,
) -> Result<AccessServiceTokenRotateResult, String> {
    let body = match previous_client_secret_expires_at {
        Some(expires_at) if !expires_at.trim().is_empty() => {
            json!({ "previous_client_secret_expires_at": expires_at.trim() })
        }
        _ => json!({}),
    };
    let r = with_bearer(
        http().post(format!(
            "{BASE}/accounts/{account_id}/access/service_tokens/{service_token_id}/rotate"
        )),
        token,
    )?
    .header("Content-Type", "application/json")
    .json(&body)
    .send()
    .map_err(|e| e.to_string())?;
    let resp: Value = r.json().map_err(|e| e.to_string())?;
    if !resp
        .get("success")
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
    {
        let msg = cf_error_message(&resp);
        if msg.to_lowercase().contains("authentication") || msg.contains("Cloudflare code 10000") {
            return Err(
                "Cloudflare ha rifiutato la rotazione del Service Token: ricollega il token manager con permessi Zero Trust Access Service Tokens Write."
                    .into(),
            );
        }
        return Err(msg);
    }
    let result = resp
        .get("result")
        .ok_or_else(|| "Risposta Access senza result.".to_string())?;
    let id = result
        .get("id")
        .and_then(|v| v.as_str())
        .unwrap_or(service_token_id)
        .to_string();
    let name = result
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("Access service token")
        .to_string();
    let client_id = result
        .get("client_id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Cloudflare non ha restituito il Client ID Access.".to_string())?
        .to_string();
    let client_secret = result
        .get("client_secret")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Cloudflare non ha restituito il nuovo Client Secret Access.".to_string())?
        .to_string();
    let duration = result
        .get("duration")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    Ok(AccessServiceTokenRotateResult {
        id,
        name,
        client_id,
        client_secret,
        duration,
    })
}

fn parse_pages_env_vars(value: Option<&Value>) -> Vec<PagesEnvVarRow> {
    let Some(obj) = value.and_then(|v| v.as_object()) else {
        return vec![];
    };
    let mut out = Vec::new();
    for (name, item) in obj {
        if item.is_null() {
            continue;
        }
        let kind = item
            .get("type")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown")
            .to_string();
        out.push(PagesEnvVarRow {
            name: name.to_string(),
            kind,
        });
    }
    out.sort_by(|a, b| a.name.cmp(&b.name));
    out
}

pub fn list_pages_projects(token: &str, account_id: &str) -> Result<Vec<PagesProjectRow>, String> {
    let r = with_bearer(
        http().get(format!("{BASE}/accounts/{account_id}/pages/projects")),
        token,
    )?
    .send()
    .map_err(|e| e.to_string())?;
    let body: Value = r.json().map_err(|e| e.to_string())?;
    if !body
        .get("success")
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
    {
        return Err(cf_error_message(&body));
    }
    let Some(arr) = body.get("result").and_then(|v| v.as_array()) else {
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
        let id = item
            .get("id")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let production_branch = item
            .get("production_branch")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        let configs = item.get("deployment_configs");
        let production_env_vars = parse_pages_env_vars(
            configs
                .and_then(|v| v.get("production"))
                .and_then(|v| v.get("env_vars")),
        );
        let preview_env_vars = parse_pages_env_vars(
            configs
                .and_then(|v| v.get("preview"))
                .and_then(|v| v.get("env_vars")),
        );
        out.push(PagesProjectRow {
            id,
            name,
            production_branch,
            production_env_vars,
            preview_env_vars,
        });
    }
    Ok(out)
}

pub fn update_pages_secret(
    token: &str,
    account_id: &str,
    project_name: &str,
    environment: &str,
    secret_name: &str,
    secret_value: &str,
) -> Result<PagesEnvVarRow, String> {
    let environment = match environment {
        "preview" => "preview",
        _ => "production",
    };
    let mut env_vars = Map::new();
    env_vars.insert(
        secret_name.to_string(),
        json!({
            "type": "secret_text",
            "value": secret_value,
        }),
    );
    let mut env_config = Map::new();
    env_config.insert("env_vars".into(), Value::Object(env_vars));
    let mut deployment_configs = Map::new();
    deployment_configs.insert(environment.into(), Value::Object(env_config));
    let body = json!({ "deployment_configs": Value::Object(deployment_configs) });
    let r = with_bearer(
        http().patch(format!(
            "{BASE}/accounts/{account_id}/pages/projects/{project_name}"
        )),
        token,
    )?
    .header("Content-Type", "application/json")
    .json(&body)
    .send()
    .map_err(|e| e.to_string())?;
    let resp: Value = r.json().map_err(|e| e.to_string())?;
    if !resp
        .get("success")
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
    {
        let msg = cf_error_message(&resp);
        if msg.to_lowercase().contains("authentication") || msg.contains("Cloudflare code 10000") {
            return Err(
                "Cloudflare ha rifiutato l'aggiornamento Pages: ricollega il token manager con Pages Write."
                    .into(),
            );
        }
        return Err(msg);
    }
    Ok(PagesEnvVarRow {
        name: secret_name.to_string(),
        kind: "secret_text".into(),
    })
}

pub fn list_secrets_stores(token: &str, account_id: &str) -> Result<Vec<SecretsStoreRow>, String> {
    let r = with_bearer(
        http().get(format!("{BASE}/accounts/{account_id}/secrets_store/stores")),
        token,
    )?
    .send()
    .map_err(|e| e.to_string())?;
    let body: Value = r.json().map_err(|e| e.to_string())?;
    if !body
        .get("success")
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
    {
        return Err(cf_error_message(&body));
    }
    let Some(arr) = body.get("result").and_then(|v| v.as_array()) else {
        return Ok(vec![]);
    };
    let mut out = Vec::new();
    for item in arr {
        let id = item
            .get("id")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        if id.is_empty() {
            continue;
        }
        let name = item
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or("Secrets store")
            .to_string();
        let created = item
            .get("created")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        let modified = item
            .get("modified")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        out.push(SecretsStoreRow {
            id,
            name,
            created,
            modified,
        });
    }
    Ok(out)
}

pub fn list_secrets_store_secrets(
    token: &str,
    account_id: &str,
    store_id: &str,
) -> Result<Vec<SecretsStoreSecretRow>, String> {
    let r = with_bearer(
        http().get(format!(
            "{BASE}/accounts/{account_id}/secrets_store/stores/{store_id}/secrets"
        )),
        token,
    )?
    .send()
    .map_err(|e| e.to_string())?;
    let body: Value = r.json().map_err(|e| e.to_string())?;
    if !body
        .get("success")
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
    {
        return Err(cf_error_message(&body));
    }
    let Some(arr) = body.get("result").and_then(|v| v.as_array()) else {
        return Ok(vec![]);
    };
    let mut out = Vec::new();
    for item in arr {
        let id = item
            .get("id")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        if id.is_empty() {
            continue;
        }
        let name = item
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or("Secret")
            .to_string();
        let status = item
            .get("status")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let store_id = item
            .get("store_id")
            .and_then(|v| v.as_str())
            .unwrap_or(store_id)
            .to_string();
        let comment = item
            .get("comment")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        let scopes = item
            .get("scopes")
            .and_then(|v| v.as_array())
            .map(|items| {
                items
                    .iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                    .collect()
            })
            .unwrap_or_default();
        out.push(SecretsStoreSecretRow {
            id,
            name,
            status,
            store_id,
            comment,
            scopes,
        });
    }
    Ok(out)
}

pub fn upsert_secrets_store_secret(
    token: &str,
    account_id: &str,
    params: SecretsStoreSecretUpsert<'_>,
) -> Result<SecretsStoreSecretRow, String> {
    let store_id = params.store_id;
    let secret_name = params.secret_name;
    let scopes = if params.scopes.is_empty() {
        vec!["workers".to_string()]
    } else {
        params.scopes.to_vec()
    };
    let result = match params.secret_id {
        Some(id) if !id.trim().is_empty() => {
            let body = json!({
                "value": params.secret_value,
                "scopes": scopes,
                "comment": params.comment.unwrap_or("Updated by Rotate"),
            });
            let r = with_bearer(
                http().patch(format!(
                    "{BASE}/accounts/{account_id}/secrets_store/stores/{store_id}/secrets/{}",
                    id.trim()
                )),
                token,
            )?
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .map_err(|e| e.to_string())?;
            let resp: Value = r.json().map_err(|e| e.to_string())?;
            if !resp
                .get("success")
                .and_then(|v| v.as_bool())
                .unwrap_or(false)
            {
                return Err(cf_error_message(&resp));
            }
            resp.get("result")
                .cloned()
                .ok_or_else(|| "Risposta Secrets Store senza result.".to_string())?
        }
        _ => {
            let body = json!([{
                "name": secret_name,
                "value": params.secret_value,
                "scopes": scopes,
                "comment": params.comment.unwrap_or("Created by Rotate"),
            }]);
            let r = with_bearer(
                http().post(format!(
                    "{BASE}/accounts/{account_id}/secrets_store/stores/{store_id}/secrets"
                )),
                token,
            )?
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .map_err(|e| e.to_string())?;
            let resp: Value = r.json().map_err(|e| e.to_string())?;
            if !resp
                .get("success")
                .and_then(|v| v.as_bool())
                .unwrap_or(false)
            {
                return Err(cf_error_message(&resp));
            }
            resp.get("result")
                .and_then(|v| v.as_array())
                .and_then(|arr| arr.first())
                .cloned()
                .or_else(|| resp.get("result").cloned())
                .ok_or_else(|| "Risposta Secrets Store senza result.".to_string())?
        }
    };
    let id = result
        .get("id")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let name = result
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or(secret_name)
        .to_string();
    let status = result
        .get("status")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let store_id = result
        .get("store_id")
        .and_then(|v| v.as_str())
        .unwrap_or(store_id)
        .to_string();
    let comment = result
        .get("comment")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let scopes = result
        .get("scopes")
        .and_then(|v| v.as_array())
        .map(|items| {
            items
                .iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect()
        })
        .unwrap_or_default();
    Ok(SecretsStoreSecretRow {
        id,
        name,
        status,
        store_id,
        comment,
        scopes,
    })
}
