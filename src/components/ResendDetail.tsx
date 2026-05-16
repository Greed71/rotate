import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { copySensitiveWithAutoClear } from "../clipboardSecure";
import type { Integration, ResendApiKeyRow, ResendRotateResult, ResendStatusDto } from "../types";
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

export function ResendDetail({ integration, integrations = [], onBack }: Props) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<ResendStatusDto | null>(null);
  const [apiToken, setApiToken] = useState("");
  const [apiKeys, setApiKeys] = useState<ResendApiKeyRow[]>([]);
  const [permission, setPermission] = useState("sending_access");
  const [deleteOld, setDeleteOld] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResendRotateResult | null>(null);
  const [copyHint, setCopyHint] = useState<string | null>(null);
  const [propagationOpen, setPropagationOpen] = useState(false);

  const integrationId = integration.id;
  const linked = status?.linked ?? false;
  const handlePropagationError = useCallback((message: string) => setError(message), []);
  const propagation = useSecretPropagation({
    integrations,
    defaultEnvKey: "RESEND_API_KEY",
    secretValue: result?.token ?? "",
    onError: handlePropagationError,
  });
  const propagationVercelIntegrationId = propagation.vercelIntegration?.id;
  const refreshPropagationVercelProjects = propagation.vercel.refreshProjects;

  const refreshStatus = useCallback(async () => {
    try {
      setStatus(await invoke<ResendStatusDto>("resend_status", { integrationId }));
    } catch {
      setStatus({ linked: false });
    }
  }, [integrationId]);

  const refreshKeys = useCallback(async () => {
    setLoading(true);
    try {
      setApiKeys(await invoke<ResendApiKeyRow[]>("resend_list_api_keys", { integrationId }));
      setError(null);
    } catch (e) {
      setApiKeys([]);
      setError(errText(e));
    } finally {
      setLoading(false);
    }
  }, [integrationId]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (linked) void refreshKeys();
  }, [linked, refreshKeys]);

  useEffect(() => {
    if (result && propagationVercelIntegrationId) void refreshPropagationVercelProjects();
  }, [result, propagationVercelIntegrationId, refreshPropagationVercelProjects]);

  async function handleLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setStatus(await invoke<ResendStatusDto>("resend_link", { integrationId, apiToken: apiToken.trim() }));
      setApiToken("");
      await refreshKeys();
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  async function rotateKey(key?: ResendApiKeyRow) {
    setBusy(true);
    setError(null);
    setResult(null);
    setCopyHint(null);
    try {
      const name = key ? `${key.name} - rotate ${new Date().toISOString().slice(0, 10)}` : `Rotate ${new Date().toISOString().slice(0, 10)}`;
      const next = await invoke<ResendRotateResult>("resend_rotate_api_key", {
        payload: {
          integrationId,
          sourceKeyId: key?.id ?? null,
          name,
          permission,
          deleteOld,
        },
      });
      setResult(next);
      setPropagationOpen(false);
      await refreshKeys();
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  async function unlink() {
    setBusy(true);
    try {
      await invoke("resend_unlink", { integrationId });
      setStatus({ linked: false });
      setApiKeys([]);
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-auto px-10 py-10">
      <ProviderHeader
        providerLabel="RESEND"
        title={integration.label}
        description={t("resend.description")}
        backLabel={t("common.backToServices")}
        onBack={onBack}
      />
      <AlertMessage message={error} />
      {!linked ? (
        <form onSubmit={(e) => void handleLink(e)} className="max-w-xl space-y-4 rounded-2xl border border-surface-3/80 bg-surface-1/80 p-6">
          <CredentialGuide
            steps={[
              t("resend.guide.step1"),
              t("resend.guide.step2"),
              t("resend.guide.step3"),
            ]}
            links={[{ href: "https://resend.com/api-keys", label: "Resend API Keys" }]}
          />
          <label className="block space-y-1.5 text-xs font-semibold text-ink-muted">
            <span>{t("resend.managementKey")}</span>
            <input type="password" value={apiToken} onChange={(e) => setApiToken(e.target.value)} className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 font-mono text-sm font-normal text-ink outline-none ring-accent/40 focus:ring-2" autoComplete="off" />
          </label>
          <button type="submit" disabled={busy} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-surface-0 disabled:opacity-50">
            {busy ? t("common.verifying") : t("resend.connectAccount")}
          </button>
        </form>
      ) : (
        <div className="space-y-6">
          <LinkedAccountBar
            details={<><p className="text-xs text-ink-muted">{t("common.linkedAccount")}</p><p className="text-sm text-ink">{t("resend.verified")}</p></>}
            actions={<><button type="button" disabled={busy} onClick={() => void refreshKeys()} className="rounded-lg border border-surface-3 px-3 py-1.5 text-sm text-ink hover:border-accent/40">{t("resend.refreshList")}</button><button type="button" disabled={busy} onClick={() => void unlink()} className="rounded-lg border border-rose-500/40 px-3 py-1.5 text-sm text-rose-200 hover:bg-rose-500/10">{t("common.unlink")}</button></>}
          />
          <section className="space-y-3 rounded-2xl border border-surface-3/80 bg-surface-1/60 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-ink">{t("resend.keysTitle")}</h2>
                <p className="mt-1 text-xs text-ink-muted">{t("resend.keysLead")}</p>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <label className="min-w-[190px] text-xs font-semibold text-ink-muted">
                  <span className="mb-1 block">{t("resend.permission")}</span>
                  <select value={permission} onChange={(e) => setPermission(e.target.value)} className="rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 text-sm font-normal text-ink outline-none ring-accent/40 focus:ring-2">
                    <option value="sending_access">Sending access</option>
                    <option value="full_access">Full access</option>
                  </select>
                </label>
                <DestructiveToggle
                  checked={deleteOld}
                  title={t("resend.revokeOld")}
                  description={t("resend.afterEnvUpdate")}
                  onChange={setDeleteOld}
                />
              </div>
            </div>
            {loading ? <ProviderLoadingPanel title={t("resend.loadingTitle")} description={t("resend.loadingDescription")} /> : (
              <div className="overflow-hidden rounded-xl border border-surface-3/80">
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface-2/80 text-[11px] uppercase tracking-wide text-ink-muted"><tr><th className="px-4 py-3 font-semibold">{t("resend.colName")}</th><th className="px-4 py-3 font-semibold">{t("resend.colCreated")}</th><th className="px-4 py-3 font-semibold">{t("resend.colLastUsed")}</th><th className="px-4 py-3 font-semibold">{t("resend.colActions")}</th></tr></thead>
                  <tbody className="divide-y divide-surface-3/60 bg-surface-1/40">
                    {apiKeys.length === 0 ? <tr><td colSpan={4} className="px-4 py-5 text-center text-ink-muted">{t("resend.noKeys")}</td></tr> : apiKeys.map((key) => (
                      <tr key={key.id} className="text-ink">
                        <td className="px-4 py-3 font-medium">{key.name}</td>
                        <td className="px-4 py-3 text-xs text-ink-muted">{key.createdAt ?? "-"}</td>
                        <td className="px-4 py-3 text-xs text-ink-muted">{key.lastUsedAt ?? "-"}</td>
                        <td className="px-4 py-3"><button type="button" disabled={busy} onClick={() => void rotateKey(key)} className="rounded-lg border border-accent/50 px-2.5 py-1 text-xs font-medium text-accent hover:bg-accent/10 disabled:opacity-50">{t("resend.rotate")}</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <button type="button" disabled={busy} onClick={() => void rotateKey()} className="rounded-lg border border-surface-3 px-3 py-1.5 text-sm text-ink hover:border-accent/40 disabled:opacity-50">{t("resend.createKey")}</button>
          </section>
        </div>
      )}
      {result ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-amber-500/30 bg-surface-1 p-6 shadow-2xl">
            <h3 className="text-sm font-semibold text-amber-100">{t("resend.resultTitle")}</h3>
            <p className="mt-1 text-xs text-ink-muted">{t("resend.resultLead")}</p>
            <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-surface-0 p-3 font-mono text-xs text-ink">{result.token}</pre>
            {copyHint ? <p className="mt-2 text-xs text-accent">{copyHint}</p> : null}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setPropagationOpen(true)} className="rounded-lg border border-accent/50 px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent/10">{t("resend.propagateKey")}</button>
              <button type="button" onClick={() => void copySensitiveWithAutoClear(result.token).then(() => setCopyHint(t("resend.copied")))} className="rounded-lg border border-surface-3 px-3 py-1.5 text-sm text-ink hover:border-accent/40">{t("resend.copyKey")}</button>
              <button type="button" onClick={() => setResult(null)} className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-surface-0">{t("common.close")}</button>
            </div>
          </div>
        </div>
      ) : null}
      {result ? (
        <SecretPropagationModal
          open={propagationOpen}
          valueLabel={t("resend.valueLabel")}
          state={propagation}
          onClose={() => setPropagationOpen(false)}
        />
      ) : null}
    </div>
  );
}
