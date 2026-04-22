# Rotate

![Node.js](https://img.shields.io/badge/Node.js-LTS-brightgreen)
![Rust](https://img.shields.io/badge/Rust-stable-orange?logo=rust&logoColor=white)
![Tauri](https://img.shields.io/badge/Tauri-2-24C8DB?logo=tauri&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-blue)

A **local-first** desktop app built with **Tauri 2**, **React 19**, and **Rust** to keep API keys and provider integrations in one place - guarded by a vault PIN, with **selective** automation (e.g. Cloudflare token rotation) instead of “rotate everything at once.”

Meant for developers who want a small native utility on disk: metadata in SQLite, provider secrets in the OS keyring, and a time-boxed unlock session in RAM.

> **Try it:** after `npm install`, run `npm run desktop` - Vite serves the UI and Tauri opens the window. The interface is **Italian**; the README is in English for GitHub.

---

## Features

- **Vault**: create a long PIN (10+ characters); only an **Argon2** hash is stored in `rotate.db`; unlock lasts ~15 minutes in memory, then the app locks again.
- **Cloudflare**: link an account (Account ID + management API token), list account tokens, reveal the saved token behind a confirmation, **rotate** a chosen token (clone policies → new secret → optionally replace the saved token and revoke the old one). Needs *Account · API Tokens · Read* and *Edit*.
- **Other providers**: Supabase / OAuth Google are scaffolded for later work.
- **Clipboard**: copy sensitive values with timed auto-clear where the platform supports it.

---

## Why Tauri (and Rust) instead of Electron?

Electron ships a full Chromium runtime per app - larger downloads and a heavier memory footprint. Tauri uses the system webview and runs privileged logic in **Rust**, which fits IPC commands, SQLite, HTTP to Cloudflare, and keyring access without bundling Node on the desktop. For a security-adjacent tool, that boundary is easier to reason about than a large JS main process.

---

## Why store the PIN hash in SQLite (and not the OS keyring)?

Provider tokens still use the **OS credential store** (e.g. Windows Credential Manager). The vault PIN hash lives in SQLite because on some Windows setups `set_password` on the keyring can **block indefinitely** without returning an error, which made first-time vault setup appear “stuck.” The PIN is never stored in plaintext - only an Argon2id PHC string in the `vault_settings` table.

---

## Architecture

```
rotate/
├── src/                      React UI (vault screens, Cloudflare detail, navigation)
├── src-tauri/
│   ├── src/
│   │   ├── lib.rs            Tauri command registration, SessionState
│   │   ├── db.rs             SQLite (integrations, Cloudflare rows, vault_settings)
│   │   ├── security.rs       PIN hash, vault session TTL
│   │   ├── secrets.rs      Provider tokens → keyring entries
│   │   └── cf_api.rs       Cloudflare API v4 (verify, list, detail, create, delete)
│   ├── capabilities/         ACL allow-list for each IPC command
│   └── tauri.conf.json       window, CSP, bundle options
├── scripts/                  run-desktop*.mjs - prepends Cargo to PATH on Windows
└── package.json
```

### IPC flow (frontend → Rust)

The UI calls commands with `@tauri-apps/api`:

```ts
import { invoke } from "@tauri-apps/api/core";

const status = await invoke<SecurityStatusDto>("security_status");
```

Sensitive commands call `require_vault_access` in Rust: PIN must be configured and the in-memory session must still be unlocked.

When you add a new `#[tauri::command]`:

1. Register it in `invoke_handler!` in `lib.rs`.
2. Add the name to `AppManifest::commands` in `src-tauri/build.rs`.
3. Add `allow-<kebab-case-command>` in `src-tauri/capabilities/default.json`.

---

## Getting started

```bash
# 1. Clone and install JS dependencies
git clone https://github.com/<org-or-user>/rotate.git
cd rotate
npm install

# 2. Install Rust if needed: https://rustup.rs/

# 3. Desktop app (Vite + Tauri - recommended)
npm run desktop

# 4. Frontend only (no Rust IPC - UI prototyping)
npm run dev
```

On **Windows**, if your IDE terminal cannot find `cargo`, run from a shell where Rust is on `PATH`, or rely on `scripts/run-desktop.mjs`, which prepends `%USERPROFILE%\.cargo\bin` when present.

---

## Build

```bash
# Production frontend bundle → dist/
npm run build

# Native binary (see tauri.conf.json for bundle / WiX settings)
npm run desktop:build
```

`bundle.active` may be set to `false` during development to skip installer toolchains (e.g. WiX) you do not need yet.

---

## Security (summary)

| Asset | Where it lives |
|--------|----------------|
| PIN (never plaintext) | Argon2 hash in SQLite (`vault_settings`) |
| Unlocked vault session | RAM only; expires automatically |
| Provider API tokens | OS keyring, service id `com.longo.rotate` |

Do not commit `rotate.db`, `.env` files with secrets, or API tokens.

---

## References

- [Tauri v2 documentation](https://v2.tauri.app/)
- [Cloudflare API v4 - Account API Tokens](https://developers.cloudflare.com/api/)

---

## License

MIT
