import type { WorkerScriptRow, WorkerSecretRow } from "../../types";

type Props = {
  scripts: WorkerScriptRow[];
  secrets: WorkerSecretRow[];
  selectedWorker: string;
  busy: boolean;
  workerBusy: boolean;
  onRefresh: () => void;
  onSelectWorker: (worker: string) => void;
  onUseSecret: (secretName: string) => void;
};

export function WorkersSecretsSection({
  scripts,
  secrets,
  selectedWorker,
  busy,
  workerBusy,
  onRefresh,
  onSelectWorker,
  onUseSecret,
}: Props) {
  return (
    <section className="space-y-3 rounded-2xl border border-surface-3/80 bg-surface-1/60 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">Workers secrets</h2>
          <p className="mt-1 text-xs text-ink-muted">
            Script Workers raggiungibili dal token di gestione. Per aggiornare un binding servono permessi Workers Scripts Write.
          </p>
        </div>
        <button
          type="button"
          disabled={busy || workerBusy}
          onClick={onRefresh}
          className="rounded-lg border border-surface-3 px-3 py-1.5 text-sm text-ink hover:border-accent/40 disabled:opacity-50"
        >
          Aggiorna Workers
        </button>
      </div>
      <div className="grid gap-3 lg:grid-cols-[minmax(240px,320px)_1fr]">
        <div className="space-y-2">
          <label className="text-xs font-semibold text-ink-muted" htmlFor="cf-worker-select">
            Worker
          </label>
          <select
            id="cf-worker-select"
            value={selectedWorker}
            onChange={(e) => onSelectWorker(e.target.value)}
            className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 text-sm text-ink outline-none ring-accent/40 focus:ring-2"
          >
            {scripts.length === 0 ? (
              <option value="">Nessun Worker rilevato</option>
            ) : (
              scripts.map((worker) => (
                <option key={worker.id} value={worker.id}>
                  {worker.id}
                </option>
              ))
            )}
          </select>
          <p className="text-xs text-ink-muted">
            Cloudflare non restituisce il valore dei secret esistenti, solo i nomi dei binding.
          </p>
        </div>
        <div className="overflow-hidden rounded-xl border border-surface-3/80">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-2/80 text-[11px] uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Binding</th>
                <th className="px-4 py-3 font-semibold">Tipo</th>
                <th className="px-4 py-3 font-semibold">Azione</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-3/60 bg-surface-1/40">
              {secrets.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-5 text-center text-ink-muted">
                    Nessun secret Workers rilevato per questo script.
                  </td>
                </tr>
              ) : (
                secrets.map((secret) => (
                  <tr key={secret.name} className="text-ink">
                    <td className="px-4 py-3 font-mono text-xs">{secret.name}</td>
                    <td className="px-4 py-3 text-xs text-ink-muted">{secret.kind}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => onUseSecret(secret.name)}
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
