export type NavId = "home" | "explore" | "services" | "settings";

export type ProviderId = "cloudflare" | "supabase" | "oauth_google";

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

export type SecurityStatusDto = {
  pinConfigured: boolean;
  unlocked: boolean;
  sessionSecondsRemaining: number | null;
  /** Durata sessione configurata (secondi). */
  sessionTtlSeconds: number;
};
