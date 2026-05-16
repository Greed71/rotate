//! Client minimale per GitHub REST API.

use base64::{engine::general_purpose, Engine as _};
use reqwest::blocking::{Client, RequestBuilder};
use reqwest::header::{HeaderValue, ACCEPT, AUTHORIZATION};
use serde::Serialize;
use serde_json::{json, Value};

const BASE: &str = "https://api.github.com";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GithubUserDto {
    pub login: String,
    pub name: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GithubActionsSecretUpsertResult {
    pub owner: String,
    pub repo: String,
    pub name: String,
}

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
        return Err("Token GitHub mancante.".into());
    }
    if value.chars().any(|c| c.is_control() || c.is_whitespace()) {
        return Err(
            "Il token GitHub contiene spazi o caratteri invisibili. Incolla solo il valore del token."
                .into(),
        );
    }
    Ok(value.to_string())
}

fn with_auth(builder: RequestBuilder, token: &str) -> Result<RequestBuilder, String> {
    let token = normalize_token(token)?;
    let auth = HeaderValue::from_str(&format!("Bearer {token}")).map_err(|_| {
        "Il token GitHub non puo essere usato in un header HTTP valido.".to_string()
    })?;
    Ok(builder
        .header(AUTHORIZATION, auth)
        .header(ACCEPT, "application/vnd.github+json")
        .header("X-GitHub-Api-Version", "2022-11-28"))
}

fn api_error_message(body: &Value) -> String {
    body.get("message")
        .and_then(|m| m.as_str())
        .unwrap_or("Errore API GitHub.")
        .to_string()
}

pub fn verify_token(token: &str) -> Result<GithubUserDto, String> {
    let response = with_auth(http().get(format!("{BASE}/user")), token)?
        .send()
        .map_err(|e| e.to_string())?;
    let status = response.status();
    let body: Value = response.json().map_err(|e| e.to_string())?;
    if !status.is_success() {
        return Err(api_error_message(&body));
    }
    let login = body
        .get("login")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    if login.is_empty() {
        return Err("Risposta GitHub senza login utente.".into());
    }
    Ok(GithubUserDto {
        login,
        name: body
            .get("name")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
    })
}

pub fn upsert_actions_secret(
    token: &str,
    owner: &str,
    repo: &str,
    name: &str,
    value: &str,
) -> Result<GithubActionsSecretUpsertResult, String> {
    let owner = validate_repo_part(owner, "owner")?;
    let repo = validate_repo_part(repo, "repository")?;
    let name = validate_secret_name(name)?;
    let key = fetch_public_key(token, &owner, &repo)?;
    let encrypted_value = encrypt_secret(value, &key.key)?;
    let response = with_auth(
        http().put(format!(
            "{BASE}/repos/{owner}/{repo}/actions/secrets/{name}"
        )),
        token,
    )?
    .json(&json!({
        "encrypted_value": encrypted_value,
        "key_id": key.key_id,
    }))
    .send()
    .map_err(|e| e.to_string())?;
    let status = response.status();
    if !status.is_success() {
        let body: Value = response.json().unwrap_or_else(|_| json!({}));
        return Err(api_error_message(&body));
    }
    Ok(GithubActionsSecretUpsertResult { owner, repo, name })
}

struct GithubPublicKey {
    key_id: String,
    key: String,
}

fn fetch_public_key(token: &str, owner: &str, repo: &str) -> Result<GithubPublicKey, String> {
    let response = with_auth(
        http().get(format!(
            "{BASE}/repos/{owner}/{repo}/actions/secrets/public-key"
        )),
        token,
    )?
    .send()
    .map_err(|e| e.to_string())?;
    let status = response.status();
    let body: Value = response.json().map_err(|e| e.to_string())?;
    if !status.is_success() {
        return Err(api_error_message(&body));
    }
    let key_id = body
        .get("key_id")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let key = body
        .get("key")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    if key_id.is_empty() || key.is_empty() {
        return Err("Risposta GitHub senza public key del repository.".into());
    }
    Ok(GithubPublicKey { key_id, key })
}

fn encrypt_secret(value: &str, public_key_b64: &str) -> Result<String, String> {
    sodiumoxide::init().map_err(|_| "Impossibile inizializzare libsodium.".to_string())?;
    let key_bytes = general_purpose::STANDARD
        .decode(public_key_b64)
        .map_err(|_| "Public key GitHub non valida.".to_string())?;
    let public_key = sodiumoxide::crypto::box_::PublicKey::from_slice(&key_bytes)
        .ok_or_else(|| "Public key GitHub di lunghezza non valida.".to_string())?;
    let encrypted = sodiumoxide::crypto::sealedbox::seal(value.as_bytes(), &public_key);
    Ok(general_purpose::STANDARD.encode(encrypted))
}

fn validate_repo_part(raw: &str, label: &str) -> Result<String, String> {
    let value = raw.trim();
    if value.is_empty() {
        return Err(format!("GitHub {label} mancante."));
    }
    if value
        .chars()
        .any(|c| c.is_control() || c.is_whitespace() || c == '/')
    {
        return Err(format!("GitHub {label} non valido."));
    }
    Ok(value.to_string())
}

fn validate_secret_name(raw: &str) -> Result<String, String> {
    let name = raw.trim();
    let mut chars = name.chars();
    let first = chars
        .next()
        .ok_or_else(|| "Nome secret GitHub mancante.".to_string())?;
    if !(first == '_' || first.is_ascii_alphabetic()) {
        return Err("Il nome secret GitHub deve iniziare con lettera o underscore.".into());
    }
    if !chars.all(|c| c == '_' || c.is_ascii_alphanumeric()) {
        return Err(
            "Il nome secret GitHub puo contenere solo lettere, numeri e underscore.".into(),
        );
    }
    Ok(name.to_string())
}
