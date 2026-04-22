import type { Integration } from "../types";

const titles: Record<Integration["provider"], string> = {
  cloudflare: "Cloudflare",
  supabase: "Supabase",
  oauth_google: "OAuth (Google)",
};

type Props = {
  integration: Integration;
  onBack: () => void;
};

export function ServicePlaceholderDetail({ integration, onBack }: Props) {
  return (
    <div className="flex flex-1 flex-col gap-6 overflow-auto px-10 py-10">
      <header>
        <button
          type="button"
          onClick={onBack}
          className="mb-2 text-xs font-medium text-accent hover:underline"
        >
          ← Torna ai servizi
        </button>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          {titles[integration.provider]}
        </p>
        <h1 className="text-2xl font-semibold text-ink">{integration.label}</h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-muted">
          Stiamo integrando un servizio alla volta. Dopo Cloudflare arriveranno Supabase e OAuth
          (Google) con lo stesso schema: collegamento account, elenco risorse ruotabili, poi
          azioni di rotazione.
        </p>
      </header>
    </div>
  );
}
