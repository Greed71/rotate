import { useTranslation } from "react-i18next";

export type LanguageSwitcherProps = {
  /** Mostra l’etichetta «Lingua» / «Language» (default: sì). */
  showLabel?: boolean;
  className?: string;
};

export function LanguageSwitcher({ showLabel = true, className }: LanguageSwitcherProps = {}) {
  const { i18n, t } = useTranslation();

  return (
    <div
      className={`flex items-center gap-2 text-[10px] text-ink-muted ${className ?? ""}`.trim()}
    >
      {showLabel ? (
        <span className="shrink-0 font-medium uppercase tracking-wide">{t("sidebar.language")}</span>
      ) : null}
      <div className="flex rounded-md border border-surface-3/80 bg-surface-0/80 p-0.5">
        {(["it", "en"] as const).map((lng) => {
          const resolved = i18n.resolvedLanguage ?? i18n.language;
          const isActive =
            lng === "it" ? resolved.startsWith("it") : resolved.startsWith("en");
          return (
          <button
            key={lng}
            type="button"
            onClick={() => void i18n.changeLanguage(lng)}
            className={`rounded px-2 py-0.5 font-medium transition ${
              isActive
                ? "bg-accent/20 text-accent"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            {t(`lang.${lng}`)}
          </button>
          );
        })}
      </div>
    </div>
  );
}
