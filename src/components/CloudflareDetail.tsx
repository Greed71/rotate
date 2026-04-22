import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { copySensitiveWithAutoClear } from "../clipboardSecure";
import type {
  CfTokenRow,
  CloudflareRotateResultDto,
  CloudflareStatusDto,
  Integration,
} from "../types";

function errText(e: unknown): string {
  if (typeof e === "string") return e;
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return String(e);
}

type Props = {
  integration: Integration;
  onBack: () => void;
};

export function CloudflareDetail({ integration, onBack }: Props) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<CloudflareStatusDto | null>(null);
  const [tokens, setTokens] = useState<CfTokenRow[]>([]);
  const [accountId, setAccountId] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealOpen, setRevealOpen] = useState(false);
  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const [copyHint, setCopyHint] = useState<string | null>(null);
  const [rotateTarget, setRotateTarget] = useState<CfTokenRow | null>(null);
  const [rotateRevokeOld, setRotateRevokeOld] = useState(true);
  const [rotateUpdateVault, setRotateUpdateVault] = useState(false);
  const [rotateBusy, setRotateBusy] = useState(false);
  const [rotateResult, setRotateResult] = useState<CloudflareRotateResultDto | null>(null);
  const [rotateCopyHint, setRotateCopyHint] = useState<string | null>(null);

  const integrationId = integration.id;

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

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (status?.linked) void refreshTokens();
    else setTokens([]);
  }, [status?.linked, refreshTokens]);

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
      await refreshTokens();
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleUnlink() {
    if (!confirm(t("cloudflare.confirmUnlink"))) return;
    setBusy(true);
    setError(null);
    try {
      await invoke("cloudflare_unlink", { integrationId });
      setStatus({ linked: false, accountId: null });
      setTokens([]);
      setApiToken("");
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  const linked = status?.linked ?? false;

  async function openReveal() {
    if (!confirm(t("cloudflare.confirmReveal"))) return;
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
    setRotateUpdateVault(false);
    setRotateTarget(tok);
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
        updateVaultSecret: rotateUpdateVault,
      });
      setRotateTarget(null);
      setRotateResult(res);
      setRotateCopyHint(null);
      await refreshTokens();
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

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-auto px-10 py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="mb-2 text-xs font-medium text-accent hover:underline"
          >
            {t("cloudflare.back")}
          </button>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            {t("providers.cloudflare.title")}
          </p>
          <h1 className="text-2xl font-semibold text-ink">{integration.label}</h1>
          <p className="mt-1 text-sm text-ink-muted">
            <Trans
              i18nKey="cloudflare.intro"
              components={[
                <span className="font-mono text-xs" key="0" />,
                <span className="font-mono text-xs" key="1" />,
              ]}
            />
          </p>
        </div>
      </header>

      {error ? (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      {!linked ? (
        <form
          onSubmit={(e) => void handleLink(e)}
          className="max-w-lg space-y-4 rounded-2xl border border-surface-3/80 bg-surface-1/80 p-6"
        >
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
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-surface-3/80 bg-surface-1/80 px-5 py-4">
            <div>
              <p className="text-xs text-ink-muted">{t("cloudflare.linked")}</p>
              <p className="font-mono text-sm text-ink">{status?.accountId}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void openReveal()}
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
                onClick={() => void handleUnlink()}
                className="rounded-lg border border-rose-500/40 px-3 py-1.5 text-sm text-rose-200 hover:bg-rose-500/10"
              >
                {t("cloudflare.unlink")}
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-surface-3/80">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-2/80 text-[11px] uppercase tracking-wide text-ink-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">{t("cloudflare.colName")}</th>
                  <th className="px-4 py-3 font-semibold">{t("cloudflare.colStatus")}</th>
                  <th className="px-4 py-3 font-semibold">{t("cloudflare.colExpiry")}</th>
                  <th className="px-4 py-3 font-mono text-[10px] font-semibold">{t("cloudflare.colId")}</th>
                  <th className="px-4 py-3 font-semibold">{t("cloudflare.colActions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-3/60 bg-surface-1/40">
                {tokens.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-ink-muted">
                      {t("cloudflare.noTokens")}
                    </td>
                  </tr>
                ) : (
                  tokens.map((tok) => (
                    <tr key={tok.id} className="text-ink">
                      <td className="px-4 py-3 font-medium">{tok.name}</td>
                      <td className="px-4 py-3 text-ink-muted">{tok.status}</td>
                      <td className="px-4 py-3 text-ink-muted">
                        {tok.expiresOn ?? "\u2014"}
                      </td>
                      <td className="max-w-[120px] truncate px-4 py-3 font-mono text-[11px] text-ink-muted">
                        {tok.id}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          disabled={busy || rotateBusy}
                          onClick={() => openRotateModal(tok)}
                          className="rounded-lg border border-accent/50 px-2.5 py-1 text-xs font-medium text-accent hover:bg-accent/10 disabled:opacity-50"
                        >
                          {t("cloudflare.rotate")}
                        </button>
                      </td>
                    </tr>
                  ))
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
                checked={rotateUpdateVault}
                onChange={(e) => setRotateUpdateVault(e.target.checked)}
                className="mt-1 rounded border-surface-3"
              />
              <span>{t("cloudflare.rotateUpdateVault")}</span>
            </label>
            <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm text-ink">
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
                {t("cloudflare.resultVault")}{" "}
                {rotateResult.updatedVaultSecret ? (
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
