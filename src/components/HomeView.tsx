import { useTranslation } from "react-i18next";
import type { Integration } from "../types";

type Props = {
  integrations: Integration[];
  onGoExplore: () => void;
  onOpenIntegration: (integration: Integration) => void;
};

export function HomeView({ integrations, onGoExplore, onOpenIntegration }: Props) {
  const { t } = useTranslation();
  const isEmpty = integrations.length === 0;

  if (isEmpty) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-10 py-16 text-center">
        <div className="max-w-md space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            {t("home.welcomeKicker")}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-ink">{t("home.emptyTitle")}</h1>
          <p className="text-sm leading-relaxed text-ink-muted">{t("home.emptyDescription")}</p>
        </div>
        <button
          type="button"
          onClick={onGoExplore}
          className="rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-surface-0 shadow-lg shadow-accent/10 transition hover:brightness-110"
        >
          {t("home.openExplore")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-8 overflow-auto px-10 py-10">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">{t("home.kicker")}</p>
        <h1 className="text-3xl font-semibold tracking-tight text-ink">{t("home.withServicesTitle")}</h1>
        <p className="text-sm text-ink-muted">{t("home.withServicesSubtitle")}</p>
      </header>
      <ul className="grid gap-3 md:grid-cols-2">
        {integrations.map((item) => (
          <li
            key={item.id}
            className="cursor-pointer rounded-2xl border border-surface-3/80 bg-surface-1/80 px-5 py-4 transition hover:border-accent/40 hover:bg-surface-2/50"
            onClick={() => onOpenIntegration(item)}
          >
            <p className="text-sm font-semibold text-ink">{item.label}</p>
            <p className="text-xs uppercase tracking-wide text-ink-muted">
              {t(`providers.${item.provider}.title`)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
