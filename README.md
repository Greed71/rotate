# Rotate

![Node.js](https://img.shields.io/badge/Node.js-LTS-brightgreen)
![Rust](https://img.shields.io/badge/Rust-stable-orange)
![Tauri](https://img.shields.io/badge/Tauri-2-24C8DB)
![License](https://img.shields.io/badge/license-MIT-blue)

Rotate is a **local-first desktop app** built with **Tauri 2**, **React 19**, and **Rust** for managing provider credentials and rotating API secrets from one vault.

The current focus is Cloudflare plus deployment destinations: link management tokens, rotate Cloudflare secrets, and push rotated Turnstile secrets into Cloudflare Workers, Pages, Secrets Store, Vercel project environment variables, or Supabase Edge Function secrets.

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
- **Access Service Token rotation**: list Cloudflare Zero Trust Access Service Tokens and rotate their `client_secret` with immediate invalidation or a 2-hour grace period.
- **Workers secret updates**: list Workers scripts, inspect secret binding names, and write a newly rotated Turnstile secret into a selected Workers secret binding.
- **Pages secret updates**: list Cloudflare Pages projects, inspect production/preview environment variable names, and write a newly rotated Turnstile secret as an encrypted Pages secret.
- **Secrets Store updates**: list account-level Secrets Store stores and secret metadata, then create or replace a secret value from a rotation result.
- **Vercel environment updates**: connect a Vercel Access Token, list projects, inspect environment variable names, and upsert an encrypted environment variable after a Turnstile rotation.
- **Supabase API key rotation**: connect a Supabase Personal Access Token, list project API keys, create a Supabase-generated replacement key, show it once, and optionally delete the old key.
- **Supabase Edge Function secrets**: list project secret names and bulk-update selected Edge Function secrets with a value produced by another rotation flow.
- **Resend API key rotation**: connect a Resend management API key, list API keys, create a replacement key, show it once, and optionally delete the old key.
- **Google OAuth assisted rotation**: store a Google OAuth Client ID and client secret locally, replace the secret generated from Google Cloud Console, and push it to deployment env vars.
- **Clipboard safety**: sensitive values copied from the app are auto-cleared where supported.

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
| List Access Service Tokens | Zero Trust Access Service Tokens read access |
| Rotate Access Service Tokens | Zero Trust Access Service Tokens write access |
| List Workers scripts and secret binding names | `Account - Workers Scripts - Read` |
| Update a Workers secret binding | `Account - Workers Scripts - Edit` |
| List Pages projects and env names | `Account - Pages - Read` |
| Update Pages secrets | `Account - Pages - Edit` |
| List Secrets Store stores/secrets | Secrets Store read access |
| Create or update Secrets Store secrets | `Secrets Store Write` |

If Turnstile widgets are visible but rotation returns `Authentication error (Cloudflare code 10000)`, the token can read the widget but cannot write/rotate it. Reconnect Cloudflare in Rotate with a token that includes `Turnstile Sites Write` or `Account Settings Write`.

If Workers are visible but updating a binding fails, reconnect Cloudflare with `Workers Scripts Write`. Cloudflare does not return existing Workers secret values, so Rotate shows binding names only.

Access Service Tokens consist of a Client ID and Client Secret. Cloudflare shows the new Client Secret only in the rotation response, so Rotate displays it once and does not store it locally.

Pages and Secrets Store values are write-only from Rotate's point of view. The app can show names and metadata, then write a new secret value, but it cannot recover an existing secret value from Cloudflare.

---

## Security Model

Rotate is local-first. There is no backend service and no cloud sync.

| Asset | Storage |
| --- | --- |
| Vault password | Never stored directly; salted Argon2id PHC hash in SQLite (`vault_settings`) |
| Unlock session | RAM only; expires automatically |
| Cloudflare management token | OS credential store when reliable; otherwise DPAPI-encrypted local file on Windows |
| Rotated one-time secrets | Shown once in the UI; not silently written to `.env` files |
| Workers destination updates | Sent directly to Cloudflare Workers; the secret value is not stored locally |
| Vercel destination updates | Sent directly to Vercel project environment variables; the secret value is not stored locally |
| Supabase destination updates | Sent directly to Supabase Edge Function secrets; the secret value is not stored locally |
| Supabase database password | Generated locally for the rotation request, shown once as password and direct `DATABASE_URL`, never stored locally |
| Resend management token | OS credential store when reliable; otherwise DPAPI-encrypted local file on Windows |
| Google OAuth client secret | OS credential store when reliable; otherwise DPAPI-encrypted local file on Windows |
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
│   ├── components/            Views, vault screens, provider details
│   ├── components/provider/   Shared provider UI shell components
│   ├── locales/               Italian and English UI strings
│   ├── secretDestinations.ts  Source/destination model for rotated secrets
│   └── types.ts               IPC DTO types
├── src-tauri/
│   ├── src/
│   │   ├── lib.rs             Tauri commands and IPC registration
│   │   ├── db.rs              SQLite migrations and metadata
│   │   ├── security.rs        Vault password hashing, unlock TTL, auth throttling
│   │   ├── secrets.rs         Provider token store adapter over Credential Manager/DPAPI
│   │   ├── cf_api.rs          Cloudflare API v4 client
│   │   └── vercel_api.rs      Vercel API client
│   ├── capabilities/          IPC permission allow-list
│   └── tauri.conf.json        Tauri app config
├── scripts/                   Desktop launch/build helpers
└── package.json
```

### Provider Pattern

Provider screens share a small UI shell:

- `ProviderHeader` renders the service title, intro, and back action.
- `CredentialGuide` explains where to get credentials and links to official docs.
- `ProviderLoadingPanel`, `AlertMessage`, and `LinkedAccountBar` keep loading, errors, and linked-account actions consistent.
- `DeployTargetsPicker` centralizes the deployment target selector used by Vercel-style destinations.

Provider credentials go through `src-tauri/src/secrets.rs`. The `ProviderToken` adapter keeps provider IDs and labels in one place while preserving the Cloudflare legacy credential migration path.

### Secret Source and Destination Pattern

Rotate treats a rotation as two separate steps:

1. A source produces a one-time secret, such as a Cloudflare Turnstile secret or Access Client Secret.
2. One or more destinations receive that value, such as Cloudflare Workers, Pages, Secrets Store, Vercel environment variables, and Supabase Edge Function secrets.

The frontend model lives in `src/secretDestinations.ts`. This keeps new providers from becoming hard-coded special cases inside an existing rotation flow.

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

### Rotate an Access Service Token

1. Make sure the management token has Zero Trust Access Service Tokens read/write permissions.
2. Open the Access Service Tokens section.
3. Pick the service token.
4. Choose either:
   - rotate with a 2-hour grace period, or
   - rotate and invalidate the previous Client Secret immediately.
5. Copy the new Client Secret and update the service that sends `CF-Access-Client-Secret`.

Cloudflare Access keeps the Client ID stable and returns a new Client Secret. Rotate does not persist that Client Secret.

### Push a Turnstile Secret to a Worker

1. Make sure the management token has `Workers Scripts Read` and `Workers Scripts Write`.
2. Rotate a Turnstile widget secret.
3. In the result modal, choose the Worker script.
4. Choose an existing secret binding name or type a new one, for example `TURNSTILE_SECRET_KEY`.
5. Click **Write to Worker**.

Rotate sends the new value to the Cloudflare Workers secret API. It does not store that value in SQLite or in the local provider metadata.

### Push a Turnstile Secret to Pages

1. Make sure the management token has Pages read/write permissions.
2. Rotate a Turnstile widget secret.
3. In the result modal, choose a Pages project and environment (`production` or `preview`).
4. Choose an existing environment variable name or type a new one.
5. Click **Write to Pages**.

Rotate writes the value as a `secret_text` environment variable. Pages applies environment changes to subsequent builds/deployments.

### Push a Turnstile Secret to Secrets Store

1. Make sure the management token can list Secrets Store metadata and has `Secrets Store Write`.
2. Rotate a Turnstile widget secret.
3. In the result modal, choose a store.
4. Choose an existing secret or type a new name.
5. Set scopes such as `workers` or `workers, access`.
6. Click **Write to Store**.

Cloudflare Secrets Store never returns the secret value after write. Rotate stores no copy locally.

### Push a Turnstile Secret to Vercel

1. Add Vercel from Explore.
2. Create a Vercel Access Token in Vercel account settings.
3. Paste the token into Rotate. If the project belongs to a team, also add the Team ID.
4. Rotate a Turnstile widget secret from the Cloudflare detail view.
5. In the result modal, choose the Vercel project, env key, and targets (`production`, `preview`, `development`).
6. Click **Write to Vercel**.

Rotate calls Vercel's environment variable API with `upsert=true` and stores no copy of the rotated secret. Vercel applies the value to future deployments/builds.

### Rotate a Resend API Key

1. Add Resend from Explore.
2. Create or copy a Resend API key with enough permission to list, create, and delete API keys.
3. Paste it into Rotate as the local management key.
4. Open the Resend detail view.
5. Pick an existing API key and click **Rotate**, or create a new key.
6. Rotate asks Resend for a new key, shows the token once, and can write it to Vercel as `RESEND_API_KEY`.
7. Delete the old key only after the new value is deployed everywhere.

Resend does not expose an existing API key value after creation. Rotate shows only the newly created value returned by Resend.

### Manage a Google OAuth Client Secret

Google OAuth client secret rotation is assisted rather than fully automatic.

1. Add OAuth (Google) from Explore.
2. Open Google Auth Platform Clients and select the OAuth client.
3. Use **Add Secret** in Google Cloud Console to generate a new client secret.
4. Paste the Client ID and new Client Secret into Rotate.
5. Write the new value to Vercel as `GOOGLE_CLIENT_SECRET`, or copy it for another destination.
6. After the new deployment is working, disable and delete the old secret in Google Cloud Console.

Rotate stores the Client ID as metadata and the Client Secret in local secure storage. It does not create Google OAuth secrets itself because Google exposes that flow primarily through Google Cloud Console.

### Rotate a Supabase API Key

1. Add Supabase from Explore.
2. Create a Supabase Personal Access Token from the account token page.
3. Paste the token into Rotate. It must be able to read projects and read/write API keys.
4. Open the Supabase detail view and choose the project.
5. Pick an API key and click **Rotate**.
6. Supabase creates the new key value; Rotate displays it once.
7. Optionally write the new key directly into Vercel, defaulting to `SUPABASE_SERVICE_ROLE_KEY`.
8. Optionally delete the old key immediately, or keep it while you update downstream services.

Rotate does not generate Supabase API key values locally.

### Rotate the Supabase Database Password

1. Add Supabase from Explore and connect a Personal Access Token with database write permission.
2. Open the Supabase detail view and choose the project.
3. In the database password section, type the project ref to confirm the destructive action.
4. Rotate generates a strong random database password and sends it to Supabase Management API.
5. Rotate shows the new password and lets you build the `DATABASE_URL` as:
   - direct connection: `postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres`
   - transaction pooler: `postgresql://postgres.<project-ref>:<password>@<pooler-host>:6543/postgres`
   - session pooler: `postgresql://postgres.<project-ref>:<password>@<pooler-host>:5432/postgres`
6. Optionally write the selected URL directly into Vercel environment variables.
7. Update every external backend, pool, deploy target, and secret store that uses the old `DATABASE_URL`.

Supabase updates its managed services automatically, but hardcoded external database connections must be updated by you. Rotate does not persist the new password or URL.

### Push a Turnstile Secret to Supabase Edge Functions

1. Add Supabase from Explore.
2. Create a Supabase Personal Access Token from the account token page.
3. Paste the token into Rotate. The token must be able to read projects and read/write Edge Function secrets.
4. Rotate a Turnstile widget secret from the Cloudflare detail view.
5. In the result modal, choose the Supabase project and one or more secret names, for example `TURNSTILE_SECRET_KEY`.
6. Click **Write to Supabase**.

Rotate calls Supabase Management API `POST /v1/projects/{ref}/secrets` and stores no copy of the rotated secret. Supabase makes updated secrets available to Edge Functions immediately. Secret names cannot start with `SUPABASE_`.

Supabase Edge Function secrets are environment variables: Supabase stores values supplied by the caller. They are not generated by Supabase. For Supabase-generated values, use the API key rotation flow above.

---

## References

- [Tauri v2 documentation](https://v2.tauri.app/)
- [Cloudflare API v4](https://developers.cloudflare.com/api/)
- [Cloudflare Turnstile API](https://developers.cloudflare.com/api/resources/turnstile/)
- [Turnstile widget management API](https://developers.cloudflare.com/turnstile/get-started/widget-management/api/)
- [Cloudflare Access Service Tokens API](https://developers.cloudflare.com/api/resources/zero_trust/subresources/access/subresources/service_tokens/)
- [Cloudflare Workers scripts API](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/)
- [Cloudflare Workers secrets API](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/secrets/)
- [Cloudflare Pages projects API](https://developers.cloudflare.com/api/resources/pages/subresources/projects/)
- [Cloudflare Secrets Store API](https://developers.cloudflare.com/api/resources/secrets_store/)
- [Vercel REST API](https://vercel.com/docs/rest-api)
- [Vercel project environment variables API](https://vercel.com/docs/rest-api/reference/endpoints/projects/create-one-or-more-environment-variables)
- [Supabase Management API](https://supabase.com/docs/reference/api/introduction)
- [Supabase Edge Function secrets](https://supabase.com/docs/guides/functions/secrets)

---

## License

MIT
