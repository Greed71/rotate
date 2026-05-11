import type { FormEvent, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { CredentialGuide } from "../provider/CredentialGuide";

type Props = {
  accountId: string;
  apiToken: string;
  busy: boolean;
  onAccountIdChange: (value: string) => void;
  onApiTokenChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
};

export function CloudflareConnectForm({
  accountId,
  apiToken,
  busy,
  onAccountIdChange,
  onApiTokenChange,
  onSubmit,
}: Props) {
  const { t } = useTranslation();
  const guideSteps: ReactNode[] = [
    "Apri la dashboard Cloudflare e copia l'Account ID dalla pagina dell'account.",
    <>
      Crea un API token da{" "}
      <span className="font-medium text-ink">My Profile / API Tokens</span> oppure da{" "}
      <span className="font-medium text-ink">Manage Account / API Tokens</span>.
    </>,
    <>
      Per Turnstile servono almeno{" "}
      <span className="font-mono text-ink">Turnstile Sites Read</span> e{" "}
      <span className="font-mono text-ink">Turnstile Sites Write</span>. Aggiungi Pages,
      Workers, Access o Secrets Store solo se vuoi gestire anche quelle destinazioni.
    </>,
    "Dopo la creazione Cloudflare mostra il token una sola volta: copialo subito e incollalo qui.",
  ];

  return (
    <form
      onSubmit={onSubmit}
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
        steps={guideSteps}
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
          onChange={(event) => onAccountIdChange(event.target.value)}
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
          onChange={(event) => onApiTokenChange(event.target.value)}
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
  );
}
