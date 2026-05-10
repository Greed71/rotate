export const DEPLOY_TARGETS = ["production", "preview", "development"] as const;

export type DeployTarget = (typeof DEPLOY_TARGETS)[number];

export type SecretSourceKind =
  | "cloudflare-turnstile-secret"
  | "cloudflare-access-client-secret"
  | "cloudflare-api-token";

export type SecretDestinationKind =
  | "cloudflare-worker-secret"
  | "cloudflare-pages-secret"
  | "cloudflare-secrets-store"
  | "vercel-env-var"
  | "supabase-edge-function-secret";

export type RotatedSecretSource = {
  provider: "cloudflare" | "vercel" | "supabase";
  kind: SecretSourceKind;
  externalId: string;
  label: string;
  value: string;
};

export type SecretDestinationDescriptor = {
  kind: SecretDestinationKind;
  provider: "cloudflare" | "vercel" | "supabase";
  label: string;
  description: string;
};

export const SECRET_DESTINATIONS: SecretDestinationDescriptor[] = [
  {
    kind: "cloudflare-worker-secret",
    provider: "cloudflare",
    label: "Cloudflare Workers secret",
    description: "Scrive il secret in un binding Workers.",
  },
  {
    kind: "cloudflare-pages-secret",
    provider: "cloudflare",
    label: "Cloudflare Pages secret",
    description: "Aggiorna un secret Pages per production o preview.",
  },
  {
    kind: "cloudflare-secrets-store",
    provider: "cloudflare",
    label: "Cloudflare Secrets Store",
    description: "Crea o aggiorna un secret account-level riusabile.",
  },
  {
    kind: "vercel-env-var",
    provider: "vercel",
    label: "Vercel environment variable",
    description: "Scrive il secret nei target deploy del progetto.",
  },
  {
    kind: "supabase-edge-function-secret",
    provider: "supabase",
    label: "Supabase Edge Function secret",
    description: "Scrive il secret nei secret delle Edge Functions Supabase.",
  },
];
