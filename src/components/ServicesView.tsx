import { useTranslation } from "react-i18next";
import type { Integration } from "../types";

type Props = {
  integrations: Integration[];
  onGoExplore: () => void;
  onOpenIntegration: (integration: Integration) => void;
};

export function ServicesView({ integrations, onGoExplore, onOpenIntegration }: Props) {
  const { t, i18n } = useTranslation();

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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
