export type NavId = "home" | "explore" | "services" | "settings";

export type ProviderId = "cloudflare" | "vercel" | "supabase" | "resend" | "oauth_google";

export type AutomationLevel = "full" | "partial" | "manual";

export type Integration = {
  id: string;
  provider: ProviderId;
  label: string;
  createdAt: number;
};

/** Risposta IPC da Rust (`serde` camelCase). */
export type IntegrationDto = {
  id: string;
  provider: string;
  label: string;
  createdAt: number;
};

export function integrationFromDto(row: IntegrationDto): Integration {
  return {
    id: row.id,
    provider: row.provider as ProviderId,
    label: row.label,
    createdAt: row.createdAt,
  };
}

export type CloudflareStatusDto = {
  linked: boolean;
  accountId: string | null;
};

export type VercelStatusDto = {
  linked: boolean;
  userEmail: string | null;
  teamId: string | null;
};

export type VercelProjectRow = {
  id: string;
  name: string;
  framework: string | null;
  updatedAt: number | null;
  envKeys: string[];
};

export type VercelEnvVarRow = {
  id: string;
  key: string;
  kind: string;
  targets: string[];
  updatedAt: number | null;
};

export type VercelEnvUpsertResult = {
  key: string;
  projectId: string;
  projectName: string;
  targets: string[];
  kind: string;
};

export type SupabaseStatusDto = {
  linked: boolean;
};

export type SupabaseProjectRow = {
  id: string;
  reference: string;
  name: string;
  organizationId: string | null;
  organizationSlug: string | null;
  region: string | null;
  status: string | null;
  createdAt: string | null;
};

export type SupabaseSecretRow = {
  name: string;
  updatedAt: string | null;
};

export type SupabaseSecretUpsertResult = {
  projectRef: string;
  projectName: string;
  name: string;
};

export type SupabaseApiKeyRow = {
  id: string;
  keyType: string;
  prefix: string | null;
  name: string;
  description: string | null;
  insertedAt: string | null;
  updatedAt: string | null;
};

export type SupabaseApiKeyRotateResult = {
  oldKeyId: string;
  newKeyId: string;
  keyType: string;
  name: string;
  apiKey: string;
  deletedOld: boolean;
};

export type SupabaseDatabasePasswordRotateResult = {
  projectRef: string;
  password: string;
};

export type ResendStatusDto = {
  linked: boolean;
};

export type ResendApiKeyRow = {
  id: string;
  name: string;
  createdAt: string | null;
  lastUsedAt: string | null;
};

export type ResendRotateResult = {
  oldKeyId: string | null;
  newKeyId: string;
  name: string;
  token: string;
  deletedOld: boolean;
};

export type OauthGoogleStatusDto = {
  linked: boolean;
  clientId: string | null;
  label: string | null;
};

export type SecretStorageDiagnosticsDto = {
  service: string;
  credentialUser: string;
  credentialTarget: string;
  probeUser: string;
  probeTarget: string;
  entryNew: string;
  setPassword: string;
  getPassword: string;
  deleteCredential: string;
  dpapiRoundtrip: string;
  ok: boolean;
};

export type CfTokenRow = {
  id: string;
  name: string;
  status: string;
  expiresOn: string | null;
};

export type CloudflareRotateResultDto = {
  newTokenId: string;
  newTokenSecret: string;
  oldTokenId: string;
  revokedOld: boolean;
  updatedVaultSecret: boolean;
  trackedSecretUpdated: boolean;
};

export type ManagedSecretDto = {
  id: string;
  integrationId: string;
  provider: ProviderId;
  externalId: string;
  label: string;
  environment: string;
  secretKind: string;
  createdAt: number;
  lastRotatedAt: number | null;
};

export type TurnstileWidgetRow = {
  sitekey: string;
  name: string;
  mode: string;
  domains: string[];
  modifiedOn: string | null;
};

export type TurnstileRotateResult = {
  sitekey: string;
  name: string;
  secret: string;
};

export type WorkerScriptRow = {
  id: string;
  createdOn: string | null;
  modifiedOn: string | null;
};

export type WorkerSecretRow = {
  name: string;
  kind: string;
};

export type AccessServiceTokenRow = {
  id: string;
  name: string;
  clientId: string;
  duration: string | null;
  expiresAt: string | null;
};

export type AccessServiceTokenRotateResult = {
  id: string;
  name: string;
  clientId: string;
  clientSecret: string;
  duration: string | null;
};

export type PagesEnvVarRow = {
  name: string;
  kind: string;
};

export type PagesProjectRow = {
  id: string;
  name: string;
  productionBranch: string | null;
  productionEnvVars: PagesEnvVarRow[];
  previewEnvVars: PagesEnvVarRow[];
};

export type SecretsStoreRow = {
  id: string;
  name: string;
  created: string | null;
  modified: string | null;
};

export type SecretsStoreSecretRow = {
  id: string;
  name: string;
  status: string;
  storeId: string;
  comment: string | null;
  scopes: string[];
};

export type SecurityStatusDto = {
  pinConfigured: boolean;
  unlocked: boolean;
  sessionSecondsRemaining: number | null;
  /** Durata sessione configurata (secondi). */
  sessionTtlSeconds: number;
};
