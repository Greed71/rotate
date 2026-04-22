import type { Integration } from "../types";

const providerTitle: Record<Integration["provider"], string> = {
  cloudflare: "Cloudflare",
  supabase: "Supabase",
  oauth_google: "OAuth (Google)",
};

type Props = {
  integrations: Integration[];
  onGoExplore: () => void;
};

export function HomeView({ integrations, onGoExplore }: Props) {
  const isEmpty = integrations.length === 0;

  if (isEmpty) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-10 py-16 text-center">
        <div className="max-w-md space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            Benvenuto
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-ink">
            Inizia dal catalogo servizi
          </h1>
          <p className="text-sm leading-relaxed text-ink-muted">
            L’area centrale è volutamente vuota finché non aggiungi almeno un provider
            da <span className="text-ink">Esplora</span>. Così ognuno ha il proprio pool
            e tu ruoti solo ciò che scegli.
          </p>
        </div>
        <button
          type="button"
          onClick={onGoExplore}
          className="rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-surface-0 shadow-lg shadow-accent/10 transition hover:brightness-110"
        >
          Apri Esplora
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-8 overflow-auto px-10 py-10">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          Home
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-ink">
          I tuoi servizi collegati
        </h1>
        <p className="text-sm text-ink-muted">
          Seleziona un servizio per vedere le risorse ruotabili (in arrivo).
        </p>
      </header>
      <ul className="grid gap-3 md:grid-cols-2">
        {integrations.map((item) => (
          <li
            key={item.id}
            className="rounded-2xl border border-surface-3/80 bg-surface-1/80 px-5 py-4"
          >
            <p className="text-sm font-semibold text-ink">{item.label}</p>
            <p className="text-xs uppercase tracking-wide text-ink-muted">
              {providerTitle[item.provider]}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
