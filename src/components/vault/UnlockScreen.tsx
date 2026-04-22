import { invoke } from "@tauri-apps/api/core";
import { useRef, useState } from "react";
import type { SecurityStatusDto } from "../../types";

function errText(e: unknown): string {
  if (typeof e === "string") return e;
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return String(e);
}

type Props = {
  onUnlocked: (status: SecurityStatusDto) => void;
};

export function UnlockScreen({ onUnlocked }: Props) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitInFlight = useRef(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!pin || submitInFlight.current) return;
    submitInFlight.current = true;
    setBusy(true);
    try {
      const status = await invoke<SecurityStatusDto>("security_unlock", { pin });
      onUnlocked(status);
      setPin("");
    } catch (err) {
      setError(errText(err));
    } finally {
      submitInFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-surface-0 px-6 py-16">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-surface-3/80 bg-surface-1/90 p-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Vault bloccato</p>
          <h1 className="mt-2 text-xl font-semibold text-ink">Inserisci il PIN</h1>
        </div>
        {error ? (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {error}
          </div>
        ) : null}
        <form className="space-y-4" onSubmit={(e) => void handleSubmit(e)}>
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 text-sm text-ink outline-none ring-accent/40 focus:ring-2"
            placeholder="PIN"
            autoComplete="current-password"
            autoFocus
          />
          <button
            type="submit"
            disabled={busy || !pin}
            className="w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-surface-0 hover:brightness-110 disabled:opacity-50"
          >
            {busy ? "…" : "Sblocca"}
          </button>
        </form>
      </div>
    </div>
  );
}
