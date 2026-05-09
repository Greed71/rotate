import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { copySensitiveWithAutoClear } from "../clipboardSecure";
import type {
  CfTokenRow,
  CloudflareRotateResultDto,
  CloudflareStatusDto,
  Integration,
  ManagedSecretDto,
  SecretStorageDiagnosticsDto,
  TurnstileRotateResult,
  TurnstileWidgetRow,
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
  const [turnstileWidgets, setTurnstileWidgets] = useState<TurnstileWidgetRow[]>([]);
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
  const [turnstileBusySitekey, setTurnstileBusySitekey] = useState<string | null>(null);
  const [turnstileTarget, setTurnstileTarget] = useState<TurnstileWidgetRow | null>(null);
  const [turnstileResult, setTurnstileResult] = useState<TurnstileRotateResult | null>(null);
  const [turnstileCopyHint, setTurnstileCopyHint] = useState<string | null>(null);

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

  const refreshTurnstileWidgets = useCallback(async () => {
    try {
      const list = await invoke<TurnstileWidgetRow[]>("cloudflare_list_turnstile_widgets", {
        integrationId,
      });
      setTurnstileWidgets(list);
    } catch (e) {
      setTurnstileWidgets([]);
      setError(errText(e));
    }
  }, [integrationId]);

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
      void refreshTokens();
      void refreshTurnstileWidgets();
      void refreshManagedSecrets();
    } else {
      setTokens([]);
      setTurnstileWidgets([]);
      setManagedSecrets([]);
    }
  }, [status?.linked, refreshTokens, refreshTurnstileWidgets, refreshManagedSecrets]);

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
    try {
      const res = await invoke<TurnstileRotateResult>("cloudflare_rotate_turnstile_secret", {
        integrationId,
        sitekey: widget.sitekey,
        invalidateImmediately: immediate,
      });
      setTurnstileTarget(null);
      setTurnstileResult(res);
      setTurnstileCopyHint(null);
      await refreshTurnstileWidgets();
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
          <div>
            <h2 className="text-sm font-semibold text-ink">
              {accountId ? t("cloudflare.reconnectTitle") : t("cloudflare.connectTitle")}
            </h2>
            <p className="mt-1 text-xs text-ink-muted">
              {accountId ? t("cloudflare.reconnectLead") : t("cloudflare.connectLead")}
            </p>
          </div>
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
              <p className="mt-1 text-xs text-ink-muted">{t("cloudflare.keyringHint")}</p>
            </div>
            <div className="flex flex-wrap gap-2">
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
            </div>
          </div>

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

          <section className="space-y-3 rounded-2xl border border-surface-3/80 bg-surface-1/60 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-ink">Turnstile secret</h2>
                <p className="mt-1 text-xs text-ink-muted">
                  Widget rilevati con il token di gestione. Per ruotare servono permessi Turnstile Sites Write o Account Settings Write.
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void refreshTurnstileWidgets()}
                className="rounded-lg border border-surface-3 px-3 py-1.5 text-sm text-ink hover:border-accent/40 disabled:opacity-50"
              >
                Aggiorna Turnstile
              </button>
            </div>
            <div className="overflow-hidden rounded-xl border border-surface-3/80">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-2/80 text-[11px] uppercase tracking-wide text-ink-muted">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Nome</th>
                    <th className="px-4 py-3 font-semibold">Domini</th>
                    <th className="px-4 py-3 font-mono text-[10px] font-semibold">Sitekey</th>
                    <th className="px-4 py-3 font-semibold">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-3/60 bg-surface-1/40">
                  {turnstileWidgets.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-5 text-center text-ink-muted">
                        Nessun widget Turnstile rilevato. Controlla i permessi del token o crea un widget in Cloudflare.
                      </td>
                    </tr>
                  ) : (
                    turnstileWidgets.map((widget) => (
                      <tr key={widget.sitekey} className="text-ink">
                        <td className="px-4 py-3">
                          <p className="font-medium">{widget.name}</p>
                          <p className="text-xs text-ink-muted">{widget.mode}</p>
                        </td>
                        <td className="max-w-[320px] px-4 py-3 text-xs text-ink-muted">
                          {widget.domains.length ? widget.domains.join(", ") : "-"}
                        </td>
                        <td className="max-w-[180px] truncate px-4 py-3 font-mono text-[11px] text-ink-muted">
                          {widget.sitekey}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            disabled={turnstileBusySitekey === widget.sitekey}
                            onClick={() => setTurnstileTarget(widget)}
                            className="rounded-lg border border-accent/50 px-2.5 py-1 text-xs font-medium text-accent hover:bg-accent/10 disabled:opacity-50"
                          >
                            {turnstileBusySitekey === widget.sitekey ? "Rotazione..." : "Ruota secret"}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

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

      {turnstileResult ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-amber-500/30 bg-surface-1 p-6 shadow-2xl">
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
