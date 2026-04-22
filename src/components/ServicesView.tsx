import type { Integration } from "../types";

type Props = {
  integrations: Integration[];
  onGoExplore: () => void;
  onOpenIntegration: (integration: Integration) => void;
};

const providerTitle: Record<Integration["provider"], string> = {
  cloudflare: "Cloudflare",
  supabase: "Supabase",
  oauth_google: "OAuth (Google)",
};

export function ServicesView({ integrations, onGoExplore, onOpenIntegration }: Props) {
  if (integrations.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-10 text-center">
        <p className="max-w-md text-sm text-ink-muted">
          Non hai ancora collegato servizi. Aggiungili da Esplora per costruire il tuo
          pool personale.
        </p>
        <button
          type="button"
          onClick={onGoExplore}
          className="rounded-lg border border-surface-3 px-4 py-2 text-sm font-medium text-ink transition hover:border-accent/40 hover:text-accent"
        >
          Vai a Esplora
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-auto px-10 py-10">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          I miei servizi
        </p>
        <h1 className="text-2xl font-semibold text-ink">Pool personale</h1>
        <p className="text-sm text-ink-muted">
          Clicca una riga per aprire il dettaglio del servizio (Cloudflare è il primo
          supportato).
        </p>
      </header>
      <div className="overflow-hidden rounded-2xl border border-surface-3/80">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-2/80 text-[11px] uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Servizio</th>
              <th className="px-4 py-3 font-semibold">Etichetta</th>
              <th className="px-4 py-3 font-semibold">Aggiunto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-3/60 bg-surface-1/40">
            {integrations.map((row) => (
              <tr
                key={row.id}
                className="cursor-pointer text-ink transition hover:bg-surface-2/50"
                onClick={() => onOpenIntegration(row)}
              >
                <td className="px-4 py-3 font-medium">{providerTitle[row.provider]}</td>
                <td className="px-4 py-3 text-ink-muted">{row.label}</td>
                <td className="px-4 py-3 text-ink-muted">
                  {new Date(row.createdAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
