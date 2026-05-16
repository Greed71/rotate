import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { copySensitiveWithAutoClear } from "../clipboardSecure";
import type { Integration, ManualSecretStatusDto } from "../types";
import { AlertMessage } from "./provider/AlertMessage";
import { CredentialGuide } from "./provider/CredentialGuide";
import { LinkedAccountBar } from "./provider/LinkedAccountBar";
import { ProviderHeader } from "./provider/ProviderHeader";
import { SecretPropagationModal } from "./provider/SecretPropagationModal";
import { errText } from "./provider/errors";
import { useSecretPropagation } from "./provider/useSecretPropagation";

type ManualProvider = "stripe" | "paypal" | "facebook" | "discord" | "twitch";

type ProviderCopy = {
  label: string;
  defaultEnvKey: string;
  links: Array<{ href: string; label: string }>;
};

const COPY: Record<ManualProvider, ProviderCopy> = {
  stripe: {
    label: "STRIPE",
    links: [{ href: "https://dashboard.stripe.com/apikeys", label: "Stripe API keys" }],
    defaultEnvKey: "STRIPE_SECRET_KEY",
  },
  paypal: {
    label: "PAYPAL",
    links: [{ href: "https://developer.paypal.com/dashboard/applications/live", label: "PayPal Apps & Credentials" }],
    defaultEnvKey: "PAYPAL_CLIENT_SECRET",
  },
  facebook: {
    label: "FACEBOOK",
    links: [{ href: "https://developers.facebook.com/apps/", label: "Meta for Developers Apps" }],
    defaultEnvKey: "FACEBOOK_APP_SECRET",
  },
  discord: {
    label: "DISCORD",
    links: [{ href: "https://discord.com/developers/applications", label: "Discord Developer Portal" }],
    defaultEnvKey: "DISCORD_BOT_TOKEN",
  },
  twitch: {
    label: "TWITCH",
    links: [{ href: "https://dev.twitch.tv/console/apps", label: "Twitch Developer Console" }],
    defaultEnvKey: "TWITCH_CLIENT_SECRET",
  },
};

type Props = {
  provider: ManualProvider;
  integration: Integration;
  integrations?: Integration[];
  onBack: () => void;
};

export function ManualSecretProviderDetail({
  provider,
  integration,
  integrations = [],
  onBack,
}: Props) {
  const { t } = useTranslation();
  const copy = COPY[provider];
  const [status, setStatus] = useState<ManualSecretStatusDto | null>(null);
  const [publicId, setPublicId] = useState("");
  const [secret, setSecret] = useState("");
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
    defaultEnvKey: copy.defaultEnvKey,
    secretValue: revealedSecret,
    onError: handlePropagationError,
  });
  const propagationVercelIntegrationId = propagation.vercelIntegration?.id;
  const refreshPropagationVercelProjects = propagation.vercel.refreshProjects;

  const refreshStatus = useCallback(async () => {
    try {
      const next = await invoke<ManualSecretStatusDto>(`${provider}_status`, { integrationId });
      setStatus(next);
      setPublicId(next.publicId ?? "");
    } catch {
      setStatus({ linked: false, publicId: null, label: null });
    }
  }, [integrationId, provider]);

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
      const nextSecret = secret.trim();
      const next = await invoke<ManualSecretStatusDto>(`${provider}_link`, {
        payload: {
          integrationId,
          publicId: publicId.trim(),
          secret: nextSecret || null,
          label: null,
        },
      });
      setStatus(next);
      setSecret("");
      setRevealedSecret(nextSecret);
      setPropagationOpen(false);
      setHint(nextSecret ? t("manualProviders.secretSaved") : t("manualProviders.referenceSaved"));
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
      await invoke(`${provider}_unlink`, { integrationId });
      setStatus({ linked: false, publicId: null, label: null });
      setPublicId("");
      setSecret("");
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
        providerLabel={copy.label}
        title={integration.label}
        description={t(`manualProviders.${provider}.description`)}
        backLabel={t("common.backToServices")}
        onBack={onBack}
      />
      <AlertMessage message={error} />
      <CredentialGuide
        title={t(`manualProviders.${provider}.guideTitle`)}
        steps={[
          t(`manualProviders.${provider}.steps.0`),
          t(`manualProviders.${provider}.steps.1`),
          t(`manualProviders.${provider}.steps.2`),
        ]}
        links={copy.links}
      />
      {linked ? (
        <LinkedAccountBar
          details={
            <>
              <p className="text-xs text-ink-muted">{t("manualProviders.linkedReference")}</p>
              <p className="font-mono text-sm text-ink">{status?.publicId}</p>
            </>
          }
          actions={
            <button
              type="button"
              disabled={busy}
              onClick={() => void unlink()}
              className="rounded-lg border border-rose-500/40 px-3 py-1.5 text-sm text-rose-200 hover:bg-rose-500/10"
            >
              {t("common.unlink")}
            </button>
          }
        />
      ) : null}
      <form onSubmit={(e) => void save(e)} className="max-w-2xl space-y-4 rounded-2xl border border-surface-3/80 bg-surface-1/80 p-6">
        <div>
          <h2 className="text-sm font-semibold text-ink">
            {linked
              ? t("manualProviders.saveNewSecret")
              : t("manualProviders.connectTitle", { title: t(`manualProviders.${provider}.title`) })}
          </h2>
          <p className="mt-1 text-xs text-ink-muted">
            {t(`manualProviders.${provider}.publicIdHint`)} {t("manualProviders.secretShownAfterSave")}
          </p>
        </div>
        <label className="block space-y-1.5 text-xs font-semibold text-ink-muted">
          <span>{t(`manualProviders.${provider}.publicIdLabel`)}</span>
          <input
            value={publicId}
            onChange={(e) => setPublicId(e.target.value)}
            className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 font-mono text-sm font-normal text-ink outline-none ring-accent/40 focus:ring-2"
            autoComplete="off"
          />
        </label>
        <label className="block space-y-1.5 text-xs font-semibold text-ink-muted">
          <span>{t(`manualProviders.${provider}.secretLabel`)}</span>
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 font-mono text-sm font-normal text-ink outline-none ring-accent/40 focus:ring-2"
            autoComplete="off"
          />
          <span className="block font-normal text-ink-muted">
            {t("manualProviders.secretOptional")}
          </span>
        </label>
        {hint ? <p className="text-xs text-accent">{hint}</p> : null}
        <button
          type="submit"
          disabled={busy || !publicId.trim()}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-surface-0 disabled:opacity-50"
        >
          {busy ? t("manualProviders.saving") : linked ? t("manualProviders.saveSecret") : t("manualProviders.connect")}
        </button>
      </form>
      {revealedSecret ? (
        <section className="max-w-2xl rounded-2xl border border-amber-500/30 bg-surface-1/80 p-5">
          <h2 className="text-sm font-semibold text-amber-100">{t(`manualProviders.${provider}.resultTitle`)}</h2>
          <p className="mt-1 text-xs text-ink-muted">
            {t("manualProviders.resultLead")}
          </p>
          <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-surface-0 p-3 font-mono text-xs text-ink">
            {revealedSecret}
          </pre>
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => setPropagationOpen(true)}
              className="rounded-lg border border-accent/50 px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent/10"
            >
              {t("propagation.title")}
            </button>
            <button
              type="button"
              onClick={() => void copySensitiveWithAutoClear(revealedSecret).then(() => setHint(t("manualProviders.copied")))}
              className="rounded-lg border border-surface-3 px-3 py-1.5 text-sm text-ink hover:border-accent/40"
            >
              {t("manualProviders.copySecret")}
            </button>
          </div>
        </section>
      ) : null}
      {revealedSecret ? (
        <SecretPropagationModal
          open={propagationOpen}
          valueLabel={t(`manualProviders.${provider}.valueLabel`)}
          state={propagation}
          onClose={() => setPropagationOpen(false)}
        />
      ) : null}
    </div>
  );
}
