export type NavId = "home" | "explore" | "services";

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
};

export type SecurityStatusDto = {
  pinConfigured: boolean;
  unlocked: boolean;
  sessionSecondsRemaining: number | null;
};
