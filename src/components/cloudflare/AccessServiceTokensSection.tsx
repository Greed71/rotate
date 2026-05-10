import type { AccessServiceTokenRow } from "../../types";

type Props = {
  tokens: AccessServiceTokenRow[];
  busy: boolean;
  busyId: string | null;
  onRefresh: () => void;
  onRotate: (token: AccessServiceTokenRow) => void;
};

export function AccessServiceTokensSection({ tokens, busy, busyId, onRefresh, onRotate }: Props) {
  return (
    <section className="space-y-3 rounded-2xl border border-surface-3/80 bg-surface-1/60 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">Access Service Tokens</h2>
          <p className="mt-1 text-xs text-ink-muted">
            Token Zero Trust per servizi automatici. Rotate puo ruotare il Client Secret nativo di Cloudflare Access.
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={onRefresh}
          className="rounded-lg border border-surface-3 px-3 py-1.5 text-sm text-ink hover:border-accent/40 disabled:opacity-50"
        >
          Aggiorna Access
        </button>
      </div>
      <div className="overflow-hidden rounded-xl border border-surface-3/80">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-2/80 text-[11px] uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Nome</th>
              <th className="px-4 py-3 font-mono text-[10px] font-semibold">Client ID</th>
              <th className="px-4 py-3 font-semibold">Scadenza</th>
              <th className="px-4 py-3 font-semibold">Azioni</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-3/60 bg-surface-1/40">
            {tokens.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-5 text-center text-ink-muted">
                  Nessun Service Token Access rilevato. Controlla i permessi Zero Trust Access.
                </td>
              </tr>
            ) : (
              tokens.map((token) => (
                <tr key={token.id} className="text-ink">
                  <td className="px-4 py-3">
                    <p className="font-medium">{token.name}</p>
                    <p className="font-mono text-[11px] text-ink-muted">{token.id}</p>
                  </td>
                  <td className="max-w-[240px] truncate px-4 py-3 font-mono text-[11px] text-ink-muted">
                    {token.clientId || "-"}
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-muted">
                    {token.expiresAt ?? token.duration ?? "-"}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      disabled={busyId === token.id}
                      onClick={() => onRotate(token)}
                      className="rounded-lg border border-accent/50 px-2.5 py-1 text-xs font-medium text-accent hover:bg-accent/10 disabled:opacity-50"
                    >
                      {busyId === token.id ? "Rotazione..." : "Ruota secret"}
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
