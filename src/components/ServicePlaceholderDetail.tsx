import { useTranslation } from "react-i18next";
import type { Integration } from "../types";

type Props = {
  integration: Integration;
  onBack: () => void;
};

export function ServicePlaceholderDetail({ integration, onBack }: Props) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-auto px-10 py-10">
      <header>
        <button
          type="button"
          onClick={onBack}
          className="mb-2 text-xs font-medium text-accent hover:underline"
        >
          {t("placeholder.back")}
        </button>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          {t(`providers.${integration.provider}.title`)}
        </p>
        <h1 className="text-2xl font-semibold text-ink">{integration.label}</h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-muted">{t("placeholder.body")}</p>
      </header>
    </div>
  );
}
