# Rotate

![Node.js](https://img.shields.io/badge/Node.js-LTS-brightgreen)
![Rust](https://img.shields.io/badge/Rust-stable-orange)
![Tauri](https://img.shields.io/badge/Tauri-2-24C8DB)
![License](https://img.shields.io/badge/license-MIT-blue)

Rotate is a **local-first desktop app** built with **Tauri 2**, **React 19**, and **Rust** for managing provider credentials and rotating API secrets from one vault.

The current focus is Cloudflare: link a management token, inspect what it can reach, rotate account API tokens, and rotate Cloudflare Turnstile widget secrets without jumping through the Cloudflare dashboard each time.

> After `npm install`, run `npm run desktop`. The app UI is Italian; this README is in English for GitHub.

---

## Features

- **Local vault**: protected by a vault password. Rotate stores only a salted **Argon2id** hash in SQLite, never the password itself.
- **Timed unlock session**: secrets are accessible only while the vault session is unlocked; the session lives in memory and expires automatically.
- **Secure local secret storage**: provider tokens are written to the OS credential store when it works. On Windows setups where Credential Manager reports success but does not persist, Rotate falls back to **DPAPI-encrypted local storage** for the current Windows user.
- **Cloudflare account linking**: save Account ID plus a management API token.
- **Cloudflare API token rotation**: list account tokens when permitted, clone an existing token's policies, create a new token, show the new secret once, and optionally revoke the old token.
- **Manual API token rotation by ID**: rotate a Cloudflare API token even when it does not appear in the list, as long as you know its token ID.
- **Turnstile secret rotation**: list Turnstile widgets, rotate a widget secret, choose immediate invalidation or a 2-hour grace period, and show the new secret once.
- **Clipboard safety**: sensitive values copied from the app are auto-cleared where supported.
- **Provider scaffolding**: Supabase and Google OAuth are present as future provider slots.

---

## Cloudflare Permissions

Rotate separates the **management token** from the secrets it rotates. The management token is the Cloudflare API token you paste into Rotate so the app can call Cloudflare on your behalf.

Recommended Cloudflare token permissions depend on what you want Rotate to do:

| Capability | Required Cloudflare permission |
| --- | --- |
| Verify the token and account | Account access to the target account |
| List account API tokens | `Account - API Tokens - Read` |
| Rotate account API tokens | `Account - API Tokens - Edit` |
| List Turnstile widgets | Turnstile/account read access for the account |
| Rotate Turnstile secrets | `Account - Turnstile Sites - Edit` or `Account - Account Settings - Edit` |

If Turnstile widgets are visible but rotation returns `Authentication error (Cloudflare code 10000)`, the token can read the widget but cannot write/rotate it. Reconnect Cloudflare in Rotate with a token that includes `Turnstile Sites Write` or `Account Settings Write`.

---

## Security Model

Rotate is local-first. There is no backend service and no cloud sync.

| Asset | Storage |
| --- | --- |
| Vault password | Never stored directly; salted Argon2id PHC hash in SQLite (`vault_settings`) |
| Unlock session | RAM only; expires automatically |
| Cloudflare management token | OS credential store when reliable; otherwise DPAPI-encrypted local file on Windows |
| Rotated one-time secrets | Shown once in the UI; not silently written to `.env` files |
| Metadata | SQLite app data directory (`rotate.db`) |

The vault password must be at least 12 characters. Under 16 characters, Rotate requires a mix across character classes and rejects common predictable fragments. Backend validation enforces this; the frontend checks are only ergonomic.

### Credential Manager and DPAPI

On normal Windows setups, Rotate uses Windows Credential Manager through the Rust `keyring` crate. During testing, one Windows profile returned success from both `keyring` and `cmdkey` while `cmdkey /list` still showed no persisted credentials. For that case, Rotate verifies persistence after writing. If the credential store does not actually retain the secret, Rotate stores an encrypted fallback using Windows DPAPI, bound to the current Windows user.

Do not commit `rotate.db`, `.env` files, generated app data, or tokens.

---

## Architecture

```text
rotate/
├── src/                       React UI
│   ├── components/            Views, vault screens, Cloudflare detail
│   ├── locales/               Italian and English UI strings
│   └── types.ts               IPC DTO types
├── src-tauri/
│   ├── src/
│   │   ├── lib.rs             Tauri commands and IPC registration
│   │   ├── db.rs              SQLite migrations and metadata
│   │   ├── security.rs        Vault password hashing, unlock TTL, auth throttling
│   │   ├── secrets.rs         Credential Manager and DPAPI-backed secret storage
│   │   └── cf_api.rs          Cloudflare API v4 client
│   ├── capabilities/          IPC permission allow-list
│   └── tauri.conf.json        Tauri app config
├── scripts/                   Desktop launch/build helpers
└── package.json
```

### IPC Flow

The frontend calls Rust commands with `@tauri-apps/api`:

```ts
import { invoke } from "@tauri-apps/api/core";

const status = await invoke<SecurityStatusDto>("security_status");
```

Sensitive commands call `require_vault_access` in Rust. The vault password must be configured and the in-memory session must still be unlocked.

When adding a new `#[tauri::command]`:

1. Register it in `invoke_handler!` in `src-tauri/src/lib.rs`.
2. Add the command name to `AppManifest::commands` in `src-tauri/build.rs`.
3. Add `allow-<kebab-case-command>` to `src-tauri/capabilities/default.json`.

---

## Getting Started

```bash
# 1. Clone and install JS dependencies
git clone https://github.com/<org-or-user>/rotate.git
cd rotate
npm install

# 2. Install Rust if needed
# https://rustup.rs/

# 3. Run the desktop app
npm run desktop

# 4. Frontend-only mode for UI work
# This does not provide vault or provider IPC.
npm run dev
```

On Windows, if your terminal cannot find `cargo`, run from a shell where Rust is on `PATH`, or use the included scripts. `npm run desktop` runs `scripts/run-desktop.mjs`, which prepends `%USERPROFILE%\.cargo\bin` when present.

---

## Build

```bash
# TypeScript + production frontend bundle
npm run build

# Native Tauri build
npm run desktop:build
```

If the global `npm` wrapper is broken on your machine, the underlying checks can be run directly:

```powershell
node node_modules\typescript\bin\tsc
node node_modules\vite\bin\vite.js build
cd src-tauri
cargo check
```

---

## Current Cloudflare Workflows

### Link Cloudflare

1. Create a Cloudflare API token.
2. Include only the permissions you need.
3. In Rotate, add Cloudflare from Explore.
4. Paste Account ID and the management token.
5. Rotate stores the token locally in secure storage.

### Rotate an Account API Token

1. Open the Cloudflare account in Rotate.
2. Pick a token from the API token list, or paste a token ID manually.
3. Rotate clones the token policies.
4. Cloudflare returns a new token secret once.
5. Copy the new secret and update the service that uses it.
6. Optionally revoke the old token.

### Rotate a Turnstile Secret

1. Make sure the management token has `Turnstile Sites Write` or `Account Settings Write`.
2. Open the Turnstile section.
3. Choose the widget.
4. Pick either:
   - rotate with a 2-hour grace period, or
   - rotate and invalidate the old secret immediately.
5. Copy the new secret and update the backend that calls Turnstile `/siteverify`.

Cloudflare does not show the new secret again after the rotation response.

---

## References

- [Tauri v2 documentation](https://v2.tauri.app/)
- [Cloudflare API v4](https://developers.cloudflare.com/api/)
- [Cloudflare Turnstile API](https://developers.cloudflare.com/api/resources/turnstile/)
- [Turnstile widget management API](https://developers.cloudflare.com/turnstile/get-started/widget-management/api/)

---

## License

MIT
