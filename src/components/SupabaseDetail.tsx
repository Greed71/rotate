import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";
import { copySensitiveWithAutoClear } from "../clipboardSecure";
import type {
  Integration,
  SupabaseApiKeyRotateResult,
  SupabaseApiKeyRow,
  SupabaseDatabasePasswordRotateResult,
  SupabaseProjectRow,
  SupabaseSecretRow,
  SupabaseStatusDto,
  VercelProjectRow,
} from "../types";
import { AlertMessage } from "./provider/AlertMessage";
import { CredentialGuide } from "./provider/CredentialGuide";
import { LinkedAccountBar } from "./provider/LinkedAccountBar";
import { ProviderHeader } from "./provider/ProviderHeader";
import { ProviderLoadingPanel } from "./provider/ProviderLoadingPanel";
import { VercelEnvWriter } from "./provider/VercelEnvWriter";
import type { DeployTarget } from "../secretDestinations";

function errText(e: unknown): string {
  if (typeof e === "string") return e;
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return String(e);
}

type Props = {
  integration: Integration;
  integrations?: Integration[];
  onBack: () => void;
};

type DatabaseUrlMode = "direct" | "transaction" | "session";

function encodeDbPassword(password: string): string {
  return encodeURIComponent(password);
}

function defaultPoolerHost(region: string | null | undefined): string {
  return `aws-1-${region || "eu-central-1"}.pooler.supabase.com`;
}

function buildDatabaseUrl(
  projectRef: string,
  password: string,
  mode: DatabaseUrlMode,
  poolerHost: string,
): string {
  const encoded = encodeDbPassword(password);
  if (mode === "direct") {
    return `postgresql://postgres:${encoded}@db.${projectRef}.supabase.co:5432/postgres`;
  }
  const port = mode === "transaction" ? 6543 : 5432;
  return `postgresql://postgres.${projectRef}:${encoded}@${poolerHost}:${port}/postgres`;
}

export function SupabaseDetail({ integration, integrations = [], onBack }: Props) {
  const [status, setStatus] = useState<SupabaseStatusDto | null>(null);
  const [accessToken, setAccessToken] = useState("");
  const [projects, setProjects] = useState<SupabaseProjectRow[]>([]);
  const [secrets, setSecrets] = useState<SupabaseSecretRow[]>([]);
  const [apiKeys, setApiKeys] = useState<SupabaseApiKeyRow[]>([]);
  const [selectedProject, setSelectedProject] = useState<SupabaseProjectRow | null>(null);
  const [secretName, setSecretName] = useState("TURNSTILE_SECRET_KEY");
  const [selectedSecretNames, setSelectedSecretNames] = useState<string[]>([]);
  const [secretValue, setSecretValue] = useState("");
  const [apiKeyBusyId, setApiKeyBusyId] = useState<string | null>(null);
  const [deleteOldApiKey, setDeleteOldApiKey] = useState(false);
  const [apiKeyResult, setApiKeyResult] = useState<SupabaseApiKeyRotateResult | null>(null);
  const [apiKeyCopyHint, setApiKeyCopyHint] = useState<string | null>(null);
  const [databaseConfirmRef, setDatabaseConfirmRef] = useState("");
  const [databaseBusy, setDatabaseBusy] = useState(false);
  const [databaseResult, setDatabaseResult] = useState<SupabaseDatabasePasswordRotateResult | null>(null);
  const [databaseCopyHint, setDatabaseCopyHint] = useState<string | null>(null);
  const [databaseUrlMode, setDatabaseUrlMode] = useState<DatabaseUrlMode>("direct");
  const [poolerHost, setPoolerHost] = useState("aws-1-eu-central-1.pooler.supabase.com");
  const [vercelProjects, setVercelProjects] = useState<VercelProjectRow[]>([]);
  const [selectedVercelProjectId, setSelectedVercelProjectId] = useState("");
  const [databaseVercelEnvKey, setDatabaseVercelEnvKey] = useState("DATABASE_URL");
  const [apiKeyVercelEnvKey, setApiKeyVercelEnvKey] = useState("SUPABASE_SERVICE_ROLE_KEY");
  const [vercelTargets, setVercelTargets] = useState(["production"]);
  const [vercelBusy, setVercelBusy] = useState(false);
  const [vercelHint, setVercelHint] = useState<string | null>(null);
  const [apiKeyVercelHint, setApiKeyVercelHint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [resourcesLoading, setResourcesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const integrationId = integration.id;
  const linked = status?.linked ?? false;
  const vercelIntegration = integrations.find((item) => item.provider === "vercel");
  const selectedDatabaseUrl = databaseResult
    ? buildDatabaseUrl(databaseResult.projectRef, databaseResult.password, databaseUrlMode, poolerHost.trim())
    : "";

  const refreshStatus = useCallback(async () => {
    try {
      const next = await invoke<SupabaseStatusDto>("supabase_status", { integrationId });
      setStatus(next);
    } catch {
      setStatus({ linked: false });
    }
  }, [integrationId]);

  const refreshProjects = useCallback(async () => {
    try {
      const list = await invoke<SupabaseProjectRow[]>("supabase_list_projects", { integrationId });
      setProjects(list);
      setSelectedProject((current) =>
        current && list.some((project) => project.reference === current.reference) ? current : list[0] ?? null,
      );
      setError(null);
    } catch (e) {
      setProjects([]);
      setSelectedProject(null);
      setError(errText(e));
    }
  }, [integrationId]);

  const refreshVercelProjects = useCallback(async () => {
    if (!vercelIntegration) {
      setVercelProjects([]);
      setSelectedVercelProjectId("");
      return;
    }
    try {
      const list = await invoke<VercelProjectRow[]>("vercel_list_projects", {
        integrationId: vercelIntegration.id,
      });
      setVercelProjects(list);
      setSelectedVercelProjectId((current) =>
        current && list.some((project) => project.id === current) ? current : list[0]?.id || "",
      );
    } catch {
      setVercelProjects([]);
      setSelectedVercelProjectId("");
    }
  }, [vercelIntegration]);

  const refreshSecrets = useCallback(
    async (project: SupabaseProjectRow | null) => {
      if (!project) {
        setSecrets([]);
        return;
      }
      try {
        const list = await invoke<SupabaseSecretRow[]>("supabase_list_project_secrets", {
          integrationId,
          projectRef: project.reference,
        });
        setSecrets(list);
        const preferred =
          list.find((secret) => secret.name.toUpperCase().includes("TURNSTILE"))?.name ??
          list[0]?.name ??
          "TURNSTILE_SECRET_KEY";
        setSecretName(preferred);
        setSelectedSecretNames((current) =>
          current.length > 0 && current.every((name) => list.some((secret) => secret.name === name))
            ? current
            : list.length > 0
              ? [preferred]
              : [],
        );
      } catch (e) {
        setSecrets([]);
        setSelectedSecretNames([]);
        setError(errText(e));
      }
    },
    [integrationId],
  );

  const refreshApiKeys = useCallback(
    async (project: SupabaseProjectRow | null) => {
      if (!project) {
        setApiKeys([]);
        return;
      }
      try {
        const list = await invoke<SupabaseApiKeyRow[]>("supabase_list_project_api_keys", {
          integrationId,
          projectRef: project.reference,
        });
        setApiKeys(list);
      } catch (e) {
        setApiKeys([]);
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
    if (linked) void refreshSecrets(selectedProject);
    if (linked) void refreshApiKeys(selectedProject);
  }, [linked, selectedProject, refreshSecrets, refreshApiKeys]);

  useEffect(() => {
    if (selectedProject) {
      setPoolerHost(defaultPoolerHost(selectedProject.region));
    }
  }, [selectedProject]);

  useEffect(() => {
    if ((apiKeyResult || databaseResult) && vercelIntegration) {
      void refreshVercelProjects();
    }
  }, [apiKeyResult, databaseResult, vercelIntegration, refreshVercelProjects]);

  async function handleLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const next = await invoke<SupabaseStatusDto>("supabase_link", {
        integrationId,
        accessToken: accessToken.trim(),
      });
      setStatus(next);
      setAccessToken("");
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
      await invoke("supabase_unlink", { integrationId });
      setStatus({ linked: false });
      setProjects([]);
      setSecrets([]);
      setApiKeys([]);
      setSelectedProject(null);
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  async function upsertSecret() {
    if (!selectedProject) return;
    const names = selectedSecretNames.length > 0 ? selectedSecretNames : [secretName.trim()].filter(Boolean);
    setBusy(true);
    setError(null);
    setHint(null);
    try {
      await invoke("supabase_upsert_project_secrets", {
        payload: {
          integrationId,
          projectRef: selectedProject.reference,
          projectName: selectedProject.name,
          names,
          value: secretValue,
        },
      });
      setHint(`${names.length} secret aggiornati in ${selectedProject.name}.`);
      setSecretValue("");
      await refreshSecrets(selectedProject);
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  async function rotateApiKey(key: SupabaseApiKeyRow) {
    if (!selectedProject) return;
    setApiKeyBusyId(key.id);
    setError(null);
    setApiKeyResult(null);
    setApiKeyCopyHint(null);
    try {
      const result = await invoke<SupabaseApiKeyRotateResult>("supabase_rotate_project_api_key", {
        payload: {
          integrationId,
          projectRef: selectedProject.reference,
          keyId: key.id,
          deleteOld: deleteOldApiKey,
        },
      });
      setApiKeyResult(result);
      await refreshApiKeys(selectedProject);
    } catch (err) {
      setError(errText(err));
    } finally {
      setApiKeyBusyId(null);
    }
  }

  async function copyApiKeyResult() {
    if (!apiKeyResult) return;
    try {
      await copySensitiveWithAutoClear(apiKeyResult.apiKey);
      setApiKeyCopyHint("Copiata negli appunti temporanei.");
    } catch (err) {
      setError(errText(err));
    }
  }

  async function rotateDatabasePassword() {
    if (!selectedProject) return;
    setDatabaseBusy(true);
    setError(null);
    setDatabaseResult(null);
    setDatabaseCopyHint(null);
    try {
      const result = await invoke<SupabaseDatabasePasswordRotateResult>("supabase_rotate_database_password", {
        payload: {
          integrationId,
          projectRef: selectedProject.reference,
          confirmProjectRef: databaseConfirmRef.trim(),
        },
      });
      setDatabaseResult(result);
      setDatabaseConfirmRef("");
    } catch (err) {
      setError(errText(err));
    } finally {
      setDatabaseBusy(false);
    }
  }

  async function copyDatabaseUrl() {
    if (!databaseResult) return;
    try {
      await copySensitiveWithAutoClear(selectedDatabaseUrl);
      setDatabaseCopyHint("DATABASE_URL copiata negli appunti temporanei.");
    } catch (err) {
      setError(errText(err));
    }
  }

  async function updateVercelDatabaseUrl() {
    if (!databaseResult || !vercelIntegration) return;
    const project = vercelProjects.find((item) => item.id === selectedVercelProjectId);
    const key = databaseVercelEnvKey.trim();
    if (!project || !key || !selectedDatabaseUrl) return;
    setVercelBusy(true);
    setVercelHint(null);
    setError(null);
    try {
      await invoke("vercel_upsert_project_env", {
        payload: {
          integrationId: vercelIntegration.id,
          projectId: project.id,
          projectName: project.name,
          key,
          value: selectedDatabaseUrl,
          targets: vercelTargets,
        },
      });
      setVercelHint(`Env ${key} aggiornata in Vercel (${project.name}).`);
    } catch (err) {
      setError(errText(err));
    } finally {
      setVercelBusy(false);
    }
  }

  async function updateVercelApiKey() {
    if (!apiKeyResult || !vercelIntegration) return;
    const project = vercelProjects.find((item) => item.id === selectedVercelProjectId);
    const key = apiKeyVercelEnvKey.trim();
    if (!project || !key) return;
    setVercelBusy(true);
    setApiKeyVercelHint(null);
    setError(null);
    try {
      await invoke("vercel_upsert_project_env", {
        payload: {
          integrationId: vercelIntegration.id,
          projectId: project.id,
          projectName: project.name,
          key,
          value: apiKeyResult.apiKey,
          targets: vercelTargets,
        },
      });
      setApiKeyVercelHint(`Env ${key} aggiornata in Vercel (${project.name}).`);
    } catch (err) {
      setError(errText(err));
    } finally {
      setVercelBusy(false);
    }
  }

  function toggleVercelTarget(target: DeployTarget) {
    setVercelTargets((current) =>
      current.includes(target) ? current.filter((item) => item !== target) : [...current, target],
    );
  }

  async function copyDatabasePassword() {
    if (!databaseResult) return;
    try {
      await copySensitiveWithAutoClear(databaseResult.password);
      setDatabaseCopyHint("Password copiata negli appunti temporanei.");
    } catch (err) {
      setError(errText(err));
    }
  }

  function toggleSecretName(name: string) {
    setSelectedSecretNames((current) =>
      current.includes(name) ? current.filter((item) => item !== name) : [...current, name],
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-auto px-10 py-10">
      <ProviderHeader
        providerLabel="SUPABASE"
        title={integration.label}
        description="Collega un Personal Access Token Supabase per ruotare API key e aggiornare secret Edge Functions."
        backLabel="← Torna ai servizi"
        onBack={onBack}
      />

      <AlertMessage message={error} />

      {!linked ? (
        <form onSubmit={(e) => void handleLink(e)} className="max-w-xl space-y-4 rounded-2xl border border-surface-3/80 bg-surface-1/80 p-6">
          <div>
            <h2 className="text-sm font-semibold text-ink">Collega Supabase</h2>
            <p className="mt-1 text-xs text-ink-muted">
              Crea un Personal Access Token con accesso ai progetti e ai secret Edge Functions.
            </p>
          </div>
          <CredentialGuide
            steps={[
              "Apri Supabase Account → Access Tokens e crea un Personal Access Token dedicato a Rotate.",
              "Il token deve poter leggere i progetti, leggere/scrivere API key e leggere/scrivere i secret delle Edge Functions.",
              "Le API key vengono generate da Supabase; Rotate mostra il nuovo valore una sola volta.",
              "I secret Edge Functions non generano valori: ricevono valori prodotti da un'altra rotazione o incollati esplicitamente.",
            ]}
            links={[
              { href: "https://supabase.com/docs/reference/api/introduction", label: "Management API" },
              { href: "https://supabase.com/dashboard/account/tokens", label: "Crea token Supabase" },
              { href: "https://supabase.com/docs/guides/functions/secrets", label: "Edge Function secrets" },
            ]}
          />
          <label className="block space-y-1.5 text-xs font-semibold text-ink-muted">
            <span>Personal Access Token</span>
            <input
              type="password"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 font-mono text-sm font-normal text-ink outline-none ring-accent/40 focus:ring-2"
              autoComplete="off"
            />
          </label>
          <button type="submit" disabled={busy} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-surface-0 disabled:opacity-50">
            {busy ? "Verifica..." : "Collega account"}
          </button>
        </form>
      ) : !initialLoadComplete || resourcesLoading ? (
        <ProviderLoadingPanel
          title="Caricamento Supabase"
          description="Sto scaricando progetti e secret disponibili."
        />
      ) : (
        <div className="space-y-6">
          <LinkedAccountBar
            details={
              <>
                <p className="text-xs text-ink-muted">Account collegato</p>
                <p className="text-sm text-ink">Personal Access Token verificato</p>
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
            <div>
              <h2 className="text-sm font-semibold text-ink">Secret Edge Functions</h2>
              <p className="mt-1 text-xs text-ink-muted">
                Seleziona uno o più secret dall'elenco e aggiornali insieme con un valore esterno. Supabase non genera questi valori: li conserva.
              </p>
            </div>
            <div className="grid gap-4 lg:grid-cols-[minmax(260px,360px)_1fr]">
              <div className="space-y-3">
                <label className="block space-y-1.5 text-xs font-semibold text-ink-muted">
                  <span>Progetto</span>
                  <select
                    value={selectedProject?.reference ?? ""}
                    onChange={(e) => setSelectedProject(projects.find((project) => project.reference === e.target.value) ?? null)}
                    className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 text-sm font-normal text-ink outline-none ring-accent/40 focus:ring-2"
                  >
                    {projects.length === 0 ? (
                      <option value="">Nessun progetto rilevato</option>
                    ) : (
                      projects.map((project) => (
                        <option key={project.reference} value={project.reference}>{project.name}</option>
                      ))
                    )}
                  </select>
                  {selectedProject ? (
                    <span className="block font-mono text-[11px] font-normal text-ink-muted">
                      {selectedProject.reference}
                    </span>
                  ) : null}
                </label>
                <label className="block space-y-1.5 text-xs font-semibold text-ink-muted">
                  <span>Secret non in elenco</span>
                  <input
                    value={secretName}
                    onChange={(e) => setSecretName(e.target.value)}
                    className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 font-mono text-sm font-normal text-ink outline-none ring-accent/40 focus:ring-2"
                    list="supabase-secret-options"
                    autoComplete="off"
                  />
                  <datalist id="supabase-secret-options">
                    {secrets.map((secret) => <option key={secret.name} value={secret.name} />)}
                  </datalist>
                  <span className="block font-normal text-ink-muted">
                    Usa questo campo solo per creare una nuova voce; per ruotare/aggiornare scegli dall'elenco.
                  </span>
                </label>
                <label className="block space-y-1.5 text-xs font-semibold text-ink-muted">
                  <span>Valore esterno</span>
                  <input
                    type="password"
                    value={secretValue}
                    onChange={(e) => setSecretValue(e.target.value)}
                    className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 font-mono text-sm font-normal text-ink outline-none ring-accent/40 focus:ring-2"
                    autoComplete="off"
                  />
                </label>
                {hint ? <p className="text-xs text-accent">{hint}</p> : null}
                <button type="button" disabled={busy || !selectedProject || (selectedSecretNames.length === 0 && !secretName.trim()) || !secretValue} onClick={() => void upsertSecret()} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-surface-0 disabled:opacity-50">
                  {busy ? "Aggiornamento..." : "Aggiorna selezionati"}
                </button>
              </div>
              <div className="overflow-hidden rounded-xl border border-surface-3/80">
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface-2/80 text-[11px] uppercase tracking-wide text-ink-muted">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Usa</th>
                      <th className="px-4 py-3 font-semibold">Nome</th>
                      <th className="px-4 py-3 font-semibold">Aggiornato</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-3/60 bg-surface-1/40">
                    {secrets.length === 0 ? (
                      <tr><td colSpan={3} className="px-4 py-5 text-center text-ink-muted">Nessun secret rilevato.</td></tr>
                    ) : (
                      secrets.map((secret) => (
                        <tr key={secret.name} className="text-ink">
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={selectedSecretNames.includes(secret.name)}
                              onChange={() => toggleSecretName(secret.name)}
                            />
                          </td>
                          <td className="px-4 py-3 font-mono text-xs">{secret.name}</td>
                          <td className="px-4 py-3 text-xs text-ink-muted">{secret.updatedAt ?? "-"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
          <section className="space-y-3 rounded-2xl border border-surface-3/80 bg-surface-1/60 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-ink">API key Supabase</h2>
                <p className="mt-1 text-xs text-ink-muted">
                  Qui la nuova chiave viene generata da Supabase. Rotate la mostra una sola volta.
                </p>
              </div>
              <label className="flex items-center gap-2 rounded-lg border border-surface-3 px-3 py-1.5 text-xs text-ink-muted">
                <input
                  type="checkbox"
                  checked={deleteOldApiKey}
                  onChange={(e) => setDeleteOldApiKey(e.target.checked)}
                />
                <span>Elimina subito la vecchia key</span>
              </label>
            </div>
            <div className="overflow-hidden rounded-xl border border-surface-3/80">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-2/80 text-[11px] uppercase tracking-wide text-ink-muted">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Nome</th>
                    <th className="px-4 py-3 font-semibold">Tipo</th>
                    <th className="px-4 py-3 font-semibold">Prefix</th>
                    <th className="px-4 py-3 font-semibold">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-3/60 bg-surface-1/40">
                  {apiKeys.length === 0 ? (
                    <tr><td colSpan={4} className="px-4 py-5 text-center text-ink-muted">Nessuna API key rilevata.</td></tr>
                  ) : (
                    apiKeys.map((key) => {
                      const canRotate = key.keyType === "publishable" || key.keyType === "secret";
                      return (
                        <tr key={key.id} className="text-ink">
                          <td className="px-4 py-3 font-medium">{key.name}</td>
                          <td className="px-4 py-3 text-xs text-ink-muted">{key.keyType}</td>
                          <td className="px-4 py-3 font-mono text-xs text-ink-muted">{key.prefix ?? "-"}</td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              disabled={!canRotate || apiKeyBusyId === key.id}
                              onClick={() => void rotateApiKey(key)}
                              className="rounded-lg border border-accent/50 px-2.5 py-1 text-xs font-medium text-accent hover:bg-accent/10 disabled:opacity-50"
                            >
                              {apiKeyBusyId === key.id ? "Rotazione..." : "Ruota"}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
          <section className="space-y-3 rounded-2xl border border-rose-500/25 bg-rose-500/5 p-5">
            <div>
              <h2 className="text-sm font-semibold text-rose-100">Password database Postgres</h2>
              <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                Ruota la password dell'utente Postgres principale e genera una nuova `DATABASE_URL` diretta. Supabase aggiorna i servizi gestiti, ma i tuoi servizi esterni devono essere aggiornati subito.
              </p>
            </div>
            {selectedProject ? (
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <label className="block space-y-1.5 text-xs font-semibold text-ink-muted">
                  <span>Conferma project ref</span>
                  <input
                    value={databaseConfirmRef}
                    onChange={(e) => setDatabaseConfirmRef(e.target.value)}
                    className="w-full rounded-lg border border-rose-500/30 bg-surface-0 px-3 py-2 font-mono text-sm font-normal text-ink outline-none ring-rose-400/40 focus:ring-2"
                    placeholder={selectedProject.reference}
                    autoComplete="off"
                  />
                </label>
                <div className="flex items-end">
                  <button
                    type="button"
                    disabled={databaseBusy || databaseConfirmRef.trim() !== selectedProject.reference}
                    onClick={() => void rotateDatabasePassword()}
                    className="rounded-lg border border-rose-500/50 px-3 py-2 text-sm font-semibold text-rose-100 hover:bg-rose-500/10 disabled:opacity-50"
                  >
                    {databaseBusy ? "Rotazione..." : "Ruota password DB"}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-ink-muted">Seleziona un progetto prima di ruotare la password database.</p>
            )}
          </section>
        </div>
      )}

      {apiKeyResult ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-amber-500/30 bg-surface-1 p-6 shadow-2xl">
            <h3 className="text-sm font-semibold text-amber-100">Nuova API key Supabase</h3>
            <p className="mt-1 text-xs text-ink-muted">
              Supabase mostra questo valore solo ora. Aggiorna i servizi che usavano la key precedente.
            </p>
            <p className="mt-3 text-sm text-ink">{apiKeyResult.name}</p>
              <p className="font-mono text-[11px] text-ink-muted">Tipo: {apiKeyResult.keyType}</p>
              <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-surface-0 p-3 font-mono text-xs text-ink">
                {apiKeyResult.apiKey}
              </pre>
            {vercelIntegration ? (
              <VercelEnvWriter
                title="Aggiorna Vercel env"
                description="Scrive la nuova API key Supabase negli env del progetto."
                projects={vercelProjects}
                selectedProjectId={selectedVercelProjectId}
                envKey={apiKeyVercelEnvKey}
                targets={vercelTargets}
                busy={vercelBusy}
                hint={apiKeyVercelHint}
                emptyMessage="Nessun progetto Vercel"
                onRefreshProjects={() => void refreshVercelProjects()}
                onSelectProject={(projectId) => {
                  setSelectedVercelProjectId(projectId);
                  setApiKeyVercelHint(null);
                }}
                onChangeEnvKey={(key) => {
                  setApiKeyVercelEnvKey(key);
                  setApiKeyVercelHint(null);
                }}
                onToggleTarget={toggleVercelTarget}
                onWrite={() => void updateVercelApiKey()}
              />
            ) : (
              <p className="mt-3 rounded-xl border border-surface-3/80 bg-surface-0/50 p-3 text-xs text-ink-muted">
                Collega Vercel da Esplora per scrivere questa API key direttamente negli env del progetto.
              </p>
            )}
            {apiKeyCopyHint ? <p className="mt-2 text-xs text-accent">{apiKeyCopyHint}</p> : null}
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => void copyApiKeyResult()}
                className="rounded-lg border border-surface-3 px-3 py-1.5 text-sm text-ink hover:border-accent/40"
              >
                Copia key
              </button>
              <button
                type="button"
                onClick={() => {
                  setApiKeyResult(null);
                  setApiKeyCopyHint(null);
                }}
                className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-surface-0"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {databaseResult ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="max-h-[88vh] w-full max-w-3xl overflow-auto rounded-2xl border border-rose-500/30 bg-surface-1 p-6 shadow-2xl">
            <h3 className="text-sm font-semibold text-rose-100">Nuova DATABASE_URL</h3>
            <p className="mt-1 text-xs text-ink-muted">
              Aggiorna subito pool, backend e deploy che usano la vecchia password. Rotate non salva questi valori.
            </p>
            <p className="mt-3 font-mono text-[11px] text-ink-muted">Project ref: {databaseResult.projectRef}</p>
            <div className="mt-4 grid gap-3 rounded-xl border border-surface-3/80 bg-surface-0/50 p-4 sm:grid-cols-[220px_1fr]">
              <label className="space-y-1.5 text-xs font-semibold text-ink-muted">
                <span>Tipo connessione</span>
                <select
                  value={databaseUrlMode}
                  onChange={(e) => setDatabaseUrlMode(e.target.value as DatabaseUrlMode)}
                  className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 text-sm font-normal text-ink outline-none ring-accent/40 focus:ring-2"
                >
                  <option value="direct">Direct connection</option>
                  <option value="transaction">Transaction pooler</option>
                  <option value="session">Session pooler</option>
                </select>
              </label>
              <label className="space-y-1.5 text-xs font-semibold text-ink-muted">
                <span>Pooler host</span>
                <input
                  value={poolerHost}
                  onChange={(e) => setPoolerHost(e.target.value)}
                  disabled={databaseUrlMode === "direct"}
                  className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 font-mono text-sm font-normal text-ink outline-none ring-accent/40 focus:ring-2 disabled:opacity-50"
                  autoComplete="off"
                />
              </label>
            </div>
            <pre className="mt-3 max-h-44 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-surface-0 p-3 font-mono text-xs text-ink">
              {selectedDatabaseUrl}
            </pre>
            {vercelIntegration ? (
              <VercelEnvWriter
                title="Aggiorna Vercel env"
                description="Scrive la DATABASE_URL selezionata nei target del progetto."
                projects={vercelProjects}
                selectedProjectId={selectedVercelProjectId}
                envKey={databaseVercelEnvKey}
                targets={vercelTargets}
                busy={vercelBusy}
                hint={vercelHint}
                emptyMessage="Nessun progetto Vercel"
                onRefreshProjects={() => void refreshVercelProjects()}
                onSelectProject={(projectId) => {
                  setSelectedVercelProjectId(projectId);
                  setVercelHint(null);
                }}
                onChangeEnvKey={(key) => {
                  setDatabaseVercelEnvKey(key);
                  setVercelHint(null);
                }}
                onToggleTarget={toggleVercelTarget}
                onWrite={() => void updateVercelDatabaseUrl()}
              />
            ) : (
              <p className="mt-3 rounded-xl border border-surface-3/80 bg-surface-0/50 p-3 text-xs text-ink-muted">
                Collega Vercel da Esplora per scrivere questa DATABASE_URL direttamente negli env del progetto.
              </p>
            )}
            <details className="mt-3 rounded-lg border border-surface-3/80 bg-surface-0/50 p-3">
              <summary className="cursor-pointer text-xs font-semibold text-ink-muted">Mostra solo password</summary>
              <pre className="mt-2 overflow-auto whitespace-pre-wrap break-all font-mono text-xs text-ink">
                {databaseResult.password}
              </pre>
            </details>
            {databaseCopyHint ? <p className="mt-2 text-xs text-accent">{databaseCopyHint}</p> : null}
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => void copyDatabasePassword()}
                className="rounded-lg border border-surface-3 px-3 py-1.5 text-sm text-ink hover:border-accent/40"
              >
                Copia password
              </button>
              <button
                type="button"
                onClick={() => void copyDatabaseUrl()}
                className="rounded-lg border border-surface-3 px-3 py-1.5 text-sm text-ink hover:border-accent/40"
              >
                Copia DATABASE_URL
              </button>
              <button
                type="button"
                onClick={() => {
                  setDatabaseResult(null);
                  setDatabaseCopyHint(null);
                }}
                className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-surface-0"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
