import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { copySensitiveWithAutoClear } from "../clipboardSecure";
import type { Integration, OauthGoogleStatusDto } from "../types";
import { AlertMessage } from "./provider/AlertMessage";
import { CredentialGuide } from "./provider/CredentialGuide";
import { LinkedAccountBar } from "./provider/LinkedAccountBar";
import { ProviderHeader } from "./provider/ProviderHeader";
import { SecretPropagationModal } from "./provider/SecretPropagationModal";
import { errText } from "./provider/errors";
import { useSecretPropagation } from "./provider/useSecretPropagation";

type Props = {
  integration: Integration;
  integrations?: Integration[];
  onBack: () => void;
};

export function OauthGoogleDetail({ integration, integrations = [], onBack }: Props) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<OauthGoogleStatusDto | null>(null);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [revealedSecret, setRevealedSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [propagationOpen, setPropagationOpen] = useState(false);

  const integrationId = integration.id;
  const linked = status?.linked ?? false;
  const handlePropagationError = useCallback((message: string) => setError(message), []);
  const propagation = useSecretPropagation({
    integrations,
    defaultEnvKey: "GOOGLE_CLIENT_SECRET",
    secretValue: revealedSecret,
    onError: handlePropagationError,
  });
  const propagationVercelIntegrationId = propagation.vercelIntegration?.id;
  const refreshPropagationVercelProjects = propagation.vercel.refreshProjects;

  const refreshStatus = useCallback(async () => {
    try {
      const next = await invoke<OauthGoogleStatusDto>("oauth_google_status", { integrationId });
      setStatus(next);
      setClientId(next.clientId ?? "");
    } catch {
      setStatus({ linked: false, clientId: null, label: null });
    }
  }, [integrationId]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (linked && propagationVercelIntegrationId) void refreshPropagationVercelProjects();
  }, [linked, propagationVercelIntegrationId, refreshPropagationVercelProjects]);

  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    setHint(null);
    try {
      const generatedSecret = clientSecret.trim();
      const next = await invoke<OauthGoogleStatusDto>("oauth_google_link", {
        payload: {
          integrationId,
          clientId: clientId.trim(),
          clientSecret: generatedSecret || null,
          label: null,
        },
      });
      setStatus(next);
      setClientSecret("");
      setRevealedSecret(generatedSecret);
      setPropagationOpen(false);
      setHint(generatedSecret ? t("googleOauth.secretSaved") : t("googleOauth.clientLinked"));
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  async function unlink() {
    setBusy(true);
    setError(null);
    try {
      await invoke("oauth_google_unlink", { integrationId });
      setStatus({ linked: false, clientId: null, label: null });
      setClientId("");
      setClientSecret("");
      setRevealedSecret("");
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-auto px-10 py-10">
      <ProviderHeader
        providerLabel="GOOGLE OAUTH"
        title={integration.label}
        description={t("googleOauth.description")}
        backLabel={t("common.backToServices")}
        onBack={onBack}
      />
      <AlertMessage message={error} />
      <CredentialGuide
        title={t("googleOauth.guideTitle")}
        steps={[
          t("googleOauth.guide.step1"),
          t("googleOauth.guide.step2"),
          t("googleOauth.guide.step3"),
        ]}
        links={[{ href: "https://console.cloud.google.com/auth/clients", label: "Google Auth Platform Clients" }]}
      />
      {linked ? (
        <LinkedAccountBar
          details={<><p className="text-xs text-ink-muted">{t("googleOauth.linkedClient")}</p><p className="font-mono text-sm text-ink">{status?.clientId}</p></>}
          actions={<button type="button" disabled={busy} onClick={() => void unlink()} className="rounded-lg border border-rose-500/40 px-3 py-1.5 text-sm text-rose-200 hover:bg-rose-500/10">{t("common.unlink")}</button>}
        />
      ) : null}
      <form onSubmit={(e) => void save(e)} className="max-w-2xl space-y-4 rounded-2xl border border-surface-3/80 bg-surface-1/80 p-6">
        <div>
          <h2 className="text-sm font-semibold text-ink">{linked ? t("googleOauth.saveGeneratedSecret") : t("googleOauth.connectClient")}</h2>
          <p className="mt-1 text-xs text-ink-muted">
            {t("googleOauth.connectLead")}
          </p>
        </div>
        <a
          href="https://console.cloud.google.com/auth/clients"
          target="_blank"
          rel="noreferrer"
          className="inline-flex rounded-lg border border-accent/50 px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent/10"
        >
          {t("googleOauth.openConsole")}
        </a>
        <label className="block space-y-1.5 text-xs font-semibold text-ink-muted">
          <span>Google Client ID</span>
          <input value={clientId} onChange={(e) => setClientId(e.target.value)} className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 font-mono text-sm font-normal text-ink outline-none ring-accent/40 focus:ring-2" autoComplete="off" />
        </label>
        <label className="block space-y-1.5 text-xs font-semibold text-ink-muted">
          <span>{linked ? t("googleOauth.generatedSecret") : t("googleOauth.optionalSecret")}</span>
          <input type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 font-mono text-sm font-normal text-ink outline-none ring-accent/40 focus:ring-2" autoComplete="off" />
          <span className="block font-normal text-ink-muted">
            {t("googleOauth.secretHint")}
          </span>
        </label>
        {hint ? <p className="text-xs text-accent">{hint}</p> : null}
        <button type="submit" disabled={busy || !clientId.trim()} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-surface-0 disabled:opacity-50">
          {busy ? t("manualProviders.saving") : linked ? t("googleOauth.saveChanges") : t("googleOauth.linkClient")}
        </button>
      </form>
      {revealedSecret ? (
        <section className="max-w-2xl rounded-2xl border border-amber-500/30 bg-surface-1/80 p-5">
          <h2 className="text-sm font-semibold text-amber-100">{t("googleOauth.resultTitle")}</h2>
          <p className="mt-1 text-xs text-ink-muted">
            {t("googleOauth.resultLead")}
          </p>
          <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-surface-0 p-3 font-mono text-xs text-ink">{revealedSecret}</pre>
          <div className="mt-3 flex justify-end">
            <button type="button" onClick={() => void copySensitiveWithAutoClear(revealedSecret).then(() => setHint(t("manualProviders.copied")))} className="rounded-lg border border-surface-3 px-3 py-1.5 text-sm text-ink hover:border-accent/40">{t("manualProviders.copySecret")}</button>
          </div>
          <div className="mt-3 flex justify-end">
            <button type="button" onClick={() => setPropagationOpen(true)} className="rounded-lg border border-accent/50 px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent/10">{t("propagation.title")}</button>
          </div>
        </section>
      ) : null}
      {revealedSecret ? (
        <SecretPropagationModal
          open={propagationOpen}
          valueLabel={t("googleOauth.valueLabel")}
          state={propagation}
          onClose={() => setPropagationOpen(false)}
        />
      ) : null}
    </div>
  );
}
