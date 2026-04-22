//! Client minimale per Cloudflare API v4 (verifica token, account, elenco API token, rotazione).

use reqwest::blocking::Client;
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
    body.get("errors")
        .and_then(|e| e.as_array())
        .and_then(|a| a.first())
        .and_then(|o| o.get("message"))
        .and_then(|m| m.as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| "Errore API Cloudflare.".into())
}

pub fn verify_api_token(token: &str) -> Result<(), String> {
    let r = http()
        .get(format!("{BASE}/user/tokens/verify"))
        .header("Authorization", format!("Bearer {token}"))
        .send()
        .map_err(|e| e.to_string())?;
    let body: Value = r.json().map_err(|e| e.to_string())?;
    if !body.get("success").and_then(|v| v.as_bool()).unwrap_or(false) {
        return Err(cf_error_message(&body));
    }
    Ok(())
}

pub fn verify_account(token: &str, account_id: &str) -> Result<(), String> {
    let r = http()
        .get(format!("{BASE}/accounts/{account_id}"))
        .header("Authorization", format!("Bearer {token}"))
        .send()
        .map_err(|e| e.to_string())?;
    let body: Value = r.json().map_err(|e| e.to_string())?;
    if !body.get("success").and_then(|v| v.as_bool()).unwrap_or(false) {
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
    let r = http()
        .get(format!("{BASE}/accounts/{account_id}/tokens"))
        .header("Authorization", format!("Bearer {token}"))
        .send()
        .map_err(|e| e.to_string())?;
    let body: Value = r.json().map_err(|e| e.to_string())?;
    if !body.get("success").and_then(|v| v.as_bool()).unwrap_or(false) {
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
        let expires_on = item
            .get("expires_on")
            .and_then(|v| {
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

/// Dettaglio token (policies, condition, …) per clonare in un nuovo token.
pub fn get_account_token_detail(
    mgmt_token: &str,
    account_id: &str,
    token_id: &str,
) -> Result<Value, String> {
    let r = http()
        .get(format!("{BASE}/accounts/{account_id}/tokens/{token_id}"))
        .header("Authorization", format!("Bearer {mgmt_token}"))
        .send()
        .map_err(|e| e.to_string())?;
    let body: Value = r.json().map_err(|e| e.to_string())?;
    if !body.get("success").and_then(|v| v.as_bool()).unwrap_or(false) {
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
        .ok_or_else(|| "permission_groups non è un array.".to_string())?;
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

/// Corpo `POST /tokens` derivato dal GET dettaglio (stesse policy / vincoli).
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

/// Crea token; restituisce `(id, secret)` — il secret è mostrato solo in questa risposta.
pub fn create_account_token(
    mgmt_token: &str,
    account_id: &str,
    body: &Value,
) -> Result<(String, String), String> {
    let r = http()
        .post(format!("{BASE}/accounts/{account_id}/tokens"))
        .header("Authorization", format!("Bearer {mgmt_token}"))
        .header("Content-Type", "application/json")
        .json(body)
        .send()
        .map_err(|e| e.to_string())?;
    let resp: Value = r.json().map_err(|e| e.to_string())?;
    if !resp.get("success").and_then(|v| v.as_bool()).unwrap_or(false) {
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
            "Cloudflare non ha restituito il valore del nuovo token. Controlla i permessi (Account · API Tokens · Edit)."
                .to_string()
        })?
        .to_string();
    Ok((id, value))
}

pub fn delete_account_token(mgmt_token: &str, account_id: &str, token_id: &str) -> Result<(), String> {
    let r = http()
        .delete(format!("{BASE}/accounts/{account_id}/tokens/{token_id}"))
        .header("Authorization", format!("Bearer {mgmt_token}"))
        .send()
        .map_err(|e| e.to_string())?;
    let body: Value = r.json().map_err(|e| e.to_string())?;
    if !body.get("success").and_then(|v| v.as_bool()).unwrap_or(false) {
        return Err(cf_error_message(&body));
    }
    Ok(())
}
