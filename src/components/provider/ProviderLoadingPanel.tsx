type Props = {
  title: string;
  description: string;
};

export function ProviderLoadingPanel({ title, description }: Props) {
  return (
    <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-surface-3/80 bg-surface-1/60 p-8">
      <div className="space-y-3 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
        <div>
          <p className="text-sm font-semibold text-ink">{title}</p>
          <p className="mt-1 text-xs text-ink-muted">{description}</p>
        </div>
      </div>
    </div>
  );
}
