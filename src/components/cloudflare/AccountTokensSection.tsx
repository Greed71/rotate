import { useTranslation } from "react-i18next";
import type { CfTokenRow } from "../../types";

type Props = {
  tokens: CfTokenRow[];
  managedExternalIds: Set<string>;
  manualTokenId: string;
  busy: boolean;
  rotateBusy: boolean;
  onManualTokenIdChange: (value: string) => void;
  onManualRotate: () => void;
  onTrackToken: (token: CfTokenRow) => void;
  onRotateToken: (token: CfTokenRow) => void;
};

export function AccountTokensSection({
  tokens,
  managedExternalIds,
  manualTokenId,
  busy,
  rotateBusy,
  onManualTokenIdChange,
  onManualRotate,
  onTrackToken,
  onRotateToken,
}: Props) {
  const { t } = useTranslation();

  return (
    <>
      <section className="space-y-3 rounded-2xl border border-surface-3/80 bg-surface-1/60 p-5">
        <div>
          <h2 className="text-sm font-semibold text-ink">{t("cloudflare.rotateByIdTitle")}</h2>
          <p className="mt-1 text-xs text-ink-muted">{t("cloudflare.rotateByIdLead")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            value={manualTokenId}
            onChange={(event) => onManualTokenIdChange(event.target.value)}
            className="min-w-[260px] flex-1 rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 font-mono text-sm text-ink outline-none ring-accent/40 focus:ring-2"
            placeholder={t("cloudflare.tokenIdPh")}
            autoComplete="off"
          />
          <button
            type="button"
            disabled={!manualTokenId.trim() || busy || rotateBusy}
            onClick={onManualRotate}
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
              <th className="px-4 py-3 font-mono text-[10px] font-semibold">
                {t("cloudflare.colId")}
              </th>
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
              tokens.map((token) => {
                const isManaged = managedExternalIds.has(token.id);
                return (
                  <tr key={token.id} className="text-ink">
                    <td className="px-4 py-3 font-medium">{token.name}</td>
                    <td className="px-4 py-3 text-ink-muted">{token.status}</td>
                    <td className="px-4 py-3 text-ink-muted">{token.expiresOn ?? "\u2014"}</td>
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
                      {token.id}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busy || rotateBusy || isManaged}
                          onClick={() => onTrackToken(token)}
                          className="rounded-lg border border-surface-3 px-2.5 py-1 text-xs font-medium text-ink-muted hover:border-accent/40 disabled:opacity-50"
                        >
                          {isManaged ? t("cloudflare.tracked") : t("cloudflare.track")}
                        </button>
                        <button
                          type="button"
                          disabled={busy || rotateBusy}
                          onClick={() => onRotateToken(token)}
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
    </>
  );
}
