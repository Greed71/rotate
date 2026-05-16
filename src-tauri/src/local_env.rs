use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalEnvInspectDto {
    pub path: String,
    pub keys: Vec<String>,
    pub exists: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalEnvUpsertResult {
    pub path: String,
    pub key: String,
    pub created: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalEnvUpsertCommand {
    pub path: String,
    pub key: String,
    pub value: String,
}

pub fn inspect(path: &str) -> Result<LocalEnvInspectDto, String> {
    let path = normalize_env_path(path)?;
    let exists = path.exists();
    let content = if exists {
        fs::read_to_string(&path).map_err(|e| format!("Impossibile leggere il file env: {e}"))?
    } else {
        String::new()
    };
    let mut keys = Vec::new();
    for line in content.lines() {
        if let Some(key) = parse_key(line) {
            if !keys.iter().any(|known| known == &key) {
                keys.push(key);
            }
        }
    }
    Ok(LocalEnvInspectDto {
        path: path.to_string_lossy().to_string(),
        keys,
        exists,
    })
}

pub fn upsert(payload: LocalEnvUpsertCommand) -> Result<LocalEnvUpsertResult, String> {
    let path = normalize_env_path(&payload.path)?;
    let key = validate_key(&payload.key)?;
    let old_content = if path.exists() {
        fs::read_to_string(&path).map_err(|e| format!("Impossibile leggere il file env: {e}"))?
    } else {
        String::new()
    };
    let (new_content, created) = upsert_content(&old_content, &key, &payload.value);
    atomic_write(&path, new_content.as_bytes())?;
    Ok(LocalEnvUpsertResult {
        path: path.to_string_lossy().to_string(),
        key,
        created,
    })
}

fn normalize_env_path(raw: &str) -> Result<PathBuf, String> {
    let trimmed = raw.trim().trim_matches('"');
    if trimmed.is_empty() {
        return Err("Indica il percorso del file env.".into());
    }
    let path = PathBuf::from(trimmed);
    if path.is_dir() {
        return Err("Seleziona un file env, non una cartella.".into());
    }
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or_default();
    if !file_name.starts_with(".env") && !file_name.ends_with(".env") {
        return Err("Per sicurezza Rotate scrive solo file env.".into());
    }
    Ok(path)
}

fn validate_key(raw: &str) -> Result<String, String> {
    let key = raw.trim();
    let mut chars = key.chars();
    let first = chars
        .next()
        .ok_or_else(|| "Seleziona o inserisci il nome della variabile env.".to_string())?;
    if !(first == '_' || first.is_ascii_alphabetic()) {
        return Err("Il nome della variabile env deve iniziare con lettera o underscore.".into());
    }
    if !chars.all(|c| c == '_' || c.is_ascii_alphanumeric()) {
        return Err(
            "Il nome della variabile env puo contenere solo lettere, numeri e underscore.".into(),
        );
    }
    Ok(key.to_string())
}

fn parse_key(line: &str) -> Option<String> {
    let trimmed = line.trim_start();
    if trimmed.is_empty() || trimmed.starts_with('#') {
        return None;
    }
    let rest = trimmed.strip_prefix("export ").unwrap_or(trimmed);
    let (key, _) = rest.split_once('=')?;
    validate_key(key).ok()
}

fn upsert_content(content: &str, key: &str, value: &str) -> (String, bool) {
    let replacement = format!("{key}={}", serialize_value(value));
    let mut found = false;
    let mut output = Vec::new();
    for line in content.lines() {
        if parse_key(line).as_deref() == Some(key) {
            let prefix = if line.trim_start().starts_with("export ") {
                "export "
            } else {
                ""
            };
            output.push(format!("{prefix}{replacement}"));
            found = true;
        } else {
            output.push(line.to_string());
        }
    }
    if !found {
        if !output.is_empty() {
            output.push(String::new());
        }
        output.push(replacement);
    }
    let mut result = output.join("\n");
    result.push('\n');
    (result, !found)
}

fn serialize_value(value: &str) -> String {
    if !value.is_empty()
        && value
            .chars()
            .all(|c| !c.is_whitespace() && c != '#' && c != '"' && c != '\'' && c != '\\')
    {
        return value.to_string();
    }
    let escaped = value
        .replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\n', "\\n")
        .replace('\r', "\\r");
    format!("\"{escaped}\"")
}

fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Impossibile creare la cartella env: {e}"))?;
    }
    let tmp = temp_path(path);
    {
        let mut file = fs::File::create(&tmp)
            .map_err(|e| format!("Impossibile preparare il file env: {e}"))?;
        file.write_all(bytes)
            .map_err(|e| format!("Impossibile scrivere il file env: {e}"))?;
        file.sync_all()
            .map_err(|e| format!("Impossibile sincronizzare il file env: {e}"))?;
    }
    replace_file(&tmp, path)
}

#[cfg(windows)]
fn replace_file(tmp: &Path, path: &Path) -> Result<(), String> {
    let backup = backup_path(path);
    let had_original = path.exists();
    if backup.exists() {
        fs::remove_file(&backup)
            .map_err(|e| format!("Impossibile pulire il backup env precedente: {e}"))?;
    }
    if had_original {
        fs::rename(path, &backup)
            .map_err(|e| format!("Impossibile preparare il replace del file env: {e}"))?;
    }
    match fs::rename(tmp, path) {
        Ok(()) => {
            if had_original {
                let _ = fs::remove_file(&backup);
            }
            Ok(())
        }
        Err(err) => {
            if had_original {
                let _ = fs::rename(&backup, path);
            }
            Err(format!("Impossibile aggiornare il file env: {err}"))
        }
    }
}

#[cfg(not(windows))]
fn replace_file(tmp: &Path, path: &Path) -> Result<(), String> {
    fs::rename(tmp, path).map_err(|e| format!("Impossibile aggiornare il file env: {e}"))
}

fn temp_path(path: &Path) -> PathBuf {
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or(".env");
    path.with_file_name(format!("{file_name}.rotate.tmp"))
}

#[cfg(windows)]
fn backup_path(path: &Path) -> PathBuf {
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or(".env");
    path.with_file_name(format!("{file_name}.rotate.bak"))
}

#[cfg(test)]
mod tests {
    use super::{parse_key, upsert, upsert_content, LocalEnvUpsertCommand};
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn parse_key_ignores_comments_and_supports_export() {
        assert_eq!(parse_key("# TOKEN=value"), None);
        assert_eq!(parse_key("export TOKEN=value"), Some("TOKEN".to_string()));
        assert_eq!(
            parse_key("  TURNSTILE_SECRET_KEY=old"),
            Some("TURNSTILE_SECRET_KEY".to_string())
        );
    }

    #[test]
    fn upsert_updates_existing_key_and_preserves_other_lines() {
        let input = "# local\nTURNSTILE_SECRET_KEY=old\nOTHER=value\n";
        let (output, created) = upsert_content(input, "TURNSTILE_SECRET_KEY", "new-secret");
        assert!(!created);
        assert_eq!(
            output,
            "# local\nTURNSTILE_SECRET_KEY=new-secret\nOTHER=value\n"
        );
    }

    #[test]
    fn upsert_appends_missing_key() {
        let (output, created) = upsert_content("OTHER=value\n", "TOKEN", "abc");
        assert!(created);
        assert_eq!(output, "OTHER=value\n\nTOKEN=abc\n");
    }

    #[test]
    fn upsert_replaces_existing_env_file_on_disk() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("rotate-env-test-{unique}"));
        fs::create_dir_all(&dir).expect("create temp dir");
        let path = dir.join(".env.local");
        fs::write(&path, "TOKEN=old\nOTHER=value\n").expect("seed env");

        let result = upsert(LocalEnvUpsertCommand {
            path: path.to_string_lossy().to_string(),
            key: "TOKEN".into(),
            value: "new value".into(),
        })
        .expect("upsert env");

        assert!(!result.created);
        assert_eq!(
            fs::read_to_string(&path).expect("read env"),
            "TOKEN=\"new value\"\nOTHER=value\n"
        );
        let _ = fs::remove_dir_all(dir);
    }
}
