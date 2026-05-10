import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";
import type { DeployTarget } from "../secretDestinations";
import type { Integration, VercelEnvVarRow, VercelProjectRow, VercelStatusDto } from "../types";
import { AlertMessage } from "./provider/AlertMessage";
import { CredentialGuide } from "./provider/CredentialGuide";
import { DeployTargetsPicker } from "./provider/DeployTargetsPicker";
import { LinkedAccountBar } from "./provider/LinkedAccountBar";
import { ProviderHeader } from "./provider/ProviderHeader";
import { ProviderLoadingPanel } from "./provider/ProviderLoadingPanel";

function errText(e: unknown): string {
  if (typeof e === "string") return e;
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return String(e);
}

type Props = {
  integration: Integration;
  onBack: () => void;
};

export function VercelDetail({ integration, onBack }: Props) {
  const [status, setStatus] = useState<VercelStatusDto | null>(null);
  const [apiToken, setApiToken] = useState("");
  const [teamId, setTeamId] = useState("");
  const [projects, setProjects] = useState<VercelProjectRow[]>([]);
  const [envs, setEnvs] = useState<VercelEnvVarRow[]>([]);
  const [selectedProject, setSelectedProject] = useState<VercelProjectRow | null>(null);
  const [envKey, setEnvKey] = useState("TURNSTILE_SECRET_KEY");
  const [envValue, setEnvValue] = useState("");
  const [targets, setTargets] = useState(["production"]);
  const [busy, setBusy] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [resourcesLoading, setResourcesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const integrationId = integration.id;
  const linked = status?.linked ?? false;

  const refreshStatus = useCallback(async () => {
    try {
      const next = await invoke<VercelStatusDto>("vercel_status", { integrationId });
      setStatus(next);
      setTeamId(next.teamId ?? "");
    } catch {
      setStatus({ linked: false, userEmail: null, teamId: null });
    }
  }, [integrationId]);

  const refreshProjects = useCallback(async () => {
    try {
      const list = await invoke<VercelProjectRow[]>("vercel_list_projects", { integrationId });
      setProjects(list);
      setSelectedProject((current) =>
        current && list.some((project) => project.id === current.id) ? current : list[0] ?? null,
      );
      setError(null);
    } catch (e) {
      setProjects([]);
      setSelectedProject(null);
      setError(errText(e));
    }
  }, [integrationId]);

  const refreshEnvs = useCallback(
    async (project: VercelProjectRow | null) => {
      if (!project) {
        setEnvs([]);
        return;
      }
      try {
        const list = await invoke<VercelEnvVarRow[]>("vercel_list_project_envs", {
          integrationId,
          projectId: project.id,
        });
        setEnvs(list);
        setEnvKey(
          list.find((env) => env.key.toUpperCase().includes("TURNSTILE"))?.key ??
            list[0]?.key ??
            "TURNSTILE_SECRET_KEY",
        );
      } catch (e) {
        setEnvs([]);
        setError(errText(e));
      }
    },
    [integrationId],
  );

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (!linked) {
      setInitialLoadComplete(true);
      setResourcesLoading(false);
      return;
    }
    let cancelled = false;
    setInitialLoadComplete(false);
    setResourcesLoading(true);
    void refreshProjects().finally(() => {
      if (!cancelled) {
        setInitialLoadComplete(true);
        setResourcesLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [linked, refreshProjects]);

  useEffect(() => {
    if (linked) void refreshEnvs(selectedProject);
  }, [linked, selectedProject, refreshEnvs]);

  async function handleLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const next = await invoke<VercelStatusDto>("vercel_link", {
        integrationId,
        apiToken: apiToken.trim(),
        teamId: teamId.trim() || null,
      });
      setStatus(next);
      setApiToken("");
      await refreshProjects();
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleUnlink() {
    setBusy(true);
    setError(null);
    try {
      await invoke("vercel_unlink", { integrationId });
      setStatus({ linked: false, userEmail: null, teamId: null });
      setProjects([]);
      setEnvs([]);
      setSelectedProject(null);
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  async function upsertEnv() {
    if (!selectedProject) return;
    setBusy(true);
    setError(null);
    setHint(null);
    try {
      await invoke("vercel_upsert_project_env", {
        payload: {
          integrationId,
          projectId: selectedProject.id,
          projectName: selectedProject.name,
          key: envKey.trim(),
          value: envValue,
          targets,
        },
      });
      setHint(`Variabile ${envKey.trim()} aggiornata in ${selectedProject.name}.`);
      setEnvValue("");
      await refreshEnvs(selectedProject);
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  function toggleTarget(target: DeployTarget) {
    setTargets((current) =>
      current.includes(target)
        ? current.filter((item) => item !== target)
        : [...current, target],
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-auto px-10 py-10">
      <ProviderHeader
        providerLabel="VERCEL"
        title={integration.label}
        description="Collega un Access Token Vercel per aggiornare environment variables dei progetti."
        backLabel="← Torna ai servizi"
        onBack={onBack}
      />

      <AlertMessage message={error} />

      {!linked ? (
        <form onSubmit={(e) => void handleLink(e)} className="max-w-xl space-y-4 rounded-2xl border border-surface-3/80 bg-surface-1/80 p-6">
          <div>
            <h2 className="text-sm font-semibold text-ink">Collega Vercel</h2>
            <p className="mt-1 text-xs text-ink-muted">
              Crea un token da Vercel Account Settings. Se lavori su un team, inserisci anche il Team ID.
            </p>
          </div>
          <CredentialGuide
            steps={[
              "Apri Vercel Account Settings e crea un Access Token dedicato a Rotate.",
              "Seleziona lo scope corretto per i progetti personali o del team che vuoi aggiornare.",
              "Se il progetto appartiene a un team, copia anche il Team ID da Team Settings → General.",
              "Incolla il token qui: Rotate lo usa per elencare i progetti e aggiornare le environment variables.",
            ]}
            links={[
              { href: "https://vercel.com/account/settings/tokens", label: "Crea token Vercel" },
              { href: "https://vercel.com/docs/rest-api", label: "Documentazione API" },
              {
                href: "https://vercel.com/docs/projects/environment-variables",
                label: "Environment variables",
              },
            ]}
          />
          <label className="block space-y-1.5 text-xs font-semibold text-ink-muted">
            <span>Access Token</span>
            <input
              type="password"
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
              className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 font-mono text-sm font-normal text-ink outline-none ring-accent/40 focus:ring-2"
              autoComplete="off"
            />
          </label>
          <label className="block space-y-1.5 text-xs font-semibold text-ink-muted">
            <span>Team ID opzionale</span>
            <input
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 font-mono text-sm font-normal text-ink outline-none ring-accent/40 focus:ring-2"
              placeholder="team_..."
              autoComplete="off"
            />
          </label>
          <button type="submit" disabled={busy} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-surface-0 disabled:opacity-50">
            {busy ? "Verifica..." : "Collega account"}
          </button>
        </form>
      ) : !initialLoadComplete || resourcesLoading ? (
        <ProviderLoadingPanel
          title="Caricamento Vercel"
          description="Sto scaricando progetti e variabili disponibili."
        />
      ) : (
        <div className="space-y-6">
          <LinkedAccountBar
            details={
              <>
                <p className="text-xs text-ink-muted">Account collegato</p>
                <p className="text-sm text-ink">{status?.userEmail ?? "Token verificato"}</p>
                {status?.teamId ? <p className="font-mono text-xs text-ink-muted">{status.teamId}</p> : null}
              </>
            }
            actions={
              <>
                <button type="button" disabled={busy} onClick={() => void refreshProjects()} className="rounded-lg border border-surface-3 px-3 py-1.5 text-sm text-ink hover:border-accent/40">
                  Aggiorna progetti
                </button>
                <button type="button" disabled={busy} onClick={() => void handleUnlink()} className="rounded-lg border border-rose-500/40 px-3 py-1.5 text-sm text-rose-200 hover:bg-rose-500/10">
                  Rimuovi collegamento
                </button>
              </>
            }
          />

          <section className="space-y-3 rounded-2xl border border-surface-3/80 bg-surface-1/60 p-5">
            <div className="grid gap-4 lg:grid-cols-[minmax(260px,360px)_1fr]">
              <div className="space-y-3">
                <label className="block space-y-1.5 text-xs font-semibold text-ink-muted">
                  <span>Progetto</span>
                  <select
                    value={selectedProject?.id ?? ""}
                    onChange={(e) => setSelectedProject(projects.find((project) => project.id === e.target.value) ?? null)}
                    className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 text-sm font-normal text-ink outline-none ring-accent/40 focus:ring-2"
                  >
                    {projects.length === 0 ? (
                      <option value="">Nessun progetto rilevato</option>
                    ) : (
                      projects.map((project) => (
                        <option key={project.id} value={project.id}>{project.name}</option>
                      ))
                    )}
                  </select>
                </label>
                <label className="block space-y-1.5 text-xs font-semibold text-ink-muted">
                  <span>Variabile</span>
                  <input
                    value={envKey}
                    onChange={(e) => setEnvKey(e.target.value)}
                    className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 font-mono text-sm font-normal text-ink outline-none ring-accent/40 focus:ring-2"
                    list="vercel-env-options"
                    autoComplete="off"
                  />
                  <datalist id="vercel-env-options">
                    {envs.map((env) => <option key={env.id || env.key} value={env.key} />)}
                  </datalist>
                </label>
                <label className="block space-y-1.5 text-xs font-semibold text-ink-muted">
                  <span>Nuovo valore</span>
                  <input
                    type="password"
                    value={envValue}
                    onChange={(e) => setEnvValue(e.target.value)}
                    className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 font-mono text-sm font-normal text-ink outline-none ring-accent/40 focus:ring-2"
                    autoComplete="off"
                  />
                </label>
                <DeployTargetsPicker selected={targets} onToggle={toggleTarget} />
                {hint ? <p className="text-xs text-accent">{hint}</p> : null}
                <button type="button" disabled={busy || !selectedProject || !envKey.trim() || !envValue || targets.length === 0} onClick={() => void upsertEnv()} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-surface-0 disabled:opacity-50">
                  {busy ? "Aggiornamento..." : "Aggiorna variabile"}
                </button>
              </div>
              <div className="overflow-hidden rounded-xl border border-surface-3/80">
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface-2/80 text-[11px] uppercase tracking-wide text-ink-muted">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Key</th>
                      <th className="px-4 py-3 font-semibold">Target</th>
                      <th className="px-4 py-3 font-semibold">Tipo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-3/60 bg-surface-1/40">
                    {envs.length === 0 ? (
                      <tr><td colSpan={3} className="px-4 py-5 text-center text-ink-muted">Nessuna env var rilevata.</td></tr>
                    ) : (
                      envs.map((env) => (
                        <tr key={env.id || env.key} className="text-ink">
                          <td className="px-4 py-3 font-mono text-xs">{env.key}</td>
                          <td className="px-4 py-3 text-xs text-ink-muted">{env.targets.join(", ") || "-"}</td>
                          <td className="px-4 py-3 text-xs text-ink-muted">{env.kind || "-"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
