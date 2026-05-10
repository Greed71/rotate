import type { TurnstileWidgetRow } from "../../types";

type Props = {
  widgets: TurnstileWidgetRow[];
  busy: boolean;
  busySitekey: string | null;
  onRefresh: () => void;
  onRotate: (widget: TurnstileWidgetRow) => void;
};

export function TurnstileSection({ widgets, busy, busySitekey, onRefresh, onRotate }: Props) {
  return (
    <section className="space-y-3 rounded-2xl border border-surface-3/80 bg-surface-1/60 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">Turnstile secret</h2>
          <p className="mt-1 text-xs text-ink-muted">
            Widget rilevati con il token di gestione. Per ruotare servono permessi Turnstile Sites Write o Account Settings Write.
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={onRefresh}
          className="rounded-lg border border-surface-3 px-3 py-1.5 text-sm text-ink hover:border-accent/40 disabled:opacity-50"
        >
          Aggiorna Turnstile
        </button>
      </div>
      <div className="overflow-hidden rounded-xl border border-surface-3/80">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-2/80 text-[11px] uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Nome</th>
              <th className="px-4 py-3 font-semibold">Domini</th>
              <th className="px-4 py-3 font-mono text-[10px] font-semibold">Sitekey</th>
              <th className="px-4 py-3 font-semibold">Azioni</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-3/60 bg-surface-1/40">
            {widgets.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-5 text-center text-ink-muted">
                  Nessun widget Turnstile rilevato. Controlla i permessi del token o crea un widget in Cloudflare.
                </td>
              </tr>
            ) : (
              widgets.map((widget) => (
                <tr key={widget.sitekey} className="text-ink">
                  <td className="px-4 py-3">
                    <p className="font-medium">{widget.name}</p>
                    <p className="text-xs text-ink-muted">{widget.mode}</p>
                  </td>
                  <td className="max-w-[320px] px-4 py-3 text-xs text-ink-muted">
                    {widget.domains.length ? widget.domains.join(", ") : "-"}
                  </td>
                  <td className="max-w-[180px] truncate px-4 py-3 font-mono text-[11px] text-ink-muted">
                    {widget.sitekey}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      disabled={busySitekey === widget.sitekey}
                      onClick={() => onRotate(widget)}
                      className="rounded-lg border border-accent/50 px-2.5 py-1 text-xs font-medium text-accent hover:bg-accent/10 disabled:opacity-50"
                    >
                      {busySitekey === widget.sitekey ? "Rotazione..." : "Ruota secret"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
