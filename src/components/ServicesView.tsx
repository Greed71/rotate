import { useTranslation } from "react-i18next";
import { useState } from "react";
import type { Integration } from "../types";

type Props = {
  integrations: Integration[];
  onGoExplore: () => void;
  onOpenIntegration: (integration: Integration) => void;
  onRemoveIntegration: (integration: Integration) => void | Promise<void>;
};

export function ServicesView({ integrations, onGoExplore, onOpenIntegration, onRemoveIntegration }: Props) {
  const { t, i18n } = useTranslation();
  const [pendingRemove, setPendingRemove] = useState<Integration | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  async function confirmRemove() {
    if (!pendingRemove) return;
    setRemoving(true);
    setRemoveError(null);
    try {
      await onRemoveIntegration(pendingRemove);
      setPendingRemove(null);
    } catch (e) {
      setRemoveError(e instanceof Error ? e.message : String(e));
    } finally {
      setRemoving(false);
    }
  }

  if (integrations.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-10 text-center">
        <p className="max-w-md text-sm text-ink-muted">{t("services.empty")}</p>
        <button
          type="button"
          onClick={onGoExplore}
          className="rounded-lg border border-surface-3 px-4 py-2 text-sm font-medium text-ink transition hover:border-accent/40 hover:text-accent"
        >
          {t("services.goExplore")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-auto px-10 py-10">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          {t("services.kicker")}
        </p>
        <h1 className="text-2xl font-semibold text-ink">{t("services.title")}</h1>
        <p className="text-sm text-ink-muted">{t("services.subtitle")}</p>
      </header>
      <div className="overflow-hidden rounded-2xl border border-surface-3/80">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-2/80 text-[11px] uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">{t("services.colService")}</th>
              <th className="px-4 py-3 font-semibold">{t("services.colLabel")}</th>
              <th className="px-4 py-3 font-semibold">{t("services.colAdded")}</th>
              <th className="px-4 py-3 text-right font-semibold">{t("services.colActions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-3/60 bg-surface-1/40">
            {integrations.map((row) => (
              <tr
                key={row.id}
                className="cursor-pointer text-ink transition hover:bg-surface-2/50"
                onClick={() => onOpenIntegration(row)}
              >
                <td className="px-4 py-3 font-medium">{t(`providers.${row.provider}.title`)}</td>
                <td className="px-4 py-3 text-ink-muted">{row.label}</td>
                <td className="px-4 py-3 text-ink-muted">
                  {new Date(row.createdAt).toLocaleString(i18n.language)}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPendingRemove(row);
                      setRemoveError(null);
                    }}
                    className="rounded-lg border border-rose-500/40 px-2.5 py-1 text-xs font-medium text-rose-200 hover:bg-rose-500/10"
                  >
                    {t("services.remove")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pendingRemove ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-2xl border border-rose-500/30 bg-surface-1 p-6 shadow-2xl">
            <h2 className="text-sm font-semibold text-rose-100">{t("services.removeTitle")}</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              {t("services.removeBody", {
                provider: t(`providers.${pendingRemove.provider}.title`),
                label: pendingRemove.label,
              })}
            </p>
            {removeError ? (
              <p className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-100">
                {removeError}
              </p>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={removing}
                onClick={() => setPendingRemove(null)}
                className="rounded-lg border border-surface-3 px-3 py-1.5 text-sm text-ink hover:border-accent/40 disabled:opacity-50"
              >
                {t("services.removeCancel")}
              </button>
              <button
                type="button"
                disabled={removing}
                onClick={() => void confirmRemove()}
                className="rounded-lg border border-rose-500/50 px-3 py-1.5 text-sm font-semibold text-rose-100 hover:bg-rose-500/10 disabled:opacity-50"
              >
                {removing ? t("services.removing") : t("services.removeConfirm")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
