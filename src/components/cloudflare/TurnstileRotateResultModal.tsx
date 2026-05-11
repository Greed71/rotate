import type { DeployTarget } from "../../secretDestinations";
import type {
  PagesProjectRow,
  SecretsStoreRow,
  SupabaseProjectRow,
  SupabaseSecretRow,
  TurnstileRotateResult,
  VercelProjectRow,
  WorkerScriptRow,
  WorkerSecretRow,
} from "../../types";
import { DeployTargetsPicker } from "../provider/DeployTargetsPicker";

type Props = {
  result: TurnstileRotateResult;
  copyHint: string | null;
  onCopy: () => void;
  onClose: () => void;
  workerScripts: WorkerScriptRow[];
  workerSecrets: WorkerSecretRow[];
  selectedWorker: string;
  workerSecretName: string;
  workerBusy: boolean;
  workerUpdateHint: string | null;
  onWorkerChange: (value: string) => void;
  onWorkerSecretNameChange: (value: string) => void;
  onWriteWorker: () => void;
  pagesProjects: PagesProjectRow[];
  selectedPagesProject: string;
  pagesEnvironment: "production" | "preview";
  pagesSecretName: string;
  pagesBusy: boolean;
  pagesUpdateHint: string | null;
  onPagesProjectChange: (value: string) => void;
  onPagesEnvironmentChange: (value: "production" | "preview") => void;
  onPagesSecretNameChange: (value: string) => void;
  onWritePages: () => void;
  secretsStores: SecretsStoreRow[];
  selectedSecretsStore: string;
  secretsStoreSecretName: string;
  secretsStoreScopes: string;
  secretsStoreBusy: boolean;
  secretsStoreUpdateHint: string | null;
  onSecretsStoreChange: (value: string) => void;
  onSecretsStoreSecretNameChange: (value: string) => void;
  onSecretsStoreScopesChange: (value: string) => void;
  onWriteSecretsStore: () => void;
  hasVercelIntegration: boolean;
  vercelProjects: VercelProjectRow[];
  selectedVercelProjectId: string;
  vercelEnvKey: string;
  vercelTargets: string[];
  vercelBusy: boolean;
  vercelUpdateHint: string | null;
  onRefreshVercelProjects: () => void;
  onVercelProjectChange: (value: string) => void;
  onVercelEnvKeyChange: (value: string) => void;
  onToggleVercelTarget: (target: DeployTarget) => void;
  onWriteVercel: () => void;
  hasSupabaseIntegration: boolean;
  supabaseProjects: SupabaseProjectRow[];
  supabaseSecrets: SupabaseSecretRow[];
  selectedSupabaseProjectRef: string;
  supabaseSecretName: string;
  selectedSupabaseSecretNames: string[];
  supabaseBusy: boolean;
  supabaseUpdateHint: string | null;
  onRefreshSupabaseProjects: () => void;
  onSupabaseProjectChange: (value: string) => void;
  onSupabaseSecretNameChange: (value: string) => void;
  onToggleSupabaseSecretName: (value: string) => void;
  onWriteSupabase: () => void;
};

export function TurnstileRotateResultModal({
  result,
  copyHint,
  onCopy,
  onClose,
  workerScripts,
  workerSecrets,
  selectedWorker,
  workerSecretName,
  workerBusy,
  workerUpdateHint,
  onWorkerChange,
  onWorkerSecretNameChange,
  onWriteWorker,
  pagesProjects,
  selectedPagesProject,
  pagesEnvironment,
  pagesSecretName,
  pagesBusy,
  pagesUpdateHint,
  onPagesProjectChange,
  onPagesEnvironmentChange,
  onPagesSecretNameChange,
  onWritePages,
  secretsStores,
  selectedSecretsStore,
  secretsStoreSecretName,
  secretsStoreScopes,
  secretsStoreBusy,
  secretsStoreUpdateHint,
  onSecretsStoreChange,
  onSecretsStoreSecretNameChange,
  onSecretsStoreScopesChange,
  onWriteSecretsStore,
  hasVercelIntegration,
  vercelProjects,
  selectedVercelProjectId,
  vercelEnvKey,
  vercelTargets,
  vercelBusy,
  vercelUpdateHint,
  onRefreshVercelProjects,
  onVercelProjectChange,
  onVercelEnvKeyChange,
  onToggleVercelTarget,
  onWriteVercel,
  hasSupabaseIntegration,
  supabaseProjects,
  supabaseSecrets,
  selectedSupabaseProjectRef,
  supabaseSecretName,
  selectedSupabaseSecretNames,
  supabaseBusy,
  supabaseUpdateHint,
  onRefreshSupabaseProjects,
  onSupabaseProjectChange,
  onSupabaseSecretNameChange,
  onToggleSupabaseSecretName,
  onWriteSupabase,
}: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="max-h-[88vh] w-full max-w-2xl overflow-auto rounded-2xl border border-amber-500/30 bg-surface-1 p-6 shadow-2xl">
        <h3 className="text-sm font-semibold text-amber-100">Nuovo secret Turnstile</h3>
        <p className="mt-1 text-xs text-ink-muted">
          Aggiorna subito il backend che usa questo widget. Cloudflare mostra questo secret solo ora.
        </p>
        <p className="mt-2 text-sm text-ink">{result.name}</p>
        <p className="font-mono text-[11px] text-ink-muted">Sitekey: {result.sitekey}</p>
        <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-surface-0 p-3 font-mono text-xs text-ink">
          {result.secret}
        </pre>
        {copyHint ? <p className="mt-2 text-xs text-accent">{copyHint}</p> : null}

        <div className="mt-4 rounded-xl border border-surface-3/80 bg-surface-0/50 p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Aggiorna Worker secret
          </h4>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5 text-xs font-semibold text-ink-muted">
              <span>Worker</span>
              <select
                value={selectedWorker}
                onChange={(event) => onWorkerChange(event.target.value)}
                className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 text-sm font-normal text-ink outline-none ring-accent/40 focus:ring-2"
              >
                {workerScripts.length === 0 ? (
                  <option value="">Nessun Worker rilevato</option>
                ) : (
                  workerScripts.map((worker) => (
                    <option key={worker.id} value={worker.id}>
                      {worker.id}
                    </option>
                  ))
                )}
              </select>
            </label>
            <label className="space-y-1.5 text-xs font-semibold text-ink-muted">
              <span>Binding secret</span>
              <input
                value={workerSecretName}
                onChange={(event) => onWorkerSecretNameChange(event.target.value)}
                className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 font-mono text-sm font-normal text-ink outline-none ring-accent/40 focus:ring-2"
                placeholder="TURNSTILE_SECRET_KEY"
                list="cf-worker-secret-options"
                autoComplete="off"
              />
              <datalist id="cf-worker-secret-options">
                {workerSecrets.map((secret) => (
                  <option key={secret.name} value={secret.name} />
                ))}
              </datalist>
            </label>
          </div>
          {workerUpdateHint ? <p className="mt-2 text-xs text-accent">{workerUpdateHint}</p> : null}
          <p className="mt-2 text-xs text-ink-muted">
            Il valore viene scritto su Cloudflare Workers e non viene salvato nel database locale.
          </p>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              disabled={workerBusy || !selectedWorker.trim() || !workerSecretName.trim()}
              onClick={onWriteWorker}
              className="rounded-lg border border-accent/50 px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent/10 disabled:opacity-50"
            >
              {workerBusy ? "Aggiornamento..." : "Scrivi nel Worker"}
            </button>
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-surface-3/80 bg-surface-0/50 p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Aggiorna Pages secret
          </h4>
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_130px]">
            <label className="space-y-1.5 text-xs font-semibold text-ink-muted">
              <span>Progetto</span>
              <select
                value={selectedPagesProject}
                onChange={(event) => onPagesProjectChange(event.target.value)}
                className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 text-sm font-normal text-ink outline-none ring-accent/40 focus:ring-2"
              >
                {pagesProjects.length === 0 ? (
                  <option value="">Nessun progetto Pages</option>
                ) : (
                  pagesProjects.map((project) => (
                    <option key={project.name} value={project.name}>
                      {project.name}
                    </option>
                  ))
                )}
              </select>
            </label>
            <label className="space-y-1.5 text-xs font-semibold text-ink-muted">
              <span>Ambiente</span>
              <select
                value={pagesEnvironment}
                onChange={(event) =>
                  onPagesEnvironmentChange(event.target.value as "production" | "preview")
                }
                className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 text-sm font-normal text-ink outline-none ring-accent/40 focus:ring-2"
              >
                <option value="production">production</option>
                <option value="preview">preview</option>
              </select>
            </label>
          </div>
          <label className="mt-3 block space-y-1.5 text-xs font-semibold text-ink-muted">
            <span>Nome secret</span>
            <input
              value={pagesSecretName}
              onChange={(event) => onPagesSecretNameChange(event.target.value)}
              className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 font-mono text-sm font-normal text-ink outline-none ring-accent/40 focus:ring-2"
              placeholder="TURNSTILE_SECRET_KEY"
              autoComplete="off"
            />
          </label>
          {pagesUpdateHint ? <p className="mt-2 text-xs text-accent">{pagesUpdateHint}</p> : null}
          <p className="mt-2 text-xs text-ink-muted">
            Pages usa questo valore nei nuovi deploy/build successivi.
          </p>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              disabled={pagesBusy || !selectedPagesProject.trim() || !pagesSecretName.trim()}
              onClick={onWritePages}
              className="rounded-lg border border-accent/50 px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent/10 disabled:opacity-50"
            >
              {pagesBusy ? "Aggiornamento..." : "Scrivi in Pages"}
            </button>
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-surface-3/80 bg-surface-0/50 p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Aggiorna Secrets Store
          </h4>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5 text-xs font-semibold text-ink-muted">
              <span>Store</span>
              <select
                value={selectedSecretsStore}
                onChange={(event) => onSecretsStoreChange(event.target.value)}
                className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 text-sm font-normal text-ink outline-none ring-accent/40 focus:ring-2"
              >
                {secretsStores.length === 0 ? (
                  <option value="">Nessuno store</option>
                ) : (
                  secretsStores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.name}
                    </option>
                  ))
                )}
              </select>
            </label>
            <label className="space-y-1.5 text-xs font-semibold text-ink-muted">
              <span>Secret</span>
              <input
                value={secretsStoreSecretName}
                onChange={(event) => onSecretsStoreSecretNameChange(event.target.value)}
                className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 font-mono text-sm font-normal text-ink outline-none ring-accent/40 focus:ring-2"
                placeholder="TURNSTILE_SECRET_KEY"
                autoComplete="off"
              />
            </label>
          </div>
          <label className="mt-3 block space-y-1.5 text-xs font-semibold text-ink-muted">
            <span>Scope</span>
            <input
              value={secretsStoreScopes}
              onChange={(event) => onSecretsStoreScopesChange(event.target.value)}
              className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 font-mono text-sm font-normal text-ink outline-none ring-accent/40 focus:ring-2"
              placeholder="workers, access"
              autoComplete="off"
            />
          </label>
          {secretsStoreUpdateHint ? (
            <p className="mt-2 text-xs text-accent">{secretsStoreUpdateHint}</p>
          ) : null}
          <p className="mt-2 text-xs text-ink-muted">
            Se non selezioni un secret esistente, Rotate ne crea uno nuovo nello store scelto.
          </p>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              disabled={
                secretsStoreBusy ||
                !selectedSecretsStore.trim() ||
                !secretsStoreSecretName.trim()
              }
              onClick={onWriteSecretsStore}
              className="rounded-lg border border-accent/50 px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent/10 disabled:opacity-50"
            >
              {secretsStoreBusy ? "Aggiornamento..." : "Scrivi nello Store"}
            </button>
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-surface-3/80 bg-surface-0/50 p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Aggiorna Vercel env
          </h4>
          {hasVercelIntegration ? (
            <>
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="text-xs text-ink-muted">
                  Usa il Vercel collegato per aggiornare una env var con il nuovo secret.
                </p>
                <button
                  type="button"
                  disabled={vercelBusy}
                  onClick={onRefreshVercelProjects}
                  className="rounded-lg border border-surface-3 px-2.5 py-1 text-xs font-medium text-ink-muted hover:border-accent/40 disabled:opacity-50"
                >
                  Aggiorna progetti
                </button>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="space-y-1.5 text-xs font-semibold text-ink-muted">
                  <span>Progetto</span>
                  <select
                    value={selectedVercelProjectId}
                    onChange={(event) => onVercelProjectChange(event.target.value)}
                    className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 text-sm font-normal text-ink outline-none ring-accent/40 focus:ring-2"
                  >
                    {vercelProjects.length === 0 ? (
                      <option value="">Nessun progetto Vercel</option>
                    ) : (
                      vercelProjects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))
                    )}
                  </select>
                </label>
                <label className="space-y-1.5 text-xs font-semibold text-ink-muted">
                  <span>Env key</span>
                  <input
                    value={vercelEnvKey}
                    onChange={(event) => onVercelEnvKeyChange(event.target.value)}
                    className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 font-mono text-sm font-normal text-ink outline-none ring-accent/40 focus:ring-2"
                    placeholder="TURNSTILE_SECRET_KEY"
                    autoComplete="off"
                  />
                </label>
              </div>
              <div className="mt-3">
                <DeployTargetsPicker selected={vercelTargets} onToggle={onToggleVercelTarget} />
              </div>
              {vercelUpdateHint ? <p className="mt-2 text-xs text-accent">{vercelUpdateHint}</p> : null}
              <p className="mt-2 text-xs text-ink-muted">
                Vercel applica la variabile ai nuovi deploy successivi.
              </p>
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  disabled={
                    vercelBusy ||
                    !selectedVercelProjectId ||
                    !vercelEnvKey.trim() ||
                    vercelTargets.length === 0
                  }
                  onClick={onWriteVercel}
                  className="rounded-lg border border-accent/50 px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent/10 disabled:opacity-50"
                >
                  {vercelBusy ? "Aggiornamento..." : "Scrivi in Vercel"}
                </button>
              </div>
            </>
          ) : (
            <p className="mt-2 text-xs text-ink-muted">
              Aggiungi e collega Vercel da Esplora per scrivere questo secret nei progetti Vercel.
            </p>
          )}
        </div>

        <div className="mt-3 rounded-xl border border-surface-3/80 bg-surface-0/50 p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Aggiorna Supabase secret
          </h4>
          {hasSupabaseIntegration ? (
            <>
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="text-xs text-ink-muted">
                  Scrive il nuovo valore nei secret delle Edge Functions Supabase.
                </p>
                <button
                  type="button"
                  disabled={supabaseBusy}
                  onClick={onRefreshSupabaseProjects}
                  className="rounded-lg border border-surface-3 px-2.5 py-1 text-xs font-medium text-ink-muted hover:border-accent/40 disabled:opacity-50"
                >
                  Aggiorna progetti
                </button>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="space-y-1.5 text-xs font-semibold text-ink-muted">
                  <span>Progetto</span>
                  <select
                    value={selectedSupabaseProjectRef}
                    onChange={(event) => onSupabaseProjectChange(event.target.value)}
                    className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 text-sm font-normal text-ink outline-none ring-accent/40 focus:ring-2"
                  >
                    {supabaseProjects.length === 0 ? (
                      <option value="">Nessun progetto Supabase</option>
                    ) : (
                      supabaseProjects.map((project) => (
                        <option key={project.reference} value={project.reference}>
                          {project.name}
                        </option>
                      ))
                    )}
                  </select>
                </label>
                <label className="space-y-1.5 text-xs font-semibold text-ink-muted">
                  <span>Secret nuovo o non in elenco</span>
                  <input
                    value={supabaseSecretName}
                    onChange={(event) => onSupabaseSecretNameChange(event.target.value)}
                    className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 font-mono text-sm font-normal text-ink outline-none ring-accent/40 focus:ring-2"
                    placeholder="TURNSTILE_SECRET_KEY"
                    list="cf-supabase-secret-options"
                    autoComplete="off"
                  />
                  <datalist id="cf-supabase-secret-options">
                    {supabaseSecrets.map((secret) => (
                      <option key={secret.name} value={secret.name} />
                    ))}
                  </datalist>
                </label>
              </div>
              {supabaseSecrets.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-ink">
                  {supabaseSecrets.map((secret) => (
                    <label
                      key={secret.name}
                      className="flex items-center gap-1.5 rounded-lg border border-surface-3 px-2 py-1"
                    >
                      <input
                        type="checkbox"
                        checked={selectedSupabaseSecretNames.includes(secret.name)}
                        onChange={() => onToggleSupabaseSecretName(secret.name)}
                      />
                      <span className="font-mono">{secret.name}</span>
                    </label>
                  ))}
                </div>
              ) : null}
              {supabaseUpdateHint ? (
                <p className="mt-2 text-xs text-accent">{supabaseUpdateHint}</p>
              ) : null}
              <p className="mt-2 text-xs text-ink-muted">
                Supabase rende il valore disponibile subito alle Edge Functions.
              </p>
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  disabled={
                    supabaseBusy ||
                    !selectedSupabaseProjectRef ||
                    (selectedSupabaseSecretNames.length === 0 && !supabaseSecretName.trim())
                  }
                  onClick={onWriteSupabase}
                  className="rounded-lg border border-accent/50 px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent/10 disabled:opacity-50"
                >
                  {supabaseBusy ? "Aggiornamento..." : "Scrivi in Supabase"}
                </button>
              </div>
            </>
          ) : (
            <p className="mt-2 text-xs text-ink-muted">
              Aggiungi e collega Supabase da Esplora per scrivere questo secret nelle Edge Functions.
            </p>
          )}
        </div>

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onCopy}
            className="rounded-lg border border-surface-3 px-3 py-1.5 text-sm text-ink hover:border-accent/40"
          >
            Copia secret
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-surface-0"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}
