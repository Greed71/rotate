import { invoke } from "@tauri-apps/api/core";
import { useRef, useState } from "react";
import type { SecurityStatusDto } from "../../types";
import { VAULT_MIN_PIN_LENGTH } from "../../vaultConstants";

function errText(e: unknown): string {
  if (typeof e === "string") return e;
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return String(e);
}

type Props = {
  onConfigured: (status: SecurityStatusDto) => void;
};

export function PinSetupScreen({ onConfigured }: Props) {
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Evita doppio invio (Enter doppio / doppio click) mentre l’IPC è in volo. */
  const submitInFlight = useRef(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (pin.length < VAULT_MIN_PIN_LENGTH || confirm.length < VAULT_MIN_PIN_LENGTH) {
      setError(`Usa almeno ${VAULT_MIN_PIN_LENGTH} caratteri.`);
      return;
    }
    if (pin !== confirm) {
      setError("I PIN non coincidono.");
      return;
    }
    if (submitInFlight.current) return;
    submitInFlight.current = true;
    setBusy(true);
    try {
      const status = await invoke<SecurityStatusDto>("security_set_pin", { pin });
      onConfigured(status);
    } catch (err) {
      setError(errText(err));
    } finally {
      submitInFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-surface-0 px-6 py-16">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-surface-3/80 bg-surface-1/90 p-8 shadow-2xl">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Vault</p>
          <h1 className="mt-2 text-2xl font-semibold text-ink">Crea il PIN del bunker</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            Il PIN non viene salvato in chiaro: solo un hash Argon2 nel database locale dell&apos;app
            (<span className="font-mono text-xs">rotate.db</span>). Senza PIN non si accede a
            integrazioni né segreti.
          </p>
        </div>
        {error ? (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {error}
          </div>
        ) : null}
        <form className="space-y-4" onSubmit={(e) => void handleSubmit(e)}>
          <div className="space-y-1.5">
            <label htmlFor="pin" className="text-xs font-semibold text-ink-muted">
              PIN ({VAULT_MIN_PIN_LENGTH}+ caratteri)
            </label>
            <input
              id="pin"
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 text-sm text-ink outline-none ring-accent/40 focus:ring-2"
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="pin2" className="text-xs font-semibold text-ink-muted">
              Ripeti PIN
            </label>
            <input
              id="pin2"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 text-sm text-ink outline-none ring-accent/40 focus:ring-2"
              autoComplete="new-password"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-surface-0 hover:brightness-110 disabled:opacity-50"
          >
            {busy ? "Salvataggio…" : "Attiva vault"}
          </button>
        </form>
      </div>
    </div>
  );
}
