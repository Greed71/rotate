import type { ReactNode } from "react";

type Props = {
  providerLabel: string;
  title: string;
  description: ReactNode;
  backLabel: string;
  onBack: () => void;
};

export function ProviderHeader({ providerLabel, title, description, backLabel, onBack }: Props) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <button
          type="button"
          onClick={onBack}
          className="mb-2 text-xs font-medium text-accent hover:underline"
        >
          {backLabel}
        </button>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          {providerLabel}
        </p>
        <h1 className="text-2xl font-semibold text-ink">{title}</h1>
        <p className="mt-1 text-sm text-ink-muted">{description}</p>
      </div>
    </header>
  );
}
