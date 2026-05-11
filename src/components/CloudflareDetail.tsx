import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { copySensitiveWithAutoClear } from "../clipboardSecure";
import type { DeployTarget } from "../secretDestinations";
import { AlertMessage } from "./provider/AlertMessage";
import { LinkedAccountBar } from "./provider/LinkedAccountBar";
import { ProviderHeader } from "./provider/ProviderHeader";
import { ProviderLoadingPanel } from "./provider/ProviderLoadingPanel";
import { errText } from "./provider/errors";
import { AccessServiceTokensSection } from "./cloudflare/AccessServiceTokensSection";
import { AccountTokensSection } from "./cloudflare/AccountTokensSection";
import {
  AccessRotateModal,
  AccessRotateResultModal,
  AccountTokenRotateModal,
  AccountTokenRotateResultModal,
  ConfirmRevealTokenModal,
  ConfirmUnlinkModal,
  RevealManagedTokenModal,
  TurnstileRotateModal,
} from "./cloudflare/CloudflareAccountModals";
import { CloudflareConnectForm } from "./cloudflare/CloudflareConnectForm";
import { PagesSecretsSection } from "./cloudflare/PagesSecretsSection";
import { SecretsStoreSection } from "./cloudflare/SecretsStoreSection";
import { StorageDiagnosticsPanel } from "./cloudflare/StorageDiagnosticsPanel";
import { TurnstileRotateResultModal } from "./cloudflare/TurnstileRotateResultModal";
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
        <CloudflareConnectForm
          accountId={accountId}
          apiToken={apiToken}
          busy={busy}
          onAccountIdChange={setAccountId}
          onApiTokenChange={setApiToken}
          onSubmit={(event) => void handleLink(event)}
        />
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
            <StorageDiagnosticsPanel diagnostics={storageDiagnostics} />
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

          <AccountTokensSection
            tokens={tokens}
            managedExternalIds={managedExternalIds}
            manualTokenId={manualTokenId}
            busy={busy}
            rotateBusy={rotateBusy}
            onManualTokenIdChange={setManualTokenId}
            onManualRotate={openManualRotate}
            onTrackToken={(token) => void trackToken(token)}
            onRotateToken={openRotateModal}
          />
          <p className="text-xs text-ink-muted">{t("cloudflare.footnote")}</p>
        </div>
      )}

      {rotateTarget ? (
        <AccountTokenRotateModal
          target={rotateTarget}
          revokeOld={rotateRevokeOld}
          busy={rotateBusy}
          onRevokeOldChange={setRotateRevokeOld}
          onCancel={closeRotateModal}
          onConfirm={() => void confirmRotate()}
        />
      ) : null}
      {confirmRevealOpen ? (
        <ConfirmRevealTokenModal
          busy={busy}
          onCancel={() => setConfirmRevealOpen(false)}
          onConfirm={() => void openReveal()}
        />
      ) : null}
      {confirmUnlinkOpen ? (
        <ConfirmUnlinkModal
          busy={busy}
          onCancel={() => setConfirmUnlinkOpen(false)}
          onConfirm={() => void handleUnlink()}
        />
      ) : null}
      {rotateResult ? (
        <AccountTokenRotateResultModal
          result={rotateResult}
          copyHint={rotateCopyHint}
          onCopy={() => void handleCopyNewSecret()}
          onClose={closeRotateResult}
        />
      ) : null}
      {turnstileTarget ? (
        <TurnstileRotateModal
          target={turnstileTarget}
          busySitekey={turnstileBusySitekey}
          onCancel={() => setTurnstileTarget(null)}
          onRotate={(immediate) => void rotateTurnstileSecret(turnstileTarget, immediate)}
        />
      ) : null}
      {accessTarget ? (
        <AccessRotateModal
          target={accessTarget}
          busyId={accessBusyId}
          onCancel={() => setAccessTarget(null)}
          onRotate={(grace) => void rotateAccessServiceToken(accessTarget, grace)}
        />
      ) : null}
      {accessResult ? (
        <AccessRotateResultModal
          result={accessResult}
          copyHint={accessCopyHint}
          onCopy={() => void handleCopyAccessSecret()}
          onClose={() => {
            setAccessResult(null);
            setAccessCopyHint(null);
          }}
        />
      ) : null}
      {turnstileResult ? (
        <TurnstileRotateResultModal
          result={turnstileResult}
          copyHint={turnstileCopyHint}
          onCopy={() => void handleCopyTurnstileSecret()}
          onClose={() => {
            setTurnstileResult(null);
            setTurnstileCopyHint(null);
            setWorkerUpdateHint(null);
            setPagesUpdateHint(null);
            setSecretsStoreUpdateHint(null);
            setVercelUpdateHint(null);
            setSupabaseUpdateHint(null);
          }}
          workerScripts={workerScripts}
          workerSecrets={workerSecrets}
          selectedWorker={selectedWorker}
          workerSecretName={workerSecretName}
          workerBusy={workerBusy}
          workerUpdateHint={workerUpdateHint}
          onWorkerChange={(value) => {
            setSelectedWorker(value);
            setWorkerSecretName("");
            setWorkerUpdateHint(null);
          }}
          onWorkerSecretNameChange={(value) => {
            setWorkerSecretName(value);
            setWorkerUpdateHint(null);
          }}
          onWriteWorker={() => void updateWorkerWithTurnstileSecret()}
          pagesProjects={pagesProjects}
          selectedPagesProject={selectedPagesProject}
          pagesEnvironment={pagesEnvironment}
          pagesSecretName={pagesSecretName}
          pagesBusy={pagesBusy}
          pagesUpdateHint={pagesUpdateHint}
          onPagesProjectChange={(value) => {
            setSelectedPagesProject(value);
            setPagesUpdateHint(null);
          }}
          onPagesEnvironmentChange={(value) => {
            setPagesEnvironment(value);
            setPagesUpdateHint(null);
          }}
          onPagesSecretNameChange={(value) => {
            setPagesSecretName(value);
            setPagesUpdateHint(null);
          }}
          onWritePages={() => void updatePagesWithTurnstileSecret()}
          secretsStores={secretsStores}
          selectedSecretsStore={selectedSecretsStore}
          secretsStoreSecretName={secretsStoreSecretName}
          secretsStoreScopes={secretsStoreScopes}
          secretsStoreBusy={secretsStoreBusy}
          secretsStoreUpdateHint={secretsStoreUpdateHint}
          onSecretsStoreChange={(value) => {
            setSelectedSecretsStore(value);
            setSecretsStoreSecretId("");
            setSecretsStoreUpdateHint(null);
          }}
          onSecretsStoreSecretNameChange={(value) => {
            setSecretsStoreSecretName(value);
            setSecretsStoreSecretId("");
            setSecretsStoreUpdateHint(null);
          }}
          onSecretsStoreScopesChange={setSecretsStoreScopes}
          onWriteSecretsStore={() => void updateSecretsStoreWithTurnstileSecret()}
          hasVercelIntegration={Boolean(vercelIntegration)}
          vercelProjects={vercelProjects}
          selectedVercelProjectId={selectedVercelProjectId}
          vercelEnvKey={vercelEnvKey}
          vercelTargets={vercelTargets}
          vercelBusy={vercelBusy}
          vercelUpdateHint={vercelUpdateHint}
          onRefreshVercelProjects={() => void refreshVercelProjects()}
          onVercelProjectChange={(value) => {
            setSelectedVercelProjectId(value);
            setVercelUpdateHint(null);
          }}
          onVercelEnvKeyChange={(value) => {
            setVercelEnvKey(value);
            setVercelUpdateHint(null);
          }}
          onToggleVercelTarget={toggleVercelTarget}
          onWriteVercel={() => void updateVercelWithTurnstileSecret()}
          hasSupabaseIntegration={Boolean(supabaseIntegration)}
          supabaseProjects={supabaseProjects}
          supabaseSecrets={supabaseSecrets}
          selectedSupabaseProjectRef={selectedSupabaseProjectRef}
          supabaseSecretName={supabaseSecretName}
          selectedSupabaseSecretNames={selectedSupabaseSecretNames}
          supabaseBusy={supabaseBusy}
          supabaseUpdateHint={supabaseUpdateHint}
          onRefreshSupabaseProjects={() => void refreshSupabaseProjects()}
          onSupabaseProjectChange={(value) => {
            setSelectedSupabaseProjectRef(value);
            setSupabaseUpdateHint(null);
          }}
          onSupabaseSecretNameChange={(value) => {
            setSupabaseSecretName(value);
            setSupabaseUpdateHint(null);
          }}
          onToggleSupabaseSecretName={toggleSupabaseSecretName}
          onWriteSupabase={() => void updateSupabaseWithTurnstileSecret()}
        />
      ) : null}
      {revealOpen && revealedToken ? (
        <RevealManagedTokenModal
          token={revealedToken}
          copyHint={copyHint}
          onCopy={() => void handleCopySecret()}
          onClose={closeReveal}
        />
      ) : null}
    </div>
  );
}
