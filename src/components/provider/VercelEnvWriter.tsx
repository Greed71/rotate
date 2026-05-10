import type { DeployTarget } from "../../secretDestinations";
import type { VercelProjectRow } from "../../types";
import { DeployTargetsPicker } from "./DeployTargetsPicker";

type Props = {
  title: string;
  description: string;
  projects: VercelProjectRow[];
  selectedProjectId: string;
  envKey: string;
  targets: string[];
  busy: boolean;
  hint: string | null;
  emptyMessage: string;
  onRefreshProjects: () => void;
  onSelectProject: (projectId: string) => void;
  onChangeEnvKey: (key: string) => void;
  onToggleTarget: (target: DeployTarget) => void;
  onWrite: () => void;
};

export function VercelEnvWriter({
  title,
  description,
  projects,
  selectedProjectId,
  envKey,
  targets,
  busy,
  hint,
  emptyMessage,
  onRefreshProjects,
  onSelectProject,
  onChangeEnvKey,
  onToggleTarget,
  onWrite,
}: Props) {
  return (
    <div className="mt-3 rounded-xl border border-surface-3/80 bg-surface-0/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{title}</h4>
          <p className="mt-1 text-xs text-ink-muted">{description}</p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={onRefreshProjects}
          className="rounded-lg border border-surface-3 px-2.5 py-1 text-xs font-medium text-ink-muted hover:border-accent/40 disabled:opacity-50"
        >
          Aggiorna progetti
        </button>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5 text-xs font-semibold text-ink-muted">
          <span>Progetto</span>
          <select
            value={selectedProjectId}
            onChange={(e) => onSelectProject(e.target.value)}
            className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 text-sm font-normal text-ink outline-none ring-accent/40 focus:ring-2"
          >
            {projects.length === 0 ? (
              <option value="">{emptyMessage}</option>
            ) : (
              projects.map((project) => (
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
            value={envKey}
            onChange={(e) => onChangeEnvKey(e.target.value)}
            className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 font-mono text-sm font-normal text-ink outline-none ring-accent/40 focus:ring-2"
            autoComplete="off"
          />
        </label>
      </div>
      <div className="mt-3">
        <DeployTargetsPicker selected={targets} onToggle={onToggleTarget} />
      </div>
      {hint ? <p className="mt-2 text-xs text-accent">{hint}</p> : null}
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          disabled={busy || !selectedProjectId || !envKey.trim() || targets.length === 0}
          onClick={onWrite}
          className="rounded-lg border border-accent/50 px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent/10 disabled:opacity-50"
        >
          {busy ? "Aggiornamento..." : "Scrivi in Vercel"}
        </button>
      </div>
    </div>
  );
}
