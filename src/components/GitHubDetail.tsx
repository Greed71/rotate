import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { GithubStatusDto, Integration } from "../types";
import { AlertMessage } from "./provider/AlertMessage";
import { CredentialGuide } from "./provider/CredentialGuide";
import { LinkedAccountBar } from "./provider/LinkedAccountBar";
import { ProviderHeader } from "./provider/ProviderHeader";
import { errText } from "./provider/errors";

type Props = {
  integration: Integration;
  onBack: () => void;
};

export function GitHubDetail({ integration, onBack }: Props) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<GithubStatusDto | null>(null);
  const [apiToken, setApiToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const integrationId = integration.id;
  const linked = status?.linked ?? false;

  const refreshStatus = useCallback(async () => {
    try {
      setStatus(await invoke<GithubStatusDto>("github_status", { integrationId }));
    } catch {
      setStatus({ linked: false, login: null });
    }
  }, [integrationId]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  async function handleLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const next = await invoke<GithubStatusDto>("github_link", {
        integrationId,
        apiToken: apiToken.trim(),
      });
      setStatus(next);
      setApiToken("");
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
      await invoke("github_unlink", { integrationId });
      setStatus({ linked: false, login: null });
      setApiToken("");
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-auto px-10 py-10">
      <ProviderHeader
        providerLabel="GITHUB"
        title={integration.label}
        description={t("github.description")}
        backLabel={t("common.backToServices")}
        onBack={onBack}
      />

      <AlertMessage message={error} />

      {!linked ? (
        <form
          onSubmit={(event) => void handleLink(event)}
          className="max-w-xl space-y-4 rounded-2xl border border-surface-3/80 bg-surface-1/80 p-6"
        >
          <div>
            <h2 className="text-sm font-semibold text-ink">{t("github.connectTitle")}</h2>
            <p className="mt-1 text-xs text-ink-muted">
              {t("github.connectLead")}
            </p>
          </div>
          <CredentialGuide
            steps={[
              t("github.guide.step1"),
              t("github.guide.step2"),
              t("github.guide.step3"),
              t("github.guide.step4"),
            ]}
            links={[
              {
                href: "https://github.com/settings/personal-access-tokens",
                label: "GitHub personal access tokens",
              },
              {
                href: "https://docs.github.com/en/rest/actions/secrets",
                label: "Actions Secrets API",
              },
            ]}
          />
          <label className="block space-y-1.5 text-xs font-semibold text-ink-muted">
            <span>{t("github.tokenLabel")}</span>
            <input
              type="password"
              value={apiToken}
              onChange={(event) => setApiToken(event.target.value)}
              className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 font-mono text-sm font-normal text-ink outline-none ring-accent/40 focus:ring-2"
              autoComplete="off"
            />
          </label>
          <button
            type="submit"
            disabled={busy || !apiToken.trim()}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-surface-0 hover:brightness-110 disabled:opacity-50"
          >
            {busy ? t("common.verifying") : t("github.saveVerify")}
          </button>
        </form>
      ) : (
        <LinkedAccountBar
          details={
            <>
              <p className="text-xs text-ink-muted">{t("common.linkedAccount")}</p>
              <p className="font-mono text-sm text-ink">{status?.login ?? "GitHub"}</p>
              <p className="mt-1 text-xs text-ink-muted">
                {t("github.linkedLead")}
              </p>
            </>
          }
          actions={
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleUnlink()}
              className="rounded-lg border border-rose-500/40 px-3 py-1.5 text-sm text-rose-200 hover:bg-rose-500/10 disabled:opacity-50"
            >
              {t("common.unlink")}
            </button>
          }
        />
      )}
    </div>
  );
}
