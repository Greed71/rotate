//! Token e segreti nel portachiavi del sistema (Windows Credential Manager, ecc.).

use keyring::Entry;

const SERVICE: &str = "com.longo.rotate";

fn cf_entry(integration_id: &str) -> Result<Entry, String> {
    Entry::new(SERVICE, &format!("cloudflare:token:{integration_id}")).map_err(|e| e.to_string())
}

pub fn cf_token_save(integration_id: &str, token: &str) -> Result<(), String> {
    let entry = cf_entry(integration_id)?;
    entry.set_password(token).map_err(|e| e.to_string())
}

pub fn cf_token_get(integration_id: &str) -> Result<Option<String>, String> {
    let entry = cf_entry(integration_id)?;
    match entry.get_password() {
        Ok(s) => Ok(Some(s)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

pub fn cf_token_delete(integration_id: &str) -> Result<(), String> {
    let entry = cf_entry(integration_id)?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}
