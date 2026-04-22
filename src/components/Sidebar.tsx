import type { NavId } from "../types";

const items: { id: NavId; label: string; description: string }[] = [
  { id: "home", label: "Home", description: "Panoramica" },
  { id: "explore", label: "Esplora", description: "Aggiungi servizi" },
  { id: "services", label: "I miei servizi", description: "Collegati" },
];

type Props = {
  active: NavId;
  onNavigate: (id: NavId) => void;
  serviceCount: number;
  backendHint: string;
  vaultUnlocked: boolean;
  sessionMinutesRemaining: number | null;
  onLockVault: () => void;
  onOpenChangePin: () => void;
};

export function Sidebar({
  active,
  onNavigate,
  serviceCount,
  backendHint,
  vaultUnlocked,
  sessionMinutesRemaining,
  onLockVault,
  onOpenChangePin,
}: Props) {
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-surface-3/80 bg-surface-1">
      <div className="border-b border-surface-3/80 px-5 py-6">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-muted text-lg font-semibold text-accent">
            R
          </span>
          <div>
            <p className="text-sm font-semibold tracking-tight text-ink">Rotate</p>
            <p className="text-xs text-ink-muted">Chiavi in un solo posto</p>
          </div>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {items.map((item) => {
          const isActive = active === item.id;
          const badge =
            item.id === "services" && serviceCount > 0 ? serviceCount : null;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`group flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                isActive
                  ? "bg-surface-2 text-ink shadow-sm ring-1 ring-accent/25"
                  : "text-ink-muted hover:bg-surface-2/60 hover:text-ink"
              }`}
            >
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent opacity-0 transition-opacity group-hover:opacity-60" />
              <span className="flex flex-1 flex-col gap-0.5">
                <span className="flex items-center gap-2 text-sm font-medium">
                  {item.label}
                  {badge !== null ? (
                    <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
                      {badge}
                    </span>
                  ) : null}
                </span>
                <span className="text-xs text-ink-muted">{item.description}</span>
              </span>
            </button>
          );
        })}
      </nav>
      {vaultUnlocked ? (
        <div className="border-t border-surface-3/80 px-3 py-2">
          <div className="flex items-center justify-between gap-2 rounded-lg bg-surface-0/80 px-2 py-1.5">
            <span className="text-[10px] text-ink-muted">
              Sessione
              {sessionMinutesRemaining != null ? (
                <span className="ml-1 font-mono text-accent">~{sessionMinutesRemaining}m</span>
              ) : null}
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={onOpenChangePin}
                className="rounded px-1.5 py-0.5 text-[10px] text-ink-muted hover:text-accent"
              >
                PIN
              </button>
              <button
                type="button"
                onClick={onLockVault}
                className="rounded bg-surface-3/80 px-2 py-0.5 text-[10px] font-medium text-ink hover:bg-rose-500/20 hover:text-rose-200"
              >
                Blocca
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <div className="border-t border-surface-3/80 px-4 py-3 text-[11px] leading-relaxed text-ink-muted">
        <p className="mb-2 rounded-md bg-surface-0/80 px-2 py-1.5 font-mono text-[10px] text-accent/90">
          {backendHint}
        </p>
        <p>
          Vault: hash PIN in DB locale, sessione in memoria. Token provider nel portachiavi OS. CSP
          restrittiva in produzione.
        </p>
      </div>
    </aside>
  );
}
