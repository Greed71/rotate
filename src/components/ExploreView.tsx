import type { AutomationLevel, Integration, ProviderId } from "../types";

type CatalogEntry = {
  id: ProviderId;
  name: string;
  blurb: string;
  automation: AutomationLevel;
  envHints: string[];
};

const catalog: CatalogEntry[] = [
  {
    id: "cloudflare",
    name: "Cloudflare",
    blurb: "API Token e permessi account. Adatto alla rigenerazione guidata.",
    automation: "full",
    envHints: ["CLOUDFLARE_API_TOKEN", "CF_ACCOUNT_ID"],
  },
  {
    id: "supabase",
    name: "Supabase",
    blurb: "Chiavi di progetto e segreti legati al tenant. Alcune operazioni via API.",
    automation: "partial",
    envHints: ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"],
  },
  {
    id: "oauth_google",
    name: "OAuth (Google)",
    blurb: "Client ID/secret OAuth. Spesso richiede passaggi in Google Cloud Console.",
    automation: "partial",
    envHints: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
  },
];

const automationCopy: Record<AutomationLevel, { label: string; className: string }> = {
  full: { label: "Automazione alta", className: "bg-emerald-500/15 text-emerald-300" },
  partial: {
    label: "Semi-automatico",
    className: "bg-amber-500/15 text-amber-200",
  },
  manual: { label: "Manuale", className: "bg-rose-500/15 text-rose-200" },
};

type Props = {
  integrations: Integration[];
  onAdd: (provider: ProviderId) => void | Promise<void>;
};

export function ExploreView({ integrations, onAdd }: Props) {
  const connected = new Set(integrations.map((i) => i.provider));

  return (
    <div className="flex flex-1 flex-col gap-8 overflow-auto px-10 py-10">
      <header className="max-w-3xl space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          Esplora
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-ink">
          Scegli cosa vuoi poter ruotare
        </h1>
        <p className="text-sm leading-relaxed text-ink-muted">
          Aggiungi solo i provider che usi. La rotazione sarà sempre{" "}
          <span className="text-ink">per singola risorsa</span>, mai globale.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {catalog.map((item) => {
          const isAdded = connected.has(item.id);
          const auto = automationCopy[item.automation];
          return (
            <article
              key={item.id}
              className="flex flex-col rounded-2xl border border-surface-3/80 bg-surface-1/80 p-5 shadow-[0_18px_60px_-40px_rgba(0,0,0,0.9)] backdrop-blur-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-ink">{item.name}</h2>
                  <span
                    className={`mt-2 inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${auto.className}`}
                  >
                    {auto.label}
                  </span>
                </div>
                {isAdded ? (
                  <span className="rounded-full bg-surface-3 px-2.5 py-1 text-[11px] font-medium text-ink-muted">
                    Aggiunto
                  </span>
                ) : null}
              </div>
              <p className="mt-4 text-sm leading-relaxed text-ink-muted">{item.blurb}</p>
              <div className="mt-4 space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                  Esempi .env
                </p>
                <ul className="flex flex-wrap gap-1.5">
                  {item.envHints.map((hint) => (
                    <li
                      key={hint}
                      className="rounded-md bg-surface-0 px-2 py-1 font-mono text-[11px] text-ink-muted"
                    >
                      {hint}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-6 flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={isAdded}
                  onClick={() => onAdd(item.id)}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-surface-0 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isAdded ? "Già nel pool" : "Aggiungi"}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
