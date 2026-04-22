# Rotate

A **local-first** desktop app to collect and manage API keys in one place: integrations (e.g. Cloudflare), a PIN-protected vault, and selective operations such as **token rotation** where supported.

> UI in Italian · [Tauri 2](https://v2.tauri.app/) · React 19 · TypeScript · Tailwind CSS v4

---

## Features

- **Vault**: Long PIN (min. 10 characters), **Argon2** hash stored in the local database (`rotate.db`); time-limited unlock session (~15 min) kept in memory only.
- **Cloudflare**: Link account (Account ID + management token), list tokens, controlled reveal of the saved token, **rotation** (clone policies → new token → optional vault update and revoke old). Requires API permissions such as *Account · API Tokens · Read* and *Edit*.
- **Other providers** (Supabase, OAuth Google): placeholders / exploration in progress.
- **Clipboard**: Sensitive copy with automatic clipboard clearing (where supported).

---

## Stack

| Layer        | Technologies |
|-------------|--------------|
| UI          | React 19, TypeScript, Vite 7, Tailwind v4 |
| Desktop     | Tauri 2, Rust 2021 |
| Local data  | SQLite (rusqlite, bundled), `rotate.db` in the app data directory |
| Secrets     | PIN hash in DB; provider tokens in the **OS credential store** (e.g. Windows Credential Manager) |
| Security    | Argon2id (PHC), CSP in `src-tauri/tauri.conf.json` |

App identifier: `com.longo.rotate`.

---

## Prerequisites

- **Node.js** (LTS recommended) and **npm**
- Stable **Rust** + **Cargo** ([rustup](https://rustup.rs/))
- On **Windows**: ensure `cargo` is on your `PATH` in terminals such as Cursor/VS Code (the `desktop` script prepends `%USERPROFILE%\.cargo\bin` when possible)

---

## Development

```bash
git clone https://github.com/<org-or-user>/rotate.git
cd rotate
npm install
```

(Replace the URL with your fork or upstream repository.)

### Desktop app (frontend + Tauri backend)

```bash
npm run desktop
```

Starts Vite on the dev port configured in Tauri and opens the native window.

### Frontend only (browser)

```bash
npm run dev
```

Useful for UI work; Rust `invoke` calls **are not** available without the Tauri process.

---

## Build

### Frontend (output in `dist/`)

```bash
npm run build
```

### Desktop executable

```bash
npm run desktop:build
```

Installer bundling (WiX, etc.) may be turned off in `src-tauri/tauri.conf.json` (`bundle.active`) to avoid extra build dependencies during development.

---

## Security (summary)

| Asset | Storage |
|--------|---------|
| PIN (never plaintext) | Argon2 hash in SQLite (`vault_settings`) |
| Unlocked session | RAM only, expires automatically |
| Provider API tokens | OS keyring (service tied to `com.longo.rotate`) |

Do not commit `rotate.db` or credentials. Add a `LICENSE` file if you publish the code.

---

## Repository layout

```
rotate/
├── src/                 # React (UI, vault components, views)
├── src-tauri/           # Rust: IPC commands, DB, Cloudflare API, secrets
│   ├── src/
│   │   ├── lib.rs       # Tauri commands and wiring
│   │   ├── db.rs        # SQLite + migrations
│   │   ├── security.rs  # PIN, vault session
│   │   ├── secrets.rs   # Provider token keyring
│   │   └── cf_api.rs    # Cloudflare API v4 client
│   └── tauri.conf.json
├── scripts/             # Desktop launch helpers (Cargo PATH on Windows)
└── package.json
```

---

## Contributing

Issues and pull requests are welcome. When you add Rust IPC commands, also update:

- `src-tauri/build.rs` (`AppManifest::commands`)
- `src-tauri/capabilities/default.json` (`allow-<command>` permissions)

---

## References

- [Tauri v2 documentation](https://v2.tauri.app/)
- [Cloudflare API v4 — Account API Tokens](https://developers.cloudflare.com/api/)
