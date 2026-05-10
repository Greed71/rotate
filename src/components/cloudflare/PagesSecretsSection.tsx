import type { PagesProjectRow } from "../../types";

type Props = {
  projects: PagesProjectRow[];
  busy: boolean;
  pagesBusy: boolean;
  pagesEnvironment: "production" | "preview";
  onRefresh: () => void;
  onUseProject: (project: PagesProjectRow) => void;
};

export function PagesSecretsSection({
  projects,
  busy,
  pagesBusy,
  pagesEnvironment,
  onRefresh,
  onUseProject,
}: Props) {
  return (
    <section className="space-y-3 rounded-2xl border border-surface-3/80 bg-surface-1/60 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">Pages secrets</h2>
          <p className="mt-1 text-xs text-ink-muted">
            Progetti Cloudflare Pages e variabili/secrets per produzione e preview. Per scrivere serve Pages Write.
          </p>
        </div>
        <button
          type="button"
          disabled={busy || pagesBusy}
          onClick={onRefresh}
          className="rounded-lg border border-surface-3 px-3 py-1.5 text-sm text-ink hover:border-accent/40 disabled:opacity-50"
        >
          Aggiorna Pages
        </button>
      </div>
      <div className="overflow-hidden rounded-xl border border-surface-3/80">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-2/80 text-[11px] uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Progetto</th>
              <th className="px-4 py-3 font-semibold">Production env</th>
              <th className="px-4 py-3 font-semibold">Preview env</th>
              <th className="px-4 py-3 font-semibold">Azione</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-3/60 bg-surface-1/40">
            {projects.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-5 text-center text-ink-muted">
                  Nessun progetto Pages rilevato.
                </td>
              </tr>
            ) : (
              projects.map((project) => (
                <tr key={project.name} className="text-ink">
                  <td className="px-4 py-3">
                    <p className="font-medium">{project.name}</p>
                    <p className="text-xs text-ink-muted">{project.productionBranch ?? "-"}</p>
                  </td>
                  <td className="max-w-[280px] px-4 py-3 text-xs text-ink-muted">
                    {project.productionEnvVars.length
                      ? project.productionEnvVars.map((item) => `${item.name} (${item.kind})`).join(", ")
                      : "-"}
                  </td>
                  <td className="max-w-[280px] px-4 py-3 text-xs text-ink-muted">
                    {project.previewEnvVars.length
                      ? project.previewEnvVars.map((item) => `${item.name} (${item.kind})`).join(", ")
                      : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => onUseProject(project)}
                      className="rounded-lg border border-surface-3 px-2.5 py-1 text-xs font-medium text-ink-muted hover:border-accent/40"
                    >
                      Usa per Turnstile {pagesEnvironment === "preview" ? "(preview)" : ""}
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
