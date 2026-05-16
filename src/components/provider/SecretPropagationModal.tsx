import { useTranslation } from "react-i18next";
import type { SecretPropagationState } from "./useSecretPropagation";
import { VercelEnvWriter } from "./VercelEnvWriter";

type Props = {
  title?: string;
  description?: string;
  open: boolean;
  valueLabel: string;
  state: SecretPropagationState;
  onClose: () => void;
};

export function SecretPropagationModal({
  title,
  description,
  open,
  valueLabel,
  state,
  onClose,
}: Props) {
  const { t } = useTranslation();
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 px-4">
      <div className="max-h-[88vh] w-full max-w-3xl overflow-auto rounded-2xl border border-accent/35 bg-surface-1 p-6 shadow-2xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-accent">
              {title ?? t("propagation.title")}
            </h3>
            <p className="mt-1 text-xs text-ink-muted">
              {description ?? t("propagation.description")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
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
                {t("propagation.batchLead")}
              </p>
            </div>
            <button
              type="button"
              disabled={
                state.batchBusy ||
                (!state.includeVercel && !state.includeLocalEnv && !state.includeGithub)
              }
              onClick={() => void state.applySelected()}
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-surface-0 disabled:opacity-50"
            >
              {state.batchBusy ? t("propagation.applying") : t("propagation.applySelected")}
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-ink">
            <label className="flex items-center gap-1.5 rounded-lg border border-surface-3 px-2 py-1">
              <input
                type="checkbox"
                checked={state.includeVercel}
                disabled={!state.vercelIntegration}
                onChange={(event) => state.setIncludeVercel(event.target.checked)}
              />
              <span className={!state.vercelIntegration ? "text-ink-muted" : undefined}>
                Vercel
              </span>
            </label>
            <label className="flex items-center gap-1.5 rounded-lg border border-surface-3 px-2 py-1">
              <input
                type="checkbox"
                checked={state.includeLocalEnv}
                onChange={(event) => state.setIncludeLocalEnv(event.target.checked)}
              />
              <span>{t("propagation.localEnv")}</span>
            </label>
            <label className="flex items-center gap-1.5 rounded-lg border border-surface-3 px-2 py-1">
              <input
                type="checkbox"
                checked={state.includeGithub}
                disabled={!state.githubIntegration}
                onChange={(event) => state.setIncludeGithub(event.target.checked)}
              />
              <span className={!state.githubIntegration ? "text-ink-muted" : undefined}>
                GitHub
              </span>
            </label>
          </div>
          {state.batchHint ? <p className="mt-2 text-xs text-accent">{state.batchHint}</p> : null}
        </div>

        {state.vercelIntegration ? (
          <VercelEnvWriter
            title={t("propagation.vercelTitle")}
            description={t("propagation.vercelDescription", { value: valueLabel })}
            projects={state.vercel.projects}
            selectedProjectId={state.vercel.selectedProjectId}
            envKey={state.vercel.envKey}
            targets={state.vercel.targets}
            busy={state.vercel.busy}
            hint={state.vercel.hint}
            emptyMessage={t("propagation.noVercelProjects")}
            onRefreshProjects={() => void state.vercel.refreshProjects()}
            onSelectProject={state.vercel.setSelectedProjectId}
            onChangeEnvKey={state.vercel.setEnvKey}
            onToggleTarget={state.toggleVercelTarget}
            onWrite={() => void state.writeVercel()}
          />
        ) : (
          <p className="mt-3 rounded-xl border border-surface-3/80 bg-surface-0/50 p-3 text-xs text-ink-muted">
            {t("propagation.connectVercel")}
          </p>
        )}

        <div className="mt-3 rounded-xl border border-surface-3/80 bg-surface-0/50 p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            {t("propagation.localEnvTitle")}
          </h4>
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-xs text-ink-muted">
              {t("propagation.localEnvLead")}
            </p>
            <button
              type="button"
              disabled={state.localEnvBusy || !state.localEnvPath.trim()}
              onClick={() => void state.inspectLocalEnv()}
              className="rounded-lg border border-surface-3 px-2.5 py-1 text-xs font-medium text-ink-muted hover:border-accent/40 disabled:opacity-50"
            >
              {t("propagation.readKeys")}
            </button>
          </div>
          <label className="mt-3 block space-y-1.5 text-xs font-semibold text-ink-muted">
            <span>{t("propagation.envFile")}</span>
            <input
              value={state.localEnvPath}
              onChange={(event) => state.setLocalEnvPath(event.target.value)}
              className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 font-mono text-sm font-normal text-ink outline-none ring-accent/40 focus:ring-2"
              placeholder="C:\\path\\project\\.env.local"
              autoComplete="off"
            />
          </label>
          <label className="mt-3 block space-y-1.5 text-xs font-semibold text-ink-muted">
            <span>{t("propagation.variable")}</span>
            <input
              value={state.localEnvKey}
              onChange={(event) => state.setLocalEnvKey(event.target.value)}
              className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 font-mono text-sm font-normal text-ink outline-none ring-accent/40 focus:ring-2"
              list="generic-local-env-key-options"
              autoComplete="off"
            />
            <datalist id="generic-local-env-key-options">
              {state.localEnvKeys.map((key) => (
                <option key={key} value={key} />
              ))}
            </datalist>
          </label>
          {state.localEnvHint ? <p className="mt-2 text-xs text-accent">{state.localEnvHint}</p> : null}
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              disabled={state.localEnvBusy || !state.localEnvPath.trim() || !state.localEnvKey.trim()}
              onClick={() => void state.writeLocalEnv()}
              className="rounded-lg border border-accent/50 px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent/10 disabled:opacity-50"
            >
              {state.localEnvBusy ? t("common.updating") : t("propagation.writeLocalEnv")}
            </button>
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-surface-3/80 bg-surface-0/50 p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            {t("propagation.githubTitle")}
          </h4>
          {state.githubIntegration ? (
            <>
              <p className="mt-2 text-xs text-ink-muted">
                {t("propagation.githubLead")}
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="space-y-1.5 text-xs font-semibold text-ink-muted">
                  <span>{t("propagation.githubOwner")}</span>
                  <input
                    value={state.githubOwner}
                    onChange={(event) => state.setGithubOwner(event.target.value)}
                    className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 font-mono text-sm font-normal text-ink outline-none ring-accent/40 focus:ring-2"
                    placeholder="owner"
                    autoComplete="off"
                  />
                </label>
                <label className="space-y-1.5 text-xs font-semibold text-ink-muted">
                  <span>{t("propagation.githubRepo")}</span>
                  <input
                    value={state.githubRepo}
                    onChange={(event) => state.setGithubRepo(event.target.value)}
                    className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 font-mono text-sm font-normal text-ink outline-none ring-accent/40 focus:ring-2"
                    placeholder="repo"
                    autoComplete="off"
                  />
                </label>
              </div>
              <label className="mt-3 block space-y-1.5 text-xs font-semibold text-ink-muted">
                <span>{t("propagation.githubSecretName")}</span>
                <input
                  value={state.githubSecretName}
                  onChange={(event) => state.setGithubSecretName(event.target.value)}
                  className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 font-mono text-sm font-normal text-ink outline-none ring-accent/40 focus:ring-2"
                  autoComplete="off"
                />
              </label>
              {state.githubHint ? <p className="mt-2 text-xs text-accent">{state.githubHint}</p> : null}
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  disabled={
                    state.githubBusy ||
                    !state.githubOwner.trim() ||
                    !state.githubRepo.trim() ||
                    !state.githubSecretName.trim()
                  }
                  onClick={() => void state.writeGithub()}
                  className="rounded-lg border border-accent/50 px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent/10 disabled:opacity-50"
                >
                  {state.githubBusy ? t("common.updating") : t("propagation.writeGithub")}
                </button>
              </div>
            </>
          ) : (
            <p className="mt-2 text-xs text-ink-muted">
              {t("propagation.connectGithub")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
