import { useState } from "react";
import { useTranslation } from "react-i18next";
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
  localEnvPath: string;
  localEnvKeys: string[];
  localEnvKey: string;
  localEnvBusy: boolean;
  localEnvUpdateHint: string | null;
  onLocalEnvPathChange: (value: string) => void;
  onInspectLocalEnv: () => void;
  onLocalEnvKeyChange: (value: string) => void;
  onWriteLocalEnv: () => void;
  hasGithubIntegration: boolean;
  githubOwner: string;
  githubRepo: string;
  githubSecretName: string;
  githubBusy: boolean;
  githubUpdateHint: string | null;
  onGithubOwnerChange: (value: string) => void;
  onGithubRepoChange: (value: string) => void;
  onGithubSecretNameChange: (value: string) => void;
  onWriteGithub: () => void;
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
  includeVercel: boolean;
  includeSupabase: boolean;
  includeLocalEnv: boolean;
  includeGithub: boolean;
  batchBusy: boolean;
  batchHint: string | null;
  onIncludeVercelChange: (value: boolean) => void;
  onIncludeSupabaseChange: (value: boolean) => void;
  onIncludeLocalEnvChange: (value: boolean) => void;
  onIncludeGithubChange: (value: boolean) => void;
  onApplySelected: () => void;
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
  localEnvPath,
  localEnvKeys,
  localEnvKey,
  localEnvBusy,
  localEnvUpdateHint,
  onLocalEnvPathChange,
  onInspectLocalEnv,
  onLocalEnvKeyChange,
  onWriteLocalEnv,
  hasGithubIntegration,
  githubOwner,
  githubRepo,
  githubSecretName,
  githubBusy,
  githubUpdateHint,
  onGithubOwnerChange,
  onGithubRepoChange,
  onGithubSecretNameChange,
  onWriteGithub,
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
  includeVercel,
  includeSupabase,
  includeLocalEnv,
  includeGithub,
  batchBusy,
  batchHint,
  onIncludeVercelChange,
  onIncludeSupabaseChange,
  onIncludeLocalEnvChange,
  onIncludeGithubChange,
  onApplySelected,
}: Props) {
  const { t } = useTranslation();
  const [propagationOpen, setPropagationOpen] = useState(false);

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
        <div className="w-full max-w-lg rounded-2xl border border-amber-500/30 bg-surface-1 p-6 shadow-2xl">
        <h3 className="text-sm font-semibold text-amber-100">Nuovo secret Turnstile</h3>
        <p className="mt-1 text-xs text-ink-muted">
          {t("cloudflareTurnstile.resultLead")}
        </p>
        <p className="mt-2 text-sm text-ink">{result.name}</p>
        <p className="font-mono text-[11px] text-ink-muted">Sitekey: {result.sitekey}</p>
        <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-surface-0 p-3 font-mono text-xs text-ink">
          {result.secret}
        </pre>
        {copyHint ? <p className="mt-2 text-xs text-accent">{copyHint}</p> : null}

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => setPropagationOpen(true)}
            className="rounded-lg border border-accent/50 px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent/10"
          >
            {t("propagation.title")}
          </button>
        </div>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onCopy}
            className="rounded-lg border border-surface-3 px-3 py-1.5 text-sm text-ink hover:border-accent/40"
          >
            {t("manualProviders.copySecret")}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-surface-0"
          >
            {t("common.close")}
          </button>
        </div>
      </div>
    </div>

    {propagationOpen ? (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 px-4">
        <div className="max-h-[88vh] w-full max-w-3xl overflow-auto rounded-2xl border border-accent/35 bg-surface-1 p-6 shadow-2xl">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-accent">{t("propagation.title")}</h3>
              <p className="mt-1 text-xs text-ink-muted">
                Scegli una o piu destinazioni da allineare con il nuovo secret Turnstile.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPropagationOpen(false)}
              className="rounded-lg border border-surface-3 px-3 py-1.5 text-sm text-ink hover:border-accent/40"
            >
              {t("common.close")}
            </button>
          </div>

          <div className="mt-4 rounded-xl border border-accent/30 bg-accent/5 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-accent">
                {t("propagation.batchTitle")}
              </h4>
              <p className="mt-1 text-xs text-ink-muted">
                {t("cloudflareTurnstile.propagationLead")}
              </p>
            </div>
            <button
              type="button"
              disabled={
                batchBusy ||
                (!includeVercel && !includeSupabase && !includeLocalEnv && !includeGithub)
              }
              onClick={onApplySelected}
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-surface-0 disabled:opacity-50"
            >
              {batchBusy ? t("propagation.applying") : t("propagation.applySelected")}
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-ink">
            <label className="flex items-center gap-1.5 rounded-lg border border-surface-3 px-2 py-1">
              <input
                type="checkbox"
                checked={includeVercel}
                disabled={!hasVercelIntegration}
                onChange={(event) => onIncludeVercelChange(event.target.checked)}
              />
              <span className={!hasVercelIntegration ? "text-ink-muted" : undefined}>
                Vercel
              </span>
            </label>
            <label className="flex items-center gap-1.5 rounded-lg border border-surface-3 px-2 py-1">
              <input
                type="checkbox"
                checked={includeSupabase}
                disabled={!hasSupabaseIntegration}
                onChange={(event) => onIncludeSupabaseChange(event.target.checked)}
              />
              <span className={!hasSupabaseIntegration ? "text-ink-muted" : undefined}>
                Supabase
              </span>
            </label>
            <label className="flex items-center gap-1.5 rounded-lg border border-surface-3 px-2 py-1">
              <input
                type="checkbox"
                checked={includeLocalEnv}
                onChange={(event) => onIncludeLocalEnvChange(event.target.checked)}
              />
              <span>{t("propagation.localEnv")}</span>
            </label>
            <label className="flex items-center gap-1.5 rounded-lg border border-surface-3 px-2 py-1">
              <input
                type="checkbox"
                checked={includeGithub}
                disabled={!hasGithubIntegration}
                onChange={(event) => onIncludeGithubChange(event.target.checked)}
              />
              <span className={!hasGithubIntegration ? "text-ink-muted" : undefined}>
                GitHub
              </span>
            </label>
          </div>
          {batchHint ? <p className="mt-2 text-xs text-accent">{batchHint}</p> : null}
        </div>

        <div className="mt-4 rounded-xl border border-surface-3/80 bg-surface-0/50 p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            {t("cloudflareTurnstile.workerTitle")}
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
                  <option value="">{t("cloudflareTurnstile.noWorkers")}</option>
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
            {t("cloudflareTurnstile.workerLead")}
          </p>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              disabled={workerBusy || !selectedWorker.trim() || !workerSecretName.trim()}
              onClick={onWriteWorker}
              className="rounded-lg border border-accent/50 px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent/10 disabled:opacity-50"
            >
              {workerBusy ? t("common.updating") : t("cloudflareTurnstile.writeWorker")}
            </button>
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-surface-3/80 bg-surface-0/50 p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            {t("cloudflareTurnstile.pagesTitle")}
          </h4>
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_130px]">
            <label className="space-y-1.5 text-xs font-semibold text-ink-muted">
              <span>{t("propagation.project")}</span>
              <select
                value={selectedPagesProject}
                onChange={(event) => onPagesProjectChange(event.target.value)}
                className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 text-sm font-normal text-ink outline-none ring-accent/40 focus:ring-2"
              >
                {pagesProjects.length === 0 ? (
                  <option value="">{t("cloudflareTurnstile.noPagesProjects")}</option>
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
            {t("cloudflareTurnstile.pagesLead")}
          </p>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              disabled={pagesBusy || !selectedPagesProject.trim() || !pagesSecretName.trim()}
              onClick={onWritePages}
              className="rounded-lg border border-accent/50 px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent/10 disabled:opacity-50"
            >
              {pagesBusy ? t("common.updating") : t("cloudflareTurnstile.writePages")}
            </button>
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-surface-3/80 bg-surface-0/50 p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            {t("cloudflareTurnstile.secretsStoreTitle")}
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
                  <option value="">{t("cloudflareTurnstile.noStores")}</option>
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
            {t("cloudflareTurnstile.secretsStoreLead")}
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
              {secretsStoreBusy ? t("common.updating") : t("cloudflareTurnstile.writeStore")}
            </button>
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-surface-3/80 bg-surface-0/50 p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            {t("propagation.vercelTitle")}
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
                  {t("propagation.refreshProjects")}
                </button>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="space-y-1.5 text-xs font-semibold text-ink-muted">
                  <span>{t("propagation.project")}</span>
                  <select
                    value={selectedVercelProjectId}
                    onChange={(event) => onVercelProjectChange(event.target.value)}
                    className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 text-sm font-normal text-ink outline-none ring-accent/40 focus:ring-2"
                  >
                    {vercelProjects.length === 0 ? (
                      <option value="">{t("propagation.noVercelProjects")}</option>
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
                  {vercelBusy ? t("common.updating") : t("propagation.writeVercel")}
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
            {t("propagation.localEnvTitle")}
          </h4>
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-xs text-ink-muted">
              {t("cloudflareTurnstile.localEnvLead")}
            </p>
            <button
              type="button"
              disabled={localEnvBusy || !localEnvPath.trim()}
              onClick={onInspectLocalEnv}
              className="rounded-lg border border-surface-3 px-2.5 py-1 text-xs font-medium text-ink-muted hover:border-accent/40 disabled:opacity-50"
            >
              {t("propagation.readKeys")}
            </button>
          </div>
          <label className="mt-3 block space-y-1.5 text-xs font-semibold text-ink-muted">
            <span>{t("propagation.envFile")}</span>
            <input
              value={localEnvPath}
              onChange={(event) => onLocalEnvPathChange(event.target.value)}
              className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 font-mono text-sm font-normal text-ink outline-none ring-accent/40 focus:ring-2"
              placeholder="C:\\path\\project\\.env.local"
              autoComplete="off"
            />
          </label>
          <label className="mt-3 block space-y-1.5 text-xs font-semibold text-ink-muted">
            <span>{t("propagation.variable")}</span>
            <input
              value={localEnvKey}
              onChange={(event) => onLocalEnvKeyChange(event.target.value)}
              className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 font-mono text-sm font-normal text-ink outline-none ring-accent/40 focus:ring-2"
              placeholder="TURNSTILE_SECRET_KEY"
              list="cf-local-env-key-options"
              autoComplete="off"
            />
            <datalist id="cf-local-env-key-options">
              {localEnvKeys.map((key) => (
                <option key={key} value={key} />
              ))}
            </datalist>
          </label>
          {localEnvUpdateHint ? (
            <p className="mt-2 text-xs text-accent">{localEnvUpdateHint}</p>
          ) : null}
          <p className="mt-2 text-xs text-ink-muted">
            Il valore viene scritto nel file locale e non viene salvato nel database di Rotate.
          </p>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              disabled={localEnvBusy || !localEnvPath.trim() || !localEnvKey.trim()}
              onClick={onWriteLocalEnv}
              className="rounded-lg border border-accent/50 px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent/10 disabled:opacity-50"
            >
              {localEnvBusy ? t("common.updating") : t("propagation.writeLocalEnv")}
            </button>
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-surface-3/80 bg-surface-0/50 p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            {t("propagation.githubTitle")}
          </h4>
          {hasGithubIntegration ? (
            <>
              <p className="mt-2 text-xs text-ink-muted">
                {t("cloudflareTurnstile.githubLead")}
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="space-y-1.5 text-xs font-semibold text-ink-muted">
                  <span>{t("propagation.githubOwner")}</span>
                  <input
                    value={githubOwner}
                    onChange={(event) => onGithubOwnerChange(event.target.value)}
                    className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 font-mono text-sm font-normal text-ink outline-none ring-accent/40 focus:ring-2"
                    placeholder="owner"
                    autoComplete="off"
                  />
                </label>
                <label className="space-y-1.5 text-xs font-semibold text-ink-muted">
                  <span>{t("propagation.githubRepo")}</span>
                  <input
                    value={githubRepo}
                    onChange={(event) => onGithubRepoChange(event.target.value)}
                    className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 font-mono text-sm font-normal text-ink outline-none ring-accent/40 focus:ring-2"
                    placeholder="repo"
                    autoComplete="off"
                  />
                </label>
              </div>
              <label className="mt-3 block space-y-1.5 text-xs font-semibold text-ink-muted">
                <span>{t("propagation.githubSecretName")}</span>
                <input
                  value={githubSecretName}
                  onChange={(event) => onGithubSecretNameChange(event.target.value)}
                  className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 font-mono text-sm font-normal text-ink outline-none ring-accent/40 focus:ring-2"
                  placeholder="TURNSTILE_SECRET_KEY"
                  autoComplete="off"
                />
              </label>
              {githubUpdateHint ? (
                <p className="mt-2 text-xs text-accent">{githubUpdateHint}</p>
              ) : null}
              <p className="mt-2 text-xs text-ink-muted">
                Il secret viene cifrato con la public key GitHub prima dell'invio.
              </p>
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  disabled={
                    githubBusy ||
                    !githubOwner.trim() ||
                    !githubRepo.trim() ||
                    !githubSecretName.trim()
                  }
                  onClick={onWriteGithub}
                  className="rounded-lg border border-accent/50 px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent/10 disabled:opacity-50"
                >
                  {githubBusy ? t("common.updating") : t("propagation.writeGithub")}
                </button>
              </div>
            </>
          ) : (
            <p className="mt-2 text-xs text-ink-muted">
              Aggiungi e collega GitHub da Esplora per scrivere questo secret nei repository.
            </p>
          )}
        </div>

        <div className="mt-3 rounded-xl border border-surface-3/80 bg-surface-0/50 p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            {t("cloudflareTurnstile.supabaseTitle")}
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
                  {t("propagation.refreshProjects")}
                </button>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="space-y-1.5 text-xs font-semibold text-ink-muted">
                  <span>{t("propagation.project")}</span>
                  <select
                    value={selectedSupabaseProjectRef}
                    onChange={(event) => onSupabaseProjectChange(event.target.value)}
                    className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 text-sm font-normal text-ink outline-none ring-accent/40 focus:ring-2"
                  >
                    {supabaseProjects.length === 0 ? (
                      <option value="">{t("supabase.noProjects")}</option>
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
                  <span>{t("cloudflareTurnstile.supabaseSecretName")}</span>
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
                  {supabaseBusy ? t("common.updating") : t("cloudflareTurnstile.writeSupabase")}
                </button>
              </div>
            </>
          ) : (
            <p className="mt-2 text-xs text-ink-muted">
              Aggiungi e collega Supabase da Esplora per scrivere questo secret nelle Edge Functions.
            </p>
          )}
        </div>


        </div>
      </div>
    ) : null}
  </>
  );
}
