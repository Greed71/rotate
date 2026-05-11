import { Trans, useTranslation } from "react-i18next";
import type {
  AccessServiceTokenRotateResult,
  AccessServiceTokenRow,
  CfTokenRow,
  CloudflareRotateResultDto,
  TurnstileWidgetRow,
} from "../../types";

type ConfirmModalProps = {
  tone: "warning" | "danger";
  title: string;
  body: string;
  busy: boolean;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
};

function ConfirmModal({
  tone,
  title,
  body,
  busy,
  confirmLabel,
  onCancel,
  onConfirm,
}: ConfirmModalProps) {
  const toneClasses =
    tone === "danger"
      ? {
          panelBorder: "border-rose-500/30",
          titleColor: "text-rose-100",
          buttonBorder: "border-rose-500/50",
          buttonHover: "hover:bg-rose-500/10",
        }
      : {
          panelBorder: "border-amber-500/30",
          titleColor: "text-amber-100",
          buttonBorder: "border-amber-500/40",
          buttonHover: "hover:bg-amber-500/10",
        };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className={`w-full max-w-md rounded-2xl border ${toneClasses.panelBorder} bg-surface-1 p-6 shadow-2xl`}>
        <h3 className={`text-sm font-semibold ${toneClasses.titleColor}`}>{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">{body}</p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded-lg border border-surface-3 px-3 py-1.5 text-sm text-ink hover:border-accent/40 disabled:opacity-50"
          >
            Annulla
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={`rounded-lg border ${toneClasses.buttonBorder} px-3 py-1.5 text-sm font-medium ${toneClasses.titleColor} ${toneClasses.buttonHover} disabled:opacity-50`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ConfirmRevealTokenModal({
  busy,
  onCancel,
  onConfirm,
}: {
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <ConfirmModal
      tone="warning"
      title="Mostra token di gestione"
      body="Chiunque possa vedere lo schermo potra leggere il token Cloudflare. Aprilo solo in un ambiente privato e chiudi la finestra appena hai finito."
      busy={busy}
      confirmLabel="Mostra token"
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}

export function ConfirmUnlinkModal({
  busy,
  onCancel,
  onConfirm,
}: {
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <ConfirmModal
      tone="danger"
      title="Rimuovi collegamento Cloudflare"
      body="Verranno rimossi da questo dispositivo Account ID, token di gestione e stato locale del collegamento. I token su Cloudflare non vengono eliminati."
      busy={busy}
      confirmLabel="Rimuovi collegamento"
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}

export function AccountTokenRotateModal({
  target,
  revokeOld,
  busy,
  onRevokeOldChange,
  onCancel,
  onConfirm,
}: {
  target: CfTokenRow;
  revokeOld: boolean;
  busy: boolean;
  onRevokeOldChange: (value: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-surface-3 bg-surface-1 p-6 shadow-2xl">
        <h3 className="text-sm font-semibold text-ink">{t("cloudflare.rotateTitle")}</h3>
        <p className="mt-1 text-xs text-ink-muted">
          <Trans
            i18nKey="cloudflare.rotateLead"
            values={{ name: target.name }}
            components={[<span className="font-medium text-ink" key="0" />]}
          />
        </p>
        <label className="mt-4 flex cursor-pointer items-start gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={revokeOld}
            onChange={(event) => onRevokeOldChange(event.target.checked)}
            className="mt-1 rounded border-surface-3"
          />
          <span>{t("cloudflare.rotateRevoke")}</span>
        </label>
        <p className="mt-3 text-xs text-amber-100/90">{t("cloudflare.rotateWarn")}</p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded-lg border border-surface-3 px-3 py-1.5 text-sm text-ink hover:border-accent/40 disabled:opacity-50"
          >
            {t("cloudflare.cancel")}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-surface-0 disabled:opacity-50"
          >
            {busy ? t("cloudflare.rotating") : t("cloudflare.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AccountTokenRotateResultModal({
  result,
  copyHint,
  onCopy,
  onClose,
}: {
  result: CloudflareRotateResultDto;
  copyHint: string | null;
  onCopy: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-amber-500/30 bg-surface-1 p-6 shadow-2xl">
        <h3 className="text-sm font-semibold text-amber-100">{t("cloudflare.resultTitle")}</h3>
        <p className="mt-1 text-xs text-ink-muted">{t("cloudflare.resultLead")}</p>
        <p className="mt-2 font-mono text-[11px] text-ink-muted">ID: {result.newTokenId}</p>
        <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-surface-0 p-3 font-mono text-xs text-ink">
          {result.newTokenSecret}
        </pre>
        <ul className="mt-3 space-y-1 text-xs text-ink-muted">
          <li>
            {t("cloudflare.resultTracked")}{" "}
            {result.trackedSecretUpdated ? (
              <span className="text-accent">{t("cloudflare.yes")}</span>
            ) : (
              <span>{t("cloudflare.no")}</span>
            )}
          </li>
          <li>
            {t("cloudflare.resultRevoked")}{" "}
            {result.revokedOld ? (
              <span className="text-accent">{t("cloudflare.yes")}</span>
            ) : (
              <span>{t("cloudflare.no")}</span>
            )}
          </li>
        </ul>
        {copyHint ? <p className="mt-2 text-xs text-accent">{copyHint}</p> : null}
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onCopy}
            className="rounded-lg border border-surface-3 px-3 py-1.5 text-sm text-ink hover:border-accent/40"
          >
            {t("cloudflare.copySecretAuto")}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-surface-0"
          >
            {t("cloudflare.close")}
          </button>
        </div>
      </div>
    </div>
  );
}

export function TurnstileRotateModal({
  target,
  busySitekey,
  onCancel,
  onRotate,
}: {
  target: TurnstileWidgetRow;
  busySitekey: string | null;
  onCancel: () => void;
  onRotate: (immediate: boolean) => void;
}) {
  const busy = busySitekey === target.sitekey;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-surface-3 bg-surface-1 p-6 shadow-2xl">
        <h3 className="text-sm font-semibold text-ink">Ruota secret Turnstile</h3>
        <p className="mt-1 text-xs text-ink-muted">
          Verra creato un nuovo secret per {target.name}. Il vecchio secret puo restare valido per
          2 ore, oppure essere invalidato subito.
        </p>
        <p className="mt-3 font-mono text-[11px] text-ink-muted">Sitekey: {target.sitekey}</p>
        <p className="mt-3 text-xs text-amber-100/90">
          Se Cloudflare restituisce errore di autenticazione, ricollega il token manager con
          permessi Turnstile Sites Write oppure Account Settings Write.
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded-lg border border-surface-3 px-3 py-1.5 text-sm text-ink hover:border-accent/40 disabled:opacity-50"
          >
            Annulla
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onRotate(false)}
            className="rounded-lg border border-accent/50 px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent/10 disabled:opacity-50"
          >
            Ruota con 2 ore di grace
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onRotate(true)}
            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-surface-0 disabled:opacity-50"
          >
            Invalida subito
          </button>
        </div>
      </div>
    </div>
  );
}

export function AccessRotateModal({
  target,
  busyId,
  onCancel,
  onRotate,
}: {
  target: AccessServiceTokenRow;
  busyId: string | null;
  onCancel: () => void;
  onRotate: (grace: boolean) => void;
}) {
  const busy = busyId === target.id;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-surface-3 bg-surface-1 p-6 shadow-2xl">
        <h3 className="text-sm font-semibold text-ink">Ruota Access Service Token</h3>
        <p className="mt-1 text-xs text-ink-muted">
          Verra creato un nuovo Client Secret per {target.name}. Il vecchio secret puo essere
          invalidato subito oppure restare valido per 2 ore.
        </p>
        <p className="mt-3 font-mono text-[11px] text-ink-muted">
          Client ID: {target.clientId || "-"}
        </p>
        <p className="mt-3 text-xs text-amber-100/90">
          Se questo token e usato da automazioni o backend, usa la grace window e aggiorna le
          destinazioni prima che scada il vecchio secret.
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded-lg border border-surface-3 px-3 py-1.5 text-sm text-ink hover:border-accent/40 disabled:opacity-50"
          >
            Annulla
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onRotate(true)}
            className="rounded-lg border border-accent/50 px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent/10 disabled:opacity-50"
          >
            Ruota con 2 ore di grace
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onRotate(false)}
            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-surface-0 disabled:opacity-50"
          >
            Invalida subito
          </button>
        </div>
      </div>
    </div>
  );
}

export function AccessRotateResultModal({
  result,
  copyHint,
  onCopy,
  onClose,
}: {
  result: AccessServiceTokenRotateResult;
  copyHint: string | null;
  onCopy: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-amber-500/30 bg-surface-1 p-6 shadow-2xl">
        <h3 className="text-sm font-semibold text-amber-100">Nuovo secret Access</h3>
        <p className="mt-1 text-xs text-ink-muted">
          Aggiorna subito i servizi che inviano gli header CF-Access-Client-ID e
          CF-Access-Client-Secret. Cloudflare mostra questo secret solo ora.
        </p>
        <p className="mt-2 text-sm text-ink">{result.name}</p>
        <p className="font-mono text-[11px] text-ink-muted">Client ID: {result.clientId}</p>
        <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-surface-0 p-3 font-mono text-xs text-ink">
          {result.clientSecret}
        </pre>
        {copyHint ? <p className="mt-2 text-xs text-accent">{copyHint}</p> : null}
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onCopy}
            className="rounded-lg border border-surface-3 px-3 py-1.5 text-sm text-ink hover:border-accent/40"
          >
            Copia secret
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-surface-0"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}

export function RevealManagedTokenModal({
  token,
  copyHint,
  onCopy,
  onClose,
}: {
  token: string;
  copyHint: string | null;
  onCopy: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-amber-500/30 bg-surface-1 p-6 shadow-2xl">
        <h3 className="text-sm font-semibold text-amber-100">{t("cloudflare.revealTitle")}</h3>
        <p className="mt-1 text-xs text-ink-muted">{t("cloudflare.revealLead")}</p>
        <pre className="mt-4 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-surface-0 p-3 font-mono text-xs text-ink">
          {token}
        </pre>
        {copyHint ? <p className="mt-2 text-xs text-accent">{copyHint}</p> : null}
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onCopy}
            className="rounded-lg border border-surface-3 px-3 py-1.5 text-sm text-ink hover:border-accent/40"
          >
            {t("cloudflare.copyAuto")}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-surface-0"
          >
            {t("cloudflare.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
