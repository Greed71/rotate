import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { copySensitiveWithAutoClear } from "../clipboardSecure";
import type { DeployTarget } from "../secretDestinations";
import { AlertMessage } from "./provider/AlertMessage";
import { CredentialGuide } from "./provider/CredentialGuide";
import { DeployTargetsPicker } from "./provider/DeployTargetsPicker";
import { LinkedAccountBar } from "./provider/LinkedAccountBar";
import { ProviderHeader } from "./provider/ProviderHeader";
import { ProviderLoadingPanel } from "./provider/ProviderLoadingPanel";
import { AccessServiceTokensSection } from "./cloudflare/AccessServiceTokensSection";
import { PagesSecretsSection } from "./cloudflare/PagesSecretsSection";
import { SecretsStoreSection } from "./cloudflare/SecretsStoreSection";
import { TurnstileSection } from "./cloudflare/TurnstileSection";
import { WorkersSecretsSection } from "./cloudflare/WorkersSecretsSection";
import type {
  AccessServiceTokenRotateResult,
  AccessServiceTokenRow,
  CfTokenRow,
  CloudflareRotateResultDto,
  CloudflareStatusDto,
  Integration,
  ManagedSecretDto,
  PagesProjectRow,
  SecretStorageDiagnosticsDto,
  SecretsStoreRow,
  SecretsStoreSecretRow,
  SupabaseProjectRow,
  SupabaseSecretRow,
  TurnstileRotateResult,
  TurnstileWidgetRow,
  VercelProjectRow,
  WorkerScriptRow,
  WorkerSecretRow,
} from "../types";

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

export function CloudflareDetail({ integration, integrations = [], onBack }: Props) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<CloudflareStatusDto | null>(null);
  const [tokens, setTokens] = useState<CfTokenRow[]>([]);
  const [turnstileWidgets, setTurnstileWidgets] = useState<TurnstileWidgetRow[]>([]);
  const [accessServiceTokens, setAccessServiceTokens] = useState<AccessServiceTokenRow[]>([]);
  const [accessTarget, setAccessTarget] = useState<AccessServiceTokenRow | null>(null);
  const [accessBusyId, setAccessBusyId] = useState<string | null>(null);
  const [accessResult, setAccessResult] = useState<AccessServiceTokenRotateResult | null>(null);
  const [accessCopyHint, setAccessCopyHint] = useState<string | null>(null);
  const [workerScripts, setWorkerScripts] = useState<WorkerScriptRow[]>([]);
  const [workerSecrets, setWorkerSecrets] = useState<WorkerSecretRow[]>([]);
  const [selectedWorker, setSelectedWorker] = useState("");
  const [workerSecretName, setWorkerSecretName] = useState("TURNSTILE_SECRET_KEY");
  const [workerUpdateHint, setWorkerUpdateHint] = useState<string | null>(null);
  const [workerBusy, setWorkerBusy] = useState(false);
  const [pagesProjects, setPagesProjects] = useState<PagesProjectRow[]>([]);
  const [selectedPagesProject, setSelectedPagesProject] = useState("");
  const [pagesEnvironment, setPagesEnvironment] = useState<"production" | "preview">("production");
  const [pagesSecretName, setPagesSecretName] = useState("TURNSTILE_SECRET_KEY");
  const [pagesBusy, setPagesBusy] = useState(false);
  const [pagesUpdateHint, setPagesUpdateHint] = useState<string | null>(null);
  const [secretsStores, setSecretsStores] = useState<SecretsStoreRow[]>([]);
  const [secretsStoreSecrets, setSecretsStoreSecrets] = useState<SecretsStoreSecretRow[]>([]);
  const [selectedSecretsStore, setSelectedSecretsStore] = useState("");
  const [secretsStoreSecretId, setSecretsStoreSecretId] = useState("");
  const [secretsStoreSecretName, setSecretsStoreSecretName] = useState("TURNSTILE_SECRET_KEY");
  const [secretsStoreScopes, setSecretsStoreScopes] = useState("workers");
  const [secretsStoreBusy, setSecretsStoreBusy] = useState(false);
  const [secretsStoreUpdateHint, setSecretsStoreUpdateHint] = useState<string | null>(null);
  const [vercelProjects, setVercelProjects] = useState<VercelProjectRow[]>([]);
  const [selectedVercelProjectId, setSelectedVercelProjectId] = useState("");
  const [vercelEnvKey, setVercelEnvKey] = useState("TURNSTILE_SECRET_KEY");
  const [vercelTargets, setVercelTargets] = useState(["production"]);
  const [vercelBusy, setVercelBusy] = useState(false);
  const [vercelUpdateHint, setVercelUpdateHint] = useState<string | null>(null);
  const [supabaseProjects, setSupabaseProjects] = useState<SupabaseProjectRow[]>([]);
  const [supabaseSecrets, setSupabaseSecrets] = useState<SupabaseSecretRow[]>([]);
  const [selectedSupabaseProjectRef, setSelectedSupabaseProjectRef] = useState("");
  const [supabaseSecretName, setSupabaseSecretName] = useState("TURNSTILE_SECRET_KEY");
  const [selectedSupabaseSecretNames, setSelectedSupabaseSecretNames] = useState<string[]>([]);
  const [supabaseBusy, setSupabaseBusy] = useState(false);
  const [supabaseUpdateHint, setSupabaseUpdateHint] = useState<string | null>(null);
  const [managedSecrets, setManagedSecrets] = useState<ManagedSecretDto[]>([]);
  const [accountId, setAccountId] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [manualTokenId, setManualTokenId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmRevealOpen, setConfirmRevealOpen] = useState(false);
  const [confirmUnlinkOpen, setConfirmUnlinkOpen] = useState(false);
  const [revealOpen, setRevealOpen] = useState(false);
  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const [copyHint, setCopyHint] = useState<string | null>(null);
  const [rotateTarget, setRotateTarget] = useState<CfTokenRow | null>(null);
  const [rotateRevokeOld, setRotateRevokeOld] = useState(true);
  const [rotateBusy, setRotateBusy] = useState(false);
  const [rotateResult, setRotateResult] = useState<CloudflareRotateResultDto | null>(null);
  const [rotateCopyHint, setRotateCopyHint] = useState<string | null>(null);
  const [storageDiagnostics, setStorageDiagnostics] =
    useState<SecretStorageDiagnosticsDto | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [resourcesLoading, setResourcesLoading] = useState(false);
  const [turnstileBusySitekey, setTurnstileBusySitekey] = useState<string | null>(null);
  const [turnstileTarget, setTurnstileTarget] = useState<TurnstileWidgetRow | null>(null);
  const [turnstileResult, setTurnstileResult] = useState<TurnstileRotateResult | null>(null);
  const [turnstileCopyHint, setTurnstileCopyHint] = useState<string | null>(null);

  const integrationId = integration.id;
  const vercelIntegration = integrations.find((item) => item.provider === "vercel");
  const supabaseIntegration = integrations.find((item) => item.provider === "supabase");

  const refreshStatus = useCallback(async () => {
    try {
      const s = await invoke<CloudflareStatusDto>("cloudflare_status", { integrationId });
      setStatus(s);
      if (s.accountId) setAccountId(s.accountId);
    } catch {
      setStatus({ linked: false, accountId: null });
    }
  }, [integrationId]);

  const refreshTokens = useCallback(async () => {
    try {
      const list = await invoke<CfTokenRow[]>("cloudflare_list_tokens", { integrationId });
      setTokens(list);
      setError(null);
    } catch (e) {
      setTokens([]);
      setError(errText(e));
    }
  }, [integrationId]);

  const refreshTurnstileWidgets = useCallback(async (silent = false) => {
    try {
      const list = await invoke<TurnstileWidgetRow[]>("cloudflare_list_turnstile_widgets", {
        integrationId,
      });
      setTurnstileWidgets(list);
    } catch (e) {
      setTurnstileWidgets([]);
      if (!silent) setError(errText(e));
    }
  }, [integrationId]);

  const refreshAccessServiceTokens = useCallback(async () => {
    try {
      const list = await invoke<AccessServiceTokenRow[]>(
        "cloudflare_list_access_service_tokens",
        { integrationId },
      );
      setAccessServiceTokens(list);
    } catch {
      setAccessServiceTokens([]);
    }
  }, [integrationId]);

  const refreshWorkerScripts = useCallback(async () => {
    try {
      const list = await invoke<WorkerScriptRow[]>("cloudflare_list_worker_scripts", {
        integrationId,
      });
      setWorkerScripts(list);
      setSelectedWorker((current) =>
        current && list.some((worker) => worker.id === current) ? current : list[0]?.id || "",
      );
    } catch {
      setWorkerScripts([]);
      setWorkerSecrets([]);
      setSelectedWorker("");
    }
  }, [integrationId]);

  const refreshWorkerSecrets = useCallback(
    async (scriptName: string) => {
      const name = scriptName.trim();
      if (!name) {
        setWorkerSecrets([]);
        return;
      }
      try {
        const list = await invoke<WorkerSecretRow[]>("cloudflare_list_worker_secrets", {
          integrationId,
          scriptName: name,
        });
        setWorkerSecrets(list);
        const preferred =
          list.find((secret) => secret.name.toUpperCase().includes("TURNSTILE"))?.name ??
          list[0]?.name ??
          "TURNSTILE_SECRET_KEY";
        setWorkerSecretName((current) => current || preferred);
      } catch {
        setWorkerSecrets([]);
      }
    },
    [integrationId],
  );

  const refreshPagesProjects = useCallback(async () => {
    try {
      const list = await invoke<PagesProjectRow[]>("cloudflare_list_pages_projects", {
        integrationId,
      });
      setPagesProjects(list);
      setSelectedPagesProject((current) =>
        current && list.some((project) => project.name === current) ? current : list[0]?.name || "",
      );
    } catch {
      setPagesProjects([]);
      setSelectedPagesProject("");
    }
  }, [integrationId]);

  const refreshSecretsStores = useCallback(async () => {
    try {
      const list = await invoke<SecretsStoreRow[]>("cloudflare_list_secrets_stores", {
        integrationId,
      });
      setSecretsStores(list);
      setSelectedSecretsStore((current) =>
        current && list.some((store) => store.id === current) ? current : list[0]?.id || "",
      );
    } catch {
      setSecretsStores([]);
      setSecretsStoreSecrets([]);
      setSelectedSecretsStore("");
    }
  }, [integrationId]);

  const refreshSecretsStoreSecrets = useCallback(
    async (storeId: string) => {
      const id = storeId.trim();
      if (!id) {
        setSecretsStoreSecrets([]);
        return;
      }
      try {
        const list = await invoke<SecretsStoreSecretRow[]>(
          "cloudflare_list_secrets_store_secrets",
          { integrationId, storeId: id },
        );
        setSecretsStoreSecrets(list);
        const preferred =
          list.find((secret) => secret.name.toUpperCase().includes("TURNSTILE")) ?? list[0];
        if (preferred) {
          setSecretsStoreSecretId((current) => current || preferred.id);
          setSecretsStoreSecretName((current) => current || preferred.name);
          setSecretsStoreScopes((current) => current || preferred.scopes.join(", "));
        }
      } catch {
        setSecretsStoreSecrets([]);
      }
    },
    [integrationId],
  );

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

  const refreshSupabaseProjects = useCallback(async () => {
    if (!supabaseIntegration) {
      setSupabaseProjects([]);
      setSelectedSupabaseProjectRef("");
      return;
    }
    try {
      const list = await invoke<SupabaseProjectRow[]>("supabase_list_projects", {
        integrationId: supabaseIntegration.id,
      });
      setSupabaseProjects(list);
      setSelectedSupabaseProjectRef((current) =>
        current && list.some((project) => project.reference === current)
          ? current
          : list[0]?.reference || "",
      );
    } catch {
      setSupabaseProjects([]);
      setSelectedSupabaseProjectRef("");
    }
  }, [supabaseIntegration]);

  const refreshSupabaseSecrets = useCallback(
    async (projectRef: string) => {
      if (!supabaseIntegration || !projectRef.trim()) {
        setSupabaseSecrets([]);
        setSelectedSupabaseSecretNames([]);
        return;
      }
      try {
        const list = await invoke<SupabaseSecretRow[]>("supabase_list_project_secrets", {
          integrationId: supabaseIntegration.id,
          projectRef,
        });
        setSupabaseSecrets(list);
        setSupabaseSecretName(
          list.find((secret) => secret.name.toUpperCase().includes("TURNSTILE"))?.name ||
            list[0]?.name ||
            "TURNSTILE_SECRET_KEY",
        );
        const preferred =
          list.find((secret) => secret.name.toUpperCase().includes("TURNSTILE"))?.name ||
          list[0]?.name;
        setSelectedSupabaseSecretNames((current) =>
          current.length > 0 && current.every((name) => list.some((secret) => secret.name === name))
            ? current
            : preferred
              ? [preferred]
              : [],
        );
      } catch {
        setSupabaseSecrets([]);
        setSelectedSupabaseSecretNames([]);
      }
    },
    [supabaseIntegration],
  );

  const refreshManagedSecrets = useCallback(async () => {
    try {
      const list = await invoke<ManagedSecretDto[]>("cloudflare_managed_secrets_list", {
        integrationId,
      });
      setManagedSecrets(list);
    } catch {
      setManagedSecrets([]);
    }
  }, [integrationId]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (status?.linked) {
      let cancelled = false;
      setResourcesLoading(true);
      setInitialLoadComplete(false);
      void Promise.allSettled([
        refreshTokens(),
        refreshTurnstileWidgets(true),
        refreshAccessServiceTokens(),
        refreshWorkerScripts(),
        refreshPagesProjects(),
        refreshSecretsStores(),
        refreshVercelProjects(),
        refreshSupabaseProjects(),
        refreshManagedSecrets(),
      ]).finally(() => {
        if (!cancelled) {
          setResourcesLoading(false);
          setInitialLoadComplete(true);
        }
      });
      return () => {
        cancelled = true;
      };
    } else {
      setTokens([]);
      setTurnstileWidgets([]);
      setAccessServiceTokens([]);
      setWorkerScripts([]);
      setWorkerSecrets([]);
      setPagesProjects([]);
      setSecretsStores([]);
      setSecretsStoreSecrets([]);
      setVercelProjects([]);
      setSupabaseProjects([]);
      setSupabaseSecrets([]);
      setSelectedSupabaseSecretNames([]);
      setManagedSecrets([]);
      setResourcesLoading(false);
      setInitialLoadComplete(true);
    }
  }, [status?.linked, refreshTokens, refreshTurnstileWidgets, refreshAccessServiceTokens, refreshWorkerScripts, refreshPagesProjects, refreshSecretsStores, refreshVercelProjects, refreshSupabaseProjects, refreshManagedSecrets]);

  useEffect(() => {
    if (status?.linked && selectedWorker) {
      void refreshWorkerSecrets(selectedWorker);
    }
  }, [status?.linked, selectedWorker, refreshWorkerSecrets]);

  useEffect(() => {
    if (status?.linked && selectedSecretsStore) {
      void refreshSecretsStoreSecrets(selectedSecretsStore);
    }
  }, [status?.linked, selectedSecretsStore, refreshSecretsStoreSecrets]);

  useEffect(() => {
    if (status?.linked && selectedSupabaseProjectRef) {
      void refreshSupabaseSecrets(selectedSupabaseProjectRef);
    }
  }, [status?.linked, selectedSupabaseProjectRef, refreshSupabaseSecrets]);

  async function handleLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const s = await invoke<CloudflareStatusDto>("cloudflare_link", {
        integrationId,
        accountId: accountId.trim(),
        apiToken: apiToken.trim(),
      });
      setStatus(s);
      setApiToken("");
      await refreshStatus();
      await refreshTokens();
      await refreshTurnstileWidgets();
      await refreshAccessServiceTokens();
      await refreshWorkerScripts();
      await refreshPagesProjects();
      await refreshSecretsStores();
      await refreshVercelProjects();
      await refreshSupabaseProjects();
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleUnlink() {
    setConfirmUnlinkOpen(false);
    setBusy(true);
    setError(null);
    try {
      await invoke("cloudflare_unlink", { integrationId });
      setStatus({ linked: false, accountId: null });
      setTokens([]);
      setTurnstileWidgets([]);
      setAccessServiceTokens([]);
      setWorkerScripts([]);
      setWorkerSecrets([]);
      setPagesProjects([]);
      setSecretsStores([]);
      setSecretsStoreSecrets([]);
      setVercelProjects([]);
      setSupabaseProjects([]);
      setSupabaseSecrets([]);
      setSelectedSupabaseSecretNames([]);
      setApiToken("");
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  const linked = status?.linked ?? false;
  const managedExternalIds = new Set(managedSecrets.map((secret) => secret.externalId));

  async function runStorageDiagnostics() {
    if (storageDiagnostics) {
      setStorageDiagnostics(null);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await invoke<SecretStorageDiagnosticsDto>(
        "cloudflare_secret_storage_diagnostics",
        { integrationId },
      );
      setStorageDiagnostics(result);
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  async function openReveal() {
    setConfirmRevealOpen(false);
    setBusy(true);
    setError(null);
    try {
      const tok = await invoke<string>("cloudflare_reveal_managed_token", { integrationId });
      setRevealedToken(tok);
      setRevealOpen(true);
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  function closeReveal() {
    setRevealOpen(false);
    setRevealedToken(null);
    setCopyHint(null);
  }

  async function handleCopySecret() {
    if (!revealedToken) return;
    try {
      await copySensitiveWithAutoClear(revealedToken);
      setCopyHint(t("cloudflare.clipboardHint"));
    } catch (err) {
      setError(errText(err));
    }
  }

  function openRotateModal(tok: CfTokenRow) {
    setRotateRevokeOld(true);
    setRotateTarget(tok);
  }

  function openManualRotate() {
    const id = manualTokenId.trim();
    if (!id) return;
    openRotateModal({
      id,
      name: t("cloudflare.manualTokenName"),
      status: "",
      expiresOn: null,
    });
  }

  async function trackToken(tok: CfTokenRow) {
    setBusy(true);
    setError(null);
    try {
      await invoke<ManagedSecretDto>("cloudflare_track_managed_secret", {
        integrationId,
        tokenId: tok.id,
        label: tok.name,
        environment: "production",
      });
      await refreshManagedSecrets();
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  function closeRotateModal() {
    if (rotateBusy) return;
    setRotateTarget(null);
  }

  async function confirmRotate() {
    if (!rotateTarget) return;
    setRotateBusy(true);
    setError(null);
    try {
      const res = await invoke<CloudflareRotateResultDto>("cloudflare_rotate_account_token", {
        integrationId,
        sourceTokenId: rotateTarget.id,
        revokeOld: rotateRevokeOld,
        updateVaultSecret: false,
      });
      setRotateTarget(null);
      setRotateResult(res);
      setRotateCopyHint(null);
      await refreshTokens();
      await refreshManagedSecrets();
    } catch (err) {
      setError(errText(err));
    } finally {
      setRotateBusy(false);
    }
  }

  function closeRotateResult() {
    setRotateResult(null);
    setRotateCopyHint(null);
  }

  async function handleCopyNewSecret() {
    if (!rotateResult) return;
    try {
      await copySensitiveWithAutoClear(rotateResult.newTokenSecret);
      setRotateCopyHint(t("cloudflare.clipboardHint"));
    } catch (err) {
      setError(errText(err));
    }
  }

  async function rotateTurnstileSecret(widget: TurnstileWidgetRow, immediate: boolean) {
    setTurnstileBusySitekey(widget.sitekey);
    setError(null);
    setTurnstileResult(null);
    setTurnstileCopyHint(null);
    setWorkerUpdateHint(null);
    setPagesUpdateHint(null);
    setSecretsStoreUpdateHint(null);
    setVercelUpdateHint(null);
    setSupabaseUpdateHint(null);
    try {
      const res = await invoke<TurnstileRotateResult>("cloudflare_rotate_turnstile_secret", {
        integrationId,
        sitekey: widget.sitekey,
        invalidateImmediately: immediate,
      });
      setTurnstileTarget(null);
      setTurnstileResult(res);
      void refreshTurnstileWidgets(true);
      void refreshVercelProjects();
      void refreshSupabaseProjects();
    } catch (err) {
      setError(errText(err));
    } finally {
      setTurnstileBusySitekey(null);
    }
  }

  async function handleCopyTurnstileSecret() {
    if (!turnstileResult) return;
    try {
      await copySensitiveWithAutoClear(turnstileResult.secret);
      setTurnstileCopyHint(t("cloudflare.clipboardHint"));
    } catch (err) {
      setError(errText(err));
    }
  }

  async function rotateAccessServiceToken(token: AccessServiceTokenRow, grace: boolean) {
    setAccessBusyId(token.id);
    setError(null);
    try {
      const previousClientSecretExpiresAt = grace
        ? new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
        : null;
      const res = await invoke<AccessServiceTokenRotateResult>(
        "cloudflare_rotate_access_service_token",
        {
          integrationId,
          serviceTokenId: token.id,
          previousClientSecretExpiresAt,
        },
      );
      setAccessTarget(null);
      setAccessResult(res);
      setAccessCopyHint(null);
      await refreshAccessServiceTokens();
    } catch (err) {
      setError(errText(err));
    } finally {
      setAccessBusyId(null);
    }
  }

  async function handleCopyAccessSecret() {
    if (!accessResult) return;
    try {
      await copySensitiveWithAutoClear(accessResult.clientSecret);
      setAccessCopyHint(t("cloudflare.clipboardHint"));
    } catch (err) {
      setError(errText(err));
    }
  }

  async function updateWorkerWithTurnstileSecret() {
    if (!turnstileResult) return;
    const scriptName = selectedWorker.trim();
    const secretName = workerSecretName.trim();
    if (!scriptName || !secretName) return;
    setWorkerBusy(true);
    setWorkerUpdateHint(null);
    setError(null);
    try {
      const row = await invoke<WorkerSecretRow>("cloudflare_update_worker_secret", {
        integrationId,
        scriptName,
        secretName,
        secretValue: turnstileResult.secret,
      });
      setWorkerUpdateHint(`Secret ${row.name} aggiornato in ${scriptName}.`);
      await refreshWorkerSecrets(scriptName);
    } catch (err) {
      setError(errText(err));
    } finally {
      setWorkerBusy(false);
    }
  }

  async function updatePagesWithTurnstileSecret() {
    if (!turnstileResult) return;
    const projectName = selectedPagesProject.trim();
    const secretName = pagesSecretName.trim();
    if (!projectName || !secretName) return;
    setPagesBusy(true);
    setPagesUpdateHint(null);
    setError(null);
    try {
      await invoke("cloudflare_update_pages_secret", {
        integrationId,
        projectName,
        environment: pagesEnvironment,
        secretName,
        secretValue: turnstileResult.secret,
      });
      setPagesUpdateHint(`Secret ${secretName} aggiornato in Pages (${projectName}, ${pagesEnvironment}).`);
      await refreshPagesProjects();
    } catch (err) {
      setError(errText(err));
    } finally {
      setPagesBusy(false);
    }
  }

  async function updateSecretsStoreWithTurnstileSecret() {
    if (!turnstileResult) return;
    const storeId = selectedSecretsStore.trim();
    const secretName = secretsStoreSecretName.trim();
    if (!storeId || !secretName) return;
    const scopes = secretsStoreScopes
      .split(",")
      .map((scope) => scope.trim())
      .filter(Boolean);
    setSecretsStoreBusy(true);
    setSecretsStoreUpdateHint(null);
    setError(null);
    try {
      const row = await invoke<SecretsStoreSecretRow>("cloudflare_upsert_secrets_store_secret", {
        payload: {
          integrationId,
          storeId,
          secretId: secretsStoreSecretId.trim() || null,
          secretName,
          secretValue: turnstileResult.secret,
          scopes,
        },
      });
      setSecretsStoreSecretId(row.id);
      setSecretsStoreSecretName(row.name);
      setSecretsStoreUpdateHint(`Secret ${row.name} aggiornato in Secrets Store.`);
      await refreshSecretsStoreSecrets(storeId);
    } catch (err) {
      setError(errText(err));
    } finally {
      setSecretsStoreBusy(false);
    }
  }

  async function updateVercelWithTurnstileSecret() {
    if (!turnstileResult || !vercelIntegration) return;
    const project = vercelProjects.find((item) => item.id === selectedVercelProjectId);
    const key = vercelEnvKey.trim();
    if (!project || !key) return;
    setVercelBusy(true);
    setVercelUpdateHint(null);
    setError(null);
    try {
      await invoke("vercel_upsert_project_env", {
        payload: {
          integrationId: vercelIntegration.id,
          projectId: project.id,
          projectName: project.name,
          key,
          value: turnstileResult.secret,
          targets: vercelTargets,
        },
      });
      setVercelUpdateHint(`Env ${key} aggiornata in Vercel (${project.name}).`);
    } catch (err) {
      setError(errText(err));
    } finally {
      setVercelBusy(false);
    }
  }

  async function updateSupabaseWithTurnstileSecret() {
    if (!turnstileResult || !supabaseIntegration) return;
    const project = supabaseProjects.find((item) => item.reference === selectedSupabaseProjectRef);
    const names = selectedSupabaseSecretNames.length > 0
      ? selectedSupabaseSecretNames
      : [supabaseSecretName.trim()].filter(Boolean);
    if (!project || names.length === 0) return;
    setSupabaseBusy(true);
    setSupabaseUpdateHint(null);
    setError(null);
    try {
      await invoke("supabase_upsert_project_secrets", {
        payload: {
          integrationId: supabaseIntegration.id,
          projectRef: project.reference,
          projectName: project.name,
          names,
          value: turnstileResult.secret,
        },
      });
      setSupabaseUpdateHint(`${names.length} secret aggiornati in Supabase (${project.name}).`);
      await refreshSupabaseSecrets(project.reference);
    } catch (err) {
      setError(errText(err));
    } finally {
      setSupabaseBusy(false);
    }
  }

  function toggleVercelTarget(target: DeployTarget) {
    setVercelTargets((current) =>
      current.includes(target)
        ? current.filter((item) => item !== target)
        : [...current, target],
    );
  }

  function toggleSupabaseSecretName(name: string) {
    setSelectedSupabaseSecretNames((current) =>
      current.includes(name) ? current.filter((item) => item !== name) : [...current, name],
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-auto px-10 py-10">
      <ProviderHeader
        providerLabel={t("providers.cloudflare.title")}
        title={integration.label}
        backLabel={t("cloudflare.back")}
        onBack={onBack}
        description={
          <Trans
            i18nKey="cloudflare.intro"
            components={[
              <span className="font-mono text-xs" key="0" />,
              <span className="font-mono text-xs" key="1" />,
            ]}
          />
        }
      />

      <AlertMessage message={error} />

      {!linked ? (
        <form
          onSubmit={(e) => void handleLink(e)}
          className="max-w-lg space-y-4 rounded-2xl border border-surface-3/80 bg-surface-1/80 p-6"
        >
          <div>
            <h2 className="text-sm font-semibold text-ink">
              {accountId ? t("cloudflare.reconnectTitle") : t("cloudflare.connectTitle")}
            </h2>
            <p className="mt-1 text-xs text-ink-muted">
              {accountId ? t("cloudflare.reconnectLead") : t("cloudflare.connectLead")}
            </p>
          </div>
          <CredentialGuide
            steps={[
              "Apri la dashboard Cloudflare e copia l'Account ID dalla pagina dell'account.",
              <>
                Crea un API token da <span className="font-medium text-ink">My Profile / API Tokens</span> oppure da <span className="font-medium text-ink">Manage Account / API Tokens</span>.
              </>,
              <>
                Per Turnstile servono almeno <span className="font-mono text-ink">Turnstile Sites Read</span> e <span className="font-mono text-ink">Turnstile Sites Write</span>. Aggiungi Pages, Workers, Access o Secrets Store solo se vuoi gestire anche quelle destinazioni.
              </>,
              "Dopo la creazione Cloudflare mostra il token una sola volta: copialo subito e incollalo qui.",
            ]}
            links={[
              {
                href: "https://developers.cloudflare.com/fundamentals/api/get-started/create-token/",
                label: "Guida API token Cloudflare",
              },
              {
                href: "https://developers.cloudflare.com/turnstile/get-started/widget-management/api/",
                label: "Permessi Turnstile",
              },
            ]}
          />
          <div className="space-y-1.5">
            <label htmlFor="cf-account" className="text-xs font-semibold text-ink-muted">
              {t("cloudflare.accountId")}
            </label>
            <input
              id="cf-account"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 text-sm text-ink outline-none ring-accent/40 focus:ring-2"
              placeholder={t("cloudflare.accountIdPh")}
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="cf-token" className="text-xs font-semibold text-ink-muted">
              {t("cloudflare.apiToken")}
            </label>
            <input
              id="cf-token"
              type="password"
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
              className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 font-mono text-sm text-ink outline-none ring-accent/40 focus:ring-2"
              placeholder={t("cloudflare.apiTokenPh")}
              autoComplete="off"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-surface-0 hover:brightness-110 disabled:opacity-50"
          >
            {busy ? t("cloudflare.verifying") : t("cloudflare.saveVerify")}
          </button>
        </form>
      ) : !initialLoadComplete || resourcesLoading ? (
        <ProviderLoadingPanel
          title="Caricamento servizi Cloudflare"
          description="Sto scaricando widget, token e destinazioni disponibili."
        />
      ) : (
        <div className="space-y-6">
          <LinkedAccountBar
            details={
              <>
                <p className="text-xs text-ink-muted">{t("cloudflare.linked")}</p>
                <p className="font-mono text-sm text-ink">{status?.accountId}</p>
                <p className="mt-1 text-xs text-ink-muted">{t("cloudflare.keyringHint")}</p>
              </>
            }
            actions={
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirmRevealOpen(true)}
                  className="rounded-lg border border-amber-500/40 px-3 py-1.5 text-sm text-amber-100 hover:bg-amber-500/10"
                >
                  {t("cloudflare.showToken")}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void refreshTokens()}
                  className="rounded-lg border border-surface-3 px-3 py-1.5 text-sm text-ink hover:border-accent/40"
                >
                  {t("cloudflare.refreshList")}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void runStorageDiagnostics()}
                  className="rounded-lg border border-surface-3 px-3 py-1.5 text-sm text-ink hover:border-accent/40"
                >
                  {storageDiagnostics ? "Chiudi diagnostica" : "Diagnostica storage"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirmUnlinkOpen(true)}
                  className="rounded-lg border border-rose-500/40 px-3 py-1.5 text-sm text-rose-200 hover:bg-rose-500/10"
                >
                  {t("cloudflare.unlink")}
                </button>
              </>
            }
          />

          {storageDiagnostics ? (
            <section className="rounded-2xl border border-surface-3/80 bg-surface-1/60 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-ink">Diagnostica Credential Manager</h2>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    storageDiagnostics.ok
                      ? "bg-accent/15 text-accent"
                      : "bg-rose-500/15 text-rose-200"
                  }`}
                >
                  {storageDiagnostics.ok ? "OK" : "Errore"}
                </span>
              </div>
              <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-[180px_1fr]">
                <dt className="text-ink-muted">Voce Cloudflare attesa</dt>
                <dd className="break-all font-mono text-ink">
                  {storageDiagnostics.credentialTarget}
                </dd>
                <dt className="text-ink-muted">Voce test</dt>
                <dd className="break-all font-mono text-ink">{storageDiagnostics.probeTarget}</dd>
                <dt className="text-ink-muted">Creazione entry</dt>
                <dd className="font-mono text-ink">{storageDiagnostics.entryNew}</dd>
                <dt className="text-ink-muted">Scrittura test</dt>
                <dd className="font-mono text-ink">{storageDiagnostics.setPassword}</dd>
                <dt className="text-ink-muted">Lettura test</dt>
                <dd className="font-mono text-ink">{storageDiagnostics.getPassword}</dd>
                <dt className="text-ink-muted">Pulizia test</dt>
                <dd className="font-mono text-ink">{storageDiagnostics.deleteCredential}</dd>
                <dt className="text-ink-muted">Fallback DPAPI</dt>
                <dd className="font-mono text-ink">{storageDiagnostics.dpapiRoundtrip}</dd>
              </dl>
            </section>
          ) : null}

          <TurnstileSection
            widgets={turnstileWidgets}
            busy={busy}
            busySitekey={turnstileBusySitekey}
            onRefresh={() => void refreshTurnstileWidgets()}
            onRotate={setTurnstileTarget}
          />

          <AccessServiceTokensSection
            tokens={accessServiceTokens}
            busy={busy}
            busyId={accessBusyId}
            onRefresh={() => void refreshAccessServiceTokens()}
            onRotate={setAccessTarget}
          />

          <WorkersSecretsSection
            scripts={workerScripts}
            secrets={workerSecrets}
            selectedWorker={selectedWorker}
            busy={busy}
            workerBusy={workerBusy}
            onRefresh={() => void refreshWorkerScripts()}
            onSelectWorker={(worker) => {
              setSelectedWorker(worker);
              setWorkerSecretName("");
              setWorkerUpdateHint(null);
            }}
            onUseSecret={(secretName) => {
              setWorkerSecretName(secretName);
              setWorkerUpdateHint(null);
            }}
          />

          <PagesSecretsSection
            projects={pagesProjects}
            busy={busy}
            pagesBusy={pagesBusy}
            pagesEnvironment={pagesEnvironment}
            onRefresh={() => void refreshPagesProjects()}
            onUseProject={(project) => {
              setSelectedPagesProject(project.name);
              const vars =
                pagesEnvironment === "production"
                  ? project.productionEnvVars
                  : project.previewEnvVars;
              setPagesSecretName(
                vars.find((item) => item.name.toUpperCase().includes("TURNSTILE"))?.name ||
                  vars[0]?.name ||
                  "TURNSTILE_SECRET_KEY",
              );
              setPagesUpdateHint(null);
            }}
          />

          <SecretsStoreSection
            stores={secretsStores}
            secrets={secretsStoreSecrets}
            selectedStore={selectedSecretsStore}
            busy={busy}
            secretsStoreBusy={secretsStoreBusy}
            onRefresh={() => void refreshSecretsStores()}
            onSelectStore={(storeId) => {
              setSelectedSecretsStore(storeId);
              setSecretsStoreSecretId("");
              setSecretsStoreUpdateHint(null);
            }}
            onUseSecret={(secret) => {
              setSecretsStoreSecretId(secret.id);
              setSecretsStoreSecretName(secret.name);
              setSecretsStoreScopes(secret.scopes.join(", ") || "workers");
              setSecretsStoreUpdateHint(null);
            }}
          />

          <section className="space-y-3 rounded-2xl border border-surface-3/80 bg-surface-1/60 p-5">
            <div>
              <h2 className="text-sm font-semibold text-ink">{t("cloudflare.rotateByIdTitle")}</h2>
              <p className="mt-1 text-xs text-ink-muted">{t("cloudflare.rotateByIdLead")}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                value={manualTokenId}
                onChange={(e) => setManualTokenId(e.target.value)}
                className="min-w-[260px] flex-1 rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 font-mono text-sm text-ink outline-none ring-accent/40 focus:ring-2"
                placeholder={t("cloudflare.tokenIdPh")}
                autoComplete="off"
              />
              <button
                type="button"
                disabled={!manualTokenId.trim() || busy || rotateBusy}
                onClick={openManualRotate}
                className="rounded-lg border border-accent/50 px-3 py-2 text-sm font-medium text-accent hover:bg-accent/10 disabled:opacity-50"
              >
                {t("cloudflare.rotateThisId")}
              </button>
            </div>
          </section>

          <div className="overflow-hidden rounded-2xl border border-surface-3/80">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-2/80 text-[11px] uppercase tracking-wide text-ink-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">{t("cloudflare.colName")}</th>
                  <th className="px-4 py-3 font-semibold">{t("cloudflare.colStatus")}</th>
                  <th className="px-4 py-3 font-semibold">{t("cloudflare.colExpiry")}</th>
                  <th className="px-4 py-3 font-semibold">{t("cloudflare.colManaged")}</th>
                  <th className="px-4 py-3 font-mono text-[10px] font-semibold">{t("cloudflare.colId")}</th>
                  <th className="px-4 py-3 font-semibold">{t("cloudflare.colActions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-3/60 bg-surface-1/40">
                {tokens.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-ink-muted">
                      {t("cloudflare.noTokens")}
                    </td>
                  </tr>
                ) : (
                  tokens.map((tok) => {
                    const isManaged = managedExternalIds.has(tok.id);
                    return (
                      <tr key={tok.id} className="text-ink">
                        <td className="px-4 py-3 font-medium">{tok.name}</td>
                        <td className="px-4 py-3 text-ink-muted">{tok.status}</td>
                        <td className="px-4 py-3 text-ink-muted">
                          {tok.expiresOn ?? "\u2014"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              isManaged
                                ? "bg-accent/15 text-accent"
                                : "bg-surface-3/70 text-ink-muted"
                            }`}
                          >
                            {isManaged ? t("cloudflare.managedYes") : t("cloudflare.managedNo")}
                          </span>
                        </td>
                        <td className="max-w-[120px] truncate px-4 py-3 font-mono text-[11px] text-ink-muted">
                          {tok.id}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={busy || rotateBusy || isManaged}
                              onClick={() => void trackToken(tok)}
                              className="rounded-lg border border-surface-3 px-2.5 py-1 text-xs font-medium text-ink-muted hover:border-accent/40 disabled:opacity-50"
                            >
                              {isManaged ? t("cloudflare.tracked") : t("cloudflare.track")}
                            </button>
                            <button
                              type="button"
                              disabled={busy || rotateBusy}
                              onClick={() => openRotateModal(tok)}
                              className="rounded-lg border border-accent/50 px-2.5 py-1 text-xs font-medium text-accent hover:bg-accent/10 disabled:opacity-50"
                            >
                              {t("cloudflare.rotate")}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-ink-muted">{t("cloudflare.footnote")}</p>
        </div>
      )}

      {rotateTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-surface-3 bg-surface-1 p-6 shadow-2xl">
            <h3 className="text-sm font-semibold text-ink">{t("cloudflare.rotateTitle")}</h3>
            <p className="mt-1 text-xs text-ink-muted">
              <Trans
                i18nKey="cloudflare.rotateLead"
                values={{ name: rotateTarget.name }}
                components={[<span className="font-medium text-ink" key="0" />]}
              />
            </p>
            <label className="mt-4 flex cursor-pointer items-start gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={rotateRevokeOld}
                onChange={(e) => setRotateRevokeOld(e.target.checked)}
                className="mt-1 rounded border-surface-3"
              />
              <span>{t("cloudflare.rotateRevoke")}</span>
            </label>
            <p className="mt-3 text-xs text-amber-100/90">{t("cloudflare.rotateWarn")}</p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={rotateBusy}
                onClick={closeRotateModal}
                className="rounded-lg border border-surface-3 px-3 py-1.5 text-sm text-ink hover:border-accent/40 disabled:opacity-50"
              >
                {t("cloudflare.cancel")}
              </button>
              <button
                type="button"
                disabled={rotateBusy}
                onClick={() => void confirmRotate()}
                className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-surface-0 disabled:opacity-50"
              >
                {rotateBusy ? t("cloudflare.rotating") : t("cloudflare.confirm")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmRevealOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-2xl border border-amber-500/30 bg-surface-1 p-6 shadow-2xl">
            <h3 className="text-sm font-semibold text-amber-100">Mostra token di gestione</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              Chiunque possa vedere lo schermo potrà leggere il token Cloudflare. Aprilo solo in un ambiente privato e chiudi la finestra appena hai finito.
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmRevealOpen(false)}
                className="rounded-lg border border-surface-3 px-3 py-1.5 text-sm text-ink hover:border-accent/40 disabled:opacity-50"
              >
                Annulla
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void openReveal()}
                className="rounded-lg border border-amber-500/40 px-3 py-1.5 text-sm font-medium text-amber-100 hover:bg-amber-500/10 disabled:opacity-50"
              >
                Mostra token
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmUnlinkOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-2xl border border-rose-500/30 bg-surface-1 p-6 shadow-2xl">
            <h3 className="text-sm font-semibold text-rose-100">Rimuovi collegamento Cloudflare</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              Verranno rimossi da questo dispositivo Account ID, token di gestione e stato locale del collegamento. I token su Cloudflare non vengono eliminati.
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmUnlinkOpen(false)}
                className="rounded-lg border border-surface-3 px-3 py-1.5 text-sm text-ink hover:border-accent/40 disabled:opacity-50"
              >
                Annulla
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleUnlink()}
                className="rounded-lg border border-rose-500/50 px-3 py-1.5 text-sm font-medium text-rose-100 hover:bg-rose-500/10 disabled:opacity-50"
              >
                Rimuovi collegamento
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {rotateResult ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-amber-500/30 bg-surface-1 p-6 shadow-2xl">
            <h3 className="text-sm font-semibold text-amber-100">{t("cloudflare.resultTitle")}</h3>
            <p className="mt-1 text-xs text-ink-muted">{t("cloudflare.resultLead")}</p>
            <p className="mt-2 font-mono text-[11px] text-ink-muted">
              ID: {rotateResult.newTokenId}
            </p>
            <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-surface-0 p-3 font-mono text-xs text-ink">
              {rotateResult.newTokenSecret}
            </pre>
            <ul className="mt-3 space-y-1 text-xs text-ink-muted">
              <li>
                {t("cloudflare.resultTracked")}{" "}
                {rotateResult.trackedSecretUpdated ? (
                  <span className="text-accent">{t("cloudflare.yes")}</span>
                ) : (
                  <span>{t("cloudflare.no")}</span>
                )}
              </li>
              <li>
                {t("cloudflare.resultRevoked")}{" "}
                {rotateResult.revokedOld ? (
                  <span className="text-accent">{t("cloudflare.yes")}</span>
                ) : (
                  <span>{t("cloudflare.no")}</span>
                )}
              </li>
            </ul>
            {rotateCopyHint ? <p className="mt-2 text-xs text-accent">{rotateCopyHint}</p> : null}
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => void handleCopyNewSecret()}
                className="rounded-lg border border-surface-3 px-3 py-1.5 text-sm text-ink hover:border-accent/40"
              >
                {t("cloudflare.copySecretAuto")}
              </button>
              <button
                type="button"
                onClick={closeRotateResult}
                className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-surface-0"
              >
                {t("cloudflare.close")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {turnstileTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-surface-3 bg-surface-1 p-6 shadow-2xl">
            <h3 className="text-sm font-semibold text-ink">Ruota secret Turnstile</h3>
            <p className="mt-1 text-xs text-ink-muted">
              Verrà creato un nuovo secret per {turnstileTarget.name}. Il vecchio secret può restare valido per 2 ore, oppure essere invalidato subito.
            </p>
            <p className="mt-3 font-mono text-[11px] text-ink-muted">
              Sitekey: {turnstileTarget.sitekey}
            </p>
            <p className="mt-3 text-xs text-amber-100/90">
              Se Cloudflare restituisce errore di autenticazione, ricollega il token manager con permessi Turnstile Sites Write oppure Account Settings Write.
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={turnstileBusySitekey === turnstileTarget.sitekey}
                onClick={() => setTurnstileTarget(null)}
                className="rounded-lg border border-surface-3 px-3 py-1.5 text-sm text-ink hover:border-accent/40 disabled:opacity-50"
              >
                Annulla
              </button>
              <button
                type="button"
                disabled={turnstileBusySitekey === turnstileTarget.sitekey}
                onClick={() => void rotateTurnstileSecret(turnstileTarget, false)}
                className="rounded-lg border border-accent/50 px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent/10 disabled:opacity-50"
              >
                Ruota con 2 ore di grace
              </button>
              <button
                type="button"
                disabled={turnstileBusySitekey === turnstileTarget.sitekey}
                onClick={() => void rotateTurnstileSecret(turnstileTarget, true)}
                className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-surface-0 disabled:opacity-50"
              >
                Invalida subito
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {accessTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-surface-3 bg-surface-1 p-6 shadow-2xl">
            <h3 className="text-sm font-semibold text-ink">Ruota Access Service Token</h3>
            <p className="mt-1 text-xs text-ink-muted">
              Verra creato un nuovo Client Secret per {accessTarget.name}. Il vecchio secret puo essere invalidato subito oppure restare valido per 2 ore.
            </p>
            <p className="mt-3 font-mono text-[11px] text-ink-muted">
              Client ID: {accessTarget.clientId || "-"}
            </p>
            <p className="mt-3 text-xs text-amber-100/90">
              Se questo token e usato da automazioni o backend, usa la grace window e aggiorna le destinazioni prima che scada il vecchio secret.
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={accessBusyId === accessTarget.id}
                onClick={() => setAccessTarget(null)}
                className="rounded-lg border border-surface-3 px-3 py-1.5 text-sm text-ink hover:border-accent/40 disabled:opacity-50"
              >
                Annulla
              </button>
              <button
                type="button"
                disabled={accessBusyId === accessTarget.id}
                onClick={() => void rotateAccessServiceToken(accessTarget, true)}
                className="rounded-lg border border-accent/50 px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent/10 disabled:opacity-50"
              >
                Ruota con 2 ore di grace
              </button>
              <button
                type="button"
                disabled={accessBusyId === accessTarget.id}
                onClick={() => void rotateAccessServiceToken(accessTarget, false)}
                className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-surface-0 disabled:opacity-50"
              >
                Invalida subito
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {accessResult ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-amber-500/30 bg-surface-1 p-6 shadow-2xl">
            <h3 className="text-sm font-semibold text-amber-100">Nuovo secret Access</h3>
            <p className="mt-1 text-xs text-ink-muted">
              Aggiorna subito i servizi che inviano gli header CF-Access-Client-ID e CF-Access-Client-Secret. Cloudflare mostra questo secret solo ora.
            </p>
            <p className="mt-2 text-sm text-ink">{accessResult.name}</p>
            <p className="font-mono text-[11px] text-ink-muted">Client ID: {accessResult.clientId}</p>
            <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-surface-0 p-3 font-mono text-xs text-ink">
              {accessResult.clientSecret}
            </pre>
            {accessCopyHint ? <p className="mt-2 text-xs text-accent">{accessCopyHint}</p> : null}
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => void handleCopyAccessSecret()}
                className="rounded-lg border border-surface-3 px-3 py-1.5 text-sm text-ink hover:border-accent/40"
              >
                Copia secret
              </button>
              <button
                type="button"
                onClick={() => {
                  setAccessResult(null);
                  setAccessCopyHint(null);
                }}
                className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-surface-0"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {turnstileResult ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="max-h-[88vh] w-full max-w-2xl overflow-auto rounded-2xl border border-amber-500/30 bg-surface-1 p-6 shadow-2xl">
            <h3 className="text-sm font-semibold text-amber-100">Nuovo secret Turnstile</h3>
            <p className="mt-1 text-xs text-ink-muted">
              Aggiorna subito il backend che usa questo widget. Cloudflare mostra questo secret solo ora.
            </p>
            <p className="mt-2 text-sm text-ink">{turnstileResult.name}</p>
            <p className="font-mono text-[11px] text-ink-muted">Sitekey: {turnstileResult.sitekey}</p>
            <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-surface-0 p-3 font-mono text-xs text-ink">
              {turnstileResult.secret}
            </pre>
            {turnstileCopyHint ? <p className="mt-2 text-xs text-accent">{turnstileCopyHint}</p> : null}
            <div className="mt-4 rounded-xl border border-surface-3/80 bg-surface-0/50 p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                Aggiorna Worker secret
              </h4>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="space-y-1.5 text-xs font-semibold text-ink-muted">
                  <span>Worker</span>
                  <select
                    value={selectedWorker}
                    onChange={(e) => {
                      setSelectedWorker(e.target.value);
                      setWorkerSecretName("");
                      setWorkerUpdateHint(null);
                    }}
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
                    onChange={(e) => {
                      setWorkerSecretName(e.target.value);
                      setWorkerUpdateHint(null);
                    }}
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
                  onClick={() => void updateWorkerWithTurnstileSecret()}
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
                    onChange={(e) => {
                      setSelectedPagesProject(e.target.value);
                      setPagesUpdateHint(null);
                    }}
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
                    onChange={(e) => {
                      setPagesEnvironment(e.target.value as "production" | "preview");
                      setPagesUpdateHint(null);
                    }}
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
                  onChange={(e) => {
                    setPagesSecretName(e.target.value);
                    setPagesUpdateHint(null);
                  }}
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
                  onClick={() => void updatePagesWithTurnstileSecret()}
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
                    onChange={(e) => {
                      setSelectedSecretsStore(e.target.value);
                      setSecretsStoreSecretId("");
                      setSecretsStoreUpdateHint(null);
                    }}
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
                    onChange={(e) => {
                      setSecretsStoreSecretName(e.target.value);
                      setSecretsStoreSecretId("");
                      setSecretsStoreUpdateHint(null);
                    }}
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
                  onChange={(e) => setSecretsStoreScopes(e.target.value)}
                  className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 font-mono text-sm font-normal text-ink outline-none ring-accent/40 focus:ring-2"
                  placeholder="workers, access"
                  autoComplete="off"
                />
              </label>
              {secretsStoreUpdateHint ? <p className="mt-2 text-xs text-accent">{secretsStoreUpdateHint}</p> : null}
              <p className="mt-2 text-xs text-ink-muted">
                Se non selezioni un secret esistente, Rotate ne crea uno nuovo nello store scelto.
              </p>
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  disabled={secretsStoreBusy || !selectedSecretsStore.trim() || !secretsStoreSecretName.trim()}
                  onClick={() => void updateSecretsStoreWithTurnstileSecret()}
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
              {vercelIntegration ? (
                <>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p className="text-xs text-ink-muted">
                      Usa il Vercel collegato per aggiornare una env var con il nuovo secret.
                    </p>
                    <button
                      type="button"
                      disabled={vercelBusy}
                      onClick={() => void refreshVercelProjects()}
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
                        onChange={(e) => {
                          setSelectedVercelProjectId(e.target.value);
                          setVercelUpdateHint(null);
                        }}
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
                        onChange={(e) => {
                          setVercelEnvKey(e.target.value);
                          setVercelUpdateHint(null);
                        }}
                        className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 font-mono text-sm font-normal text-ink outline-none ring-accent/40 focus:ring-2"
                        placeholder="TURNSTILE_SECRET_KEY"
                        autoComplete="off"
                      />
                    </label>
                  </div>
                  <div className="mt-3">
                    <DeployTargetsPicker selected={vercelTargets} onToggle={toggleVercelTarget} />
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
                      onClick={() => void updateVercelWithTurnstileSecret()}
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
              {supabaseIntegration ? (
                <>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p className="text-xs text-ink-muted">
                      Scrive il nuovo valore nei secret delle Edge Functions Supabase.
                    </p>
                    <button
                      type="button"
                      disabled={supabaseBusy}
                      onClick={() => void refreshSupabaseProjects()}
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
                        onChange={(e) => {
                          setSelectedSupabaseProjectRef(e.target.value);
                          setSupabaseUpdateHint(null);
                        }}
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
                        onChange={(e) => {
                          setSupabaseSecretName(e.target.value);
                          setSupabaseUpdateHint(null);
                        }}
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
                        <label key={secret.name} className="flex items-center gap-1.5 rounded-lg border border-surface-3 px-2 py-1">
                          <input
                            type="checkbox"
                            checked={selectedSupabaseSecretNames.includes(secret.name)}
                            onChange={() => toggleSupabaseSecretName(secret.name)}
                          />
                          <span className="font-mono">{secret.name}</span>
                        </label>
                      ))}
                    </div>
                  ) : null}
                  {supabaseUpdateHint ? <p className="mt-2 text-xs text-accent">{supabaseUpdateHint}</p> : null}
                  <p className="mt-2 text-xs text-ink-muted">
                    Supabase rende il valore disponibile subito alle Edge Functions.
                  </p>
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      disabled={supabaseBusy || !selectedSupabaseProjectRef || (selectedSupabaseSecretNames.length === 0 && !supabaseSecretName.trim())}
                      onClick={() => void updateSupabaseWithTurnstileSecret()}
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
                onClick={() => void handleCopyTurnstileSecret()}
                className="rounded-lg border border-surface-3 px-3 py-1.5 text-sm text-ink hover:border-accent/40"
              >
                Copia secret
              </button>
              <button
                type="button"
                onClick={() => {
                  setTurnstileResult(null);
                  setTurnstileCopyHint(null);
                  setWorkerUpdateHint(null);
                  setPagesUpdateHint(null);
                  setSecretsStoreUpdateHint(null);
                  setVercelUpdateHint(null);
                  setSupabaseUpdateHint(null);
                }}
                className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-surface-0"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {revealOpen && revealedToken ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-amber-500/30 bg-surface-1 p-6 shadow-2xl">
            <h3 className="text-sm font-semibold text-amber-100">{t("cloudflare.revealTitle")}</h3>
            <p className="mt-1 text-xs text-ink-muted">{t("cloudflare.revealLead")}</p>
            <pre className="mt-4 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-surface-0 p-3 font-mono text-xs text-ink">
              {revealedToken}
            </pre>
            {copyHint ? <p className="mt-2 text-xs text-accent">{copyHint}</p> : null}
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => void handleCopySecret()}
                className="rounded-lg border border-surface-3 px-3 py-1.5 text-sm text-ink hover:border-accent/40"
              >
                {t("cloudflare.copyAuto")}
              </button>
              <button
                type="button"
                onClick={closeReveal}
                className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-surface-0"
              >
                {t("cloudflare.close")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
