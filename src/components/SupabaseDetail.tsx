import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { copySensitiveWithAutoClear } from "../clipboardSecure";
import type {
  Integration,
  SupabaseApiKeyRotateResult,
  SupabaseApiKeyRow,
  SupabaseDatabasePasswordRotateResult,
  SupabaseProjectRow,
  SupabaseSecretRow,
  SupabaseStatusDto,
} from "../types";
import { AlertMessage } from "./provider/AlertMessage";
import { CredentialGuide } from "./provider/CredentialGuide";
import { DestructiveToggle } from "./provider/DestructiveToggle";
import { LinkedAccountBar } from "./provider/LinkedAccountBar";
import { ProviderHeader } from "./provider/ProviderHeader";
import { ProviderLoadingPanel } from "./provider/ProviderLoadingPanel";
import { SecretPropagationModal } from "./provider/SecretPropagationModal";
import { errText } from "./provider/errors";
import { useSecretPropagation } from "./provider/useSecretPropagation";

type Props = {
  integration: Integration;
  integrations?: Integration[];
  onBack: () => void;
};

type DatabaseUrlMode = "direct" | "transaction" | "session";

const MANAGED_SUPABASE_SECRET_NAMES = new Set([
  "DATABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_DB_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
]);

function defaultApiKeyEnvKey(keyType: string | null | undefined): string {
  return keyType === "publishable" ? "SUPABASE_ANON_KEY" : "SUPABASE_SERVICE_ROLE_KEY";
}

function isManagedSupabaseSecret(name: string): boolean {
  return MANAGED_SUPABASE_SECRET_NAMES.has(name.trim().toUpperCase());
}

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
  const { t } = useTranslation();
  const [status, setStatus] = useState<SupabaseStatusDto | null>(null);
  const [accessToken, setAccessToken] = useState("");
  const [projects, setProjects] = useState<SupabaseProjectRow[]>([]);
  const [secrets, setSecrets] = useState<SupabaseSecretRow[]>([]);
  const [apiKeys, setApiKeys] = useState<SupabaseApiKeyRow[]>([]);
  const [selectedProject, setSelectedProject] = useState<SupabaseProjectRow | null>(null);
  const [secretName, setSecretName] = useState("");
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
  const [apiKeyPropagationOpen, setApiKeyPropagationOpen] = useState(false);
  const [databasePropagationOpen, setDatabasePropagationOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [resourcesLoading, setResourcesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const integrationId = integration.id;
  const linked = status?.linked ?? false;
  const editableSecrets = secrets.filter((secret) => !isManagedSupabaseSecret(secret.name));
  const selectedDatabaseUrl = databaseResult
    ? buildDatabaseUrl(databaseResult.projectRef, databaseResult.password, databaseUrlMode, poolerHost.trim())
    : "";
  const handlePropagationError = useCallback((message: string) => setError(message), []);
  const apiKeyPropagation = useSecretPropagation({
    integrations,
    defaultEnvKey: defaultApiKeyEnvKey(apiKeyResult?.keyType),
    secretValue: apiKeyResult?.apiKey ?? "",
    onError: handlePropagationError,
  });
  const databasePropagation = useSecretPropagation({
    integrations,
    defaultEnvKey: "DATABASE_URL",
    secretValue: selectedDatabaseUrl,
    onError: handlePropagationError,
  });
  const apiKeyPropagationVercelIntegrationId = apiKeyPropagation.vercelIntegration?.id;
  const databasePropagationVercelIntegrationId = databasePropagation.vercelIntegration?.id;
  const refreshApiKeyPropagationVercelProjects = apiKeyPropagation.vercel.refreshProjects;
  const refreshDatabasePropagationVercelProjects = databasePropagation.vercel.refreshProjects;

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
        const editableList = list.filter((secret) => !isManagedSupabaseSecret(secret.name));
        const preferred =
          editableList.find((secret) => secret.name.toUpperCase().includes("TURNSTILE"))?.name ??
          editableList[0]?.name ??
          "TURNSTILE_SECRET_KEY";
        setSecretName("");
        setSelectedSecretNames((current) =>
          current.length > 0 && current.every((name) => editableList.some((secret) => secret.name === name))
            ? current
            : editableList.length > 0
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
    if (apiKeyResult && apiKeyPropagationVercelIntegrationId) {
      void refreshApiKeyPropagationVercelProjects();
    }
  }, [apiKeyResult, apiKeyPropagationVercelIntegrationId, refreshApiKeyPropagationVercelProjects]);

  useEffect(() => {
    if (databaseResult && databasePropagationVercelIntegrationId) {
      void refreshDatabasePropagationVercelProjects();
    }
  }, [databaseResult, databasePropagationVercelIntegrationId, refreshDatabasePropagationVercelProjects]);

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
    const manualSecretName = secretName.trim();
    const names = Array.from(
      new Set([
        ...selectedSecretNames,
        ...(manualSecretName ? [manualSecretName] : []),
      ]),
    );
    if (names.length === 0) return;
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
      setHint(t("supabase.customSecretsUpdated", { count: names.length, project: selectedProject.name }));
      setSecretName("");
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
      setApiKeyPropagationOpen(false);
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
      setApiKeyCopyHint(t("resend.copied"));
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
      setDatabasePropagationOpen(false);
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
      setDatabaseCopyHint(t("supabase.databaseUrlCopied"));
    } catch (err) {
      setError(errText(err));
    }
  }

  async function copyDatabasePassword() {
    if (!databaseResult) return;
    try {
      await copySensitiveWithAutoClear(databaseResult.password);
      setDatabaseCopyHint(t("supabase.passwordCopied"));
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
        description={t("supabase.description")}
        backLabel={t("common.backToServices")}
        onBack={onBack}
      />

      <AlertMessage message={error} />

      {!linked ? (
        <form onSubmit={(e) => void handleLink(e)} className="max-w-xl space-y-4 rounded-2xl border border-surface-3/80 bg-surface-1/80 p-6">
          <div>
            <h2 className="text-sm font-semibold text-ink">{t("supabase.connectTitle")}</h2>
            <p className="mt-1 text-xs text-ink-muted">
              {t("supabase.connectLead")}
            </p>
          </div>
          <CredentialGuide
            steps={[
              t("supabase.guide.step1"),
              t("supabase.guide.step2"),
              t("supabase.guide.step3"),
              t("supabase.guide.step4"),
            ]}
            links={[
              { href: "https://supabase.com/docs/reference/api/introduction", label: "Management API" },
              { href: "https://supabase.com/dashboard/account/tokens", label: t("supabase.links.token") },
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
            {busy ? t("common.verifying") : t("supabase.connectAccount")}
          </button>
        </form>
      ) : !initialLoadComplete || resourcesLoading ? (
        <ProviderLoadingPanel
          title={t("supabase.loadingTitle")}
          description={t("supabase.loadingDescription")}
        />
      ) : (
        <div className="flex flex-col gap-6">
          <LinkedAccountBar
            details={
              <>
                <p className="text-xs text-ink-muted">{t("common.linkedAccount")}</p>
                <p className="text-sm text-ink">{t("supabase.verifiedToken")}</p>
              </>
            }
            actions={
              <>
                <button type="button" disabled={busy} onClick={() => void refreshProjects()} className="rounded-lg border border-surface-3 px-3 py-1.5 text-sm text-ink hover:border-accent/40">
                  {t("propagation.refreshProjects")}
                </button>
                <button type="button" disabled={busy} onClick={() => void handleUnlink()} className="rounded-lg border border-rose-500/40 px-3 py-1.5 text-sm text-rose-200 hover:bg-rose-500/10">
                  {t("common.unlink")}
                </button>
              </>
            }
          />

          <section className="order-1 rounded-2xl border border-surface-3/80 bg-surface-1/60 p-5">
            <div className="grid gap-4 md:grid-cols-[1fr_minmax(260px,380px)] md:items-end">
              <div>
                <h2 className="text-sm font-semibold text-ink">Progetto Supabase</h2>
                <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                  Scegli il progetto su cui leggere e aggiornare Edge Function secrets, API key e password database.
                </p>
                {selectedProject ? (
                  <p className="mt-2 font-mono text-[11px] text-ink-muted">
                    {selectedProject.reference}
                  </p>
                ) : null}
              </div>
              <label className="block space-y-1.5 text-xs font-semibold text-ink-muted">
                <span>{t("propagation.project")}</span>
                <select
                  value={selectedProject?.reference ?? ""}
                  onChange={(e) => setSelectedProject(projects.find((project) => project.reference === e.target.value) ?? null)}
                  className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 text-sm font-normal text-ink outline-none ring-accent/40 focus:ring-2"
                >
                  {projects.length === 0 ? (
                    <option value="">{t("supabase.noProjects")}</option>
                  ) : (
                    projects.map((project) => (
                      <option key={project.reference} value={project.reference}>{project.name}</option>
                    ))
                  )}
                </select>
              </label>
            </div>
          </section>

          <section className="order-4 space-y-3 rounded-2xl border border-surface-3/80 bg-surface-1/60 p-5">
            <div>
              <h2 className="text-sm font-semibold text-ink">{t("supabase.customSecretsTitle")}</h2>
              <p className="mt-1 text-xs text-ink-muted">
                {t("supabase.customSecretsLead")}
              </p>
            </div>
            <div className="grid gap-4 lg:grid-cols-[1fr_minmax(260px,360px)]">
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{t("supabase.availableSecrets")}</h3>
                <div className="overflow-hidden rounded-xl border border-surface-3/80">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-surface-2/80 text-[11px] uppercase tracking-wide text-ink-muted">
                      <tr>
                        <th className="px-4 py-3 font-semibold">{t("supabase.colUpdate")}</th>
                        <th className="px-4 py-3 font-semibold">{t("resend.colName")}</th>
                        <th className="px-4 py-3 font-semibold">{t("supabase.colUpdated")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-3/60 bg-surface-1/40">
                      {editableSecrets.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-4 py-6 text-center">
                            <p className="text-sm text-ink-muted">{t("supabase.noCustomSecrets")}</p>
                            <p className="mt-1 text-xs text-ink-muted">
                              {t("supabase.noCustomSecretsLead")}
                            </p>
                          </td>
                        </tr>
                      ) : (
                        editableSecrets.map((secret) => (
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
              <div className="space-y-3 rounded-xl border border-surface-3/70 bg-surface-0/40 p-4">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{t("supabase.updateSecret")}</h3>
                  <p className="mt-1 text-xs text-ink-muted">
                    {t("supabase.updateSecretLead")}
                  </p>
                </div>
                <label className="block space-y-1.5 text-xs font-semibold text-ink-muted">
                  <span>{t("supabase.addManualSecret")}</span>
                  <input
                    value={secretName}
                    onChange={(e) => setSecretName(e.target.value)}
                    className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 font-mono text-sm font-normal text-ink outline-none ring-accent/40 focus:ring-2"
                    placeholder="es. TURNSTILE_SECRET_KEY"
                    autoComplete="off"
                  />
                  <span className="block font-normal text-ink-muted">
                    {t("supabase.manualSecretHint")}
                  </span>
                </label>
                <label className="block space-y-1.5 text-xs font-semibold text-ink-muted">
                  <span>{t("supabase.newValueToSave")}</span>
                  <input
                    type="password"
                    value={secretValue}
                    onChange={(e) => setSecretValue(e.target.value)}
                    className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 font-mono text-sm font-normal text-ink outline-none ring-accent/40 focus:ring-2"
                    autoComplete="off"
                  />
                  <span className="block font-normal text-ink-muted">
                    {t("supabase.externalValueHint")}
                  </span>
                </label>
                {hint ? <p className="text-xs text-accent">{hint}</p> : null}
                <button type="button" disabled={busy || !selectedProject || (selectedSecretNames.length === 0 && !secretName.trim()) || !secretValue} onClick={() => void upsertSecret()} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-surface-0 disabled:opacity-50">
                  {busy ? t("common.updating") : t("supabase.saveSecrets")}
                </button>
              </div>
            </div>
          </section>
          <section className="order-2 space-y-3 rounded-2xl border border-surface-3/80 bg-surface-1/60 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-ink">{t("supabase.apiKeysTitle")}</h2>
                <p className="mt-1 text-xs text-ink-muted">
                  {t("supabase.apiKeysLead")}
                </p>
              </div>
              <DestructiveToggle
                checked={deleteOldApiKey}
                title={t("resend.revokeOld")}
                description={t("resend.afterEnvUpdate")}
                onChange={setDeleteOldApiKey}
              />
            </div>
            <div className="overflow-hidden rounded-xl border border-surface-3/80">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-2/80 text-[11px] uppercase tracking-wide text-ink-muted">
                  <tr>
                    <th className="px-4 py-3 font-semibold">{t("resend.colName")}</th>
                    <th className="px-4 py-3 font-semibold">{t("vercel.colType")}</th>
                    <th className="px-4 py-3 font-semibold">Prefix</th>
                    <th className="px-4 py-3 font-semibold">{t("resend.colActions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-3/60 bg-surface-1/40">
                  {apiKeys.length === 0 ? (
                    <tr><td colSpan={4} className="px-4 py-5 text-center text-ink-muted">{t("supabase.noApiKeys")}</td></tr>
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
                              {apiKeyBusyId === key.id ? t("supabase.rotating") : t("resend.rotate")}
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
          <section className="order-3 space-y-3 rounded-2xl border border-rose-500/25 bg-rose-500/5 p-5">
            <div>
              <h2 className="text-sm font-semibold text-rose-100">{t("supabase.databasePasswordTitle")}</h2>
              <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                {t("supabase.databasePasswordLead")}
              </p>
            </div>
            {selectedProject ? (
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <label className="block space-y-1.5 text-xs font-semibold text-ink-muted">
                  <span>{t("supabase.confirmProjectRef")}</span>
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
                    {databaseBusy ? t("supabase.rotating") : t("supabase.rotateDatabasePassword")}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-ink-muted">{t("supabase.selectProjectForDb")}</p>
            )}
          </section>
        </div>
      )}

      {apiKeyResult ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-amber-500/30 bg-surface-1 p-6 shadow-2xl">
            <h3 className="text-sm font-semibold text-amber-100">{t("supabase.apiKeyResultTitle")}</h3>
            <p className="mt-1 text-xs text-ink-muted">
              {t("supabase.apiKeyResultLead")}
            </p>
            <p className="mt-3 text-sm text-ink">{apiKeyResult.name}</p>
              <p className="font-mono text-[11px] text-ink-muted">{t("vercel.colType")}: {apiKeyResult.keyType}</p>
              <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-surface-0 p-3 font-mono text-xs text-ink">
                {apiKeyResult.apiKey}
              </pre>
            {apiKeyCopyHint ? <p className="mt-2 text-xs text-accent">{apiKeyCopyHint}</p> : null}
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setApiKeyPropagationOpen(true)}
                className="rounded-lg border border-accent/50 px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent/10"
              >
                {t("resend.propagateKey")}
              </button>
              <button
                type="button"
                onClick={() => void copyApiKeyResult()}
                className="rounded-lg border border-surface-3 px-3 py-1.5 text-sm text-ink hover:border-accent/40"
              >
                {t("resend.copyKey")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setApiKeyResult(null);
                  setApiKeyCopyHint(null);
                }}
                className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-surface-0"
              >
                {t("common.close")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {databaseResult ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="max-h-[88vh] w-full max-w-3xl overflow-auto rounded-2xl border border-rose-500/30 bg-surface-1 p-6 shadow-2xl">
            <h3 className="text-sm font-semibold text-rose-100">{t("supabase.databaseUrlResultTitle")}</h3>
            <p className="mt-1 text-xs text-ink-muted">
              {t("supabase.databaseUrlResultLead")}
            </p>
            <p className="mt-3 font-mono text-[11px] text-ink-muted">Project ref: {databaseResult.projectRef}</p>
            <div className="mt-4 grid gap-3 rounded-xl border border-surface-3/80 bg-surface-0/50 p-4 sm:grid-cols-[220px_1fr]">
              <label className="space-y-1.5 text-xs font-semibold text-ink-muted">
                <span>{t("supabase.connectionType")}</span>
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
            <details className="mt-3 rounded-lg border border-surface-3/80 bg-surface-0/50 p-3">
              <summary className="cursor-pointer text-xs font-semibold text-ink-muted">{t("supabase.showPasswordOnly")}</summary>
              <pre className="mt-2 overflow-auto whitespace-pre-wrap break-all font-mono text-xs text-ink">
                {databaseResult.password}
              </pre>
            </details>
            {databaseCopyHint ? <p className="mt-2 text-xs text-accent">{databaseCopyHint}</p> : null}
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setDatabasePropagationOpen(true)}
                className="rounded-lg border border-accent/50 px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent/10"
              >
                {t("supabase.propagateDatabaseUrl")}
              </button>
              <button
                type="button"
                onClick={() => void copyDatabasePassword()}
                className="rounded-lg border border-surface-3 px-3 py-1.5 text-sm text-ink hover:border-accent/40"
              >
                {t("supabase.copyPassword")}
              </button>
              <button
                type="button"
                onClick={() => void copyDatabaseUrl()}
                className="rounded-lg border border-surface-3 px-3 py-1.5 text-sm text-ink hover:border-accent/40"
              >
                {t("supabase.copyDatabaseUrl")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDatabaseResult(null);
                  setDatabaseCopyHint(null);
                }}
                className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-surface-0"
              >
                {t("common.close")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {apiKeyResult ? (
        <SecretPropagationModal
          open={apiKeyPropagationOpen}
          valueLabel={t("supabase.apiKeyValueLabel")}
          state={apiKeyPropagation}
          onClose={() => setApiKeyPropagationOpen(false)}
        />
      ) : null}
      {databaseResult ? (
        <SecretPropagationModal
          open={databasePropagationOpen}
          valueLabel={t("supabase.databaseUrlValueLabel")}
          state={databasePropagation}
          onClose={() => setDatabasePropagationOpen(false)}
        />
      ) : null}
    </div>
  );
}
