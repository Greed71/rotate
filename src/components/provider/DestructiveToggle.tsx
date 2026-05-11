type Props = {
  checked: boolean;
  title: string;
  description: string;
  onChange: (checked: boolean) => void;
};

export function DestructiveToggle({ checked, title, description, onChange }: Props) {
  return (
    <label
      className={`flex min-h-[42px] items-center gap-3 rounded-lg border px-3 py-2 text-xs transition ${
        checked
          ? "border-rose-500/50 bg-rose-500/10 text-rose-100"
          : "border-surface-3 bg-surface-0/60 text-ink-muted hover:border-accent/40"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="sr-only"
      />
      <span className={`relative h-5 w-9 rounded-full transition ${checked ? "bg-rose-400" : "bg-surface-3"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${checked ? "left-4" : "left-0.5"}`} />
      </span>
      <span className="leading-tight">
        <span className="block font-semibold">{title}</span>
        <span className="block text-[11px] opacity-80">{description}</span>
      </span>
    </label>
  );
}
