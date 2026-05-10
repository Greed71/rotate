import type { SecretsStoreRow, SecretsStoreSecretRow } from "../../types";

type Props = {
  stores: SecretsStoreRow[];
  secrets: SecretsStoreSecretRow[];
  selectedStore: string;
  busy: boolean;
  secretsStoreBusy: boolean;
  onRefresh: () => void;
  onSelectStore: (storeId: string) => void;
  onUseSecret: (secret: SecretsStoreSecretRow) => void;
};

export function SecretsStoreSection({
  stores,
  secrets,
  selectedStore,
  busy,
  secretsStoreBusy,
  onRefresh,
  onSelectStore,
  onUseSecret,
}: Props) {
  return (
    <section className="space-y-3 rounded-2xl border border-surface-3/80 bg-surface-1/60 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">Secrets Store</h2>
          <p className="mt-1 text-xs text-ink-muted">
            Store account-level Cloudflare. I valori sono write-only: Rotate mostra nomi, stato e scope, non i secret.
          </p>
        </div>
        <button
          type="button"
          disabled={busy || secretsStoreBusy}
          onClick={onRefresh}
          className="rounded-lg border border-surface-3 px-3 py-1.5 text-sm text-ink hover:border-accent/40 disabled:opacity-50"
        >
          Aggiorna Store
        </button>
      </div>
      <div className="grid gap-3 lg:grid-cols-[minmax(240px,320px)_1fr]">
        <div className="space-y-2">
          <label className="text-xs font-semibold text-ink-muted" htmlFor="cf-secrets-store-select">
            Store
          </label>
          <select
            id="cf-secrets-store-select"
            value={selectedStore}
            onChange={(e) => onSelectStore(e.target.value)}
            className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 text-sm text-ink outline-none ring-accent/40 focus:ring-2"
          >
            {stores.length === 0 ? (
              <option value="">Nessuno store rilevato</option>
            ) : (
              stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))
            )}
          </select>
          <p className="text-xs text-ink-muted">
            Per creare o sostituire un secret serve Secrets Store Write.
          </p>
        </div>
        <div className="overflow-hidden rounded-xl border border-surface-3/80">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-2/80 text-[11px] uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Secret</th>
                <th className="px-4 py-3 font-semibold">Scope</th>
                <th className="px-4 py-3 font-semibold">Stato</th>
                <th className="px-4 py-3 font-semibold">Azione</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-3/60 bg-surface-1/40">
              {secrets.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-5 text-center text-ink-muted">
                    Nessun secret rilevato nello store selezionato.
                  </td>
                </tr>
              ) : (
                secrets.map((secret) => (
                  <tr key={secret.id} className="text-ink">
                    <td className="px-4 py-3">
                      <p className="font-mono text-xs">{secret.name}</p>
                      <p className="font-mono text-[10px] text-ink-muted">{secret.id}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-muted">
                      {secret.scopes.length ? secret.scopes.join(", ") : "-"}
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-muted">{secret.status || "-"}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => onUseSecret(secret)}
                        className="rounded-lg border border-surface-3 px-2.5 py-1 text-xs font-medium text-ink-muted hover:border-accent/40"
                      >
                        Usa per Turnstile
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
