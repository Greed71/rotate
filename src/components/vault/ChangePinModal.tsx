import { invoke } from "@tauri-apps/api/core";
import { useState } from "react";
import { VAULT_MIN_PIN_LENGTH } from "../../vaultConstants";

function errText(e: unknown): string {
  if (typeof e === "string") return e;
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return String(e);
}

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export function ChangePinModal({ open, onClose, onSuccess }: Props) {
  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPin.length < VAULT_MIN_PIN_LENGTH) {
      setError(`Nuovo PIN: almeno ${VAULT_MIN_PIN_LENGTH} caratteri.`);
      return;
    }
    if (newPin !== confirm) {
      setError("Le nuove password non coincidono.");
      return;
    }
    setBusy(true);
    try {
      await invoke("security_change_pin", { oldPin, newPin });
      onSuccess();
      onClose();
      setOldPin("");
      setNewPin("");
      setConfirm("");
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-md rounded-2xl border border-surface-3 bg-surface-1 p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-ink">Cambia PIN</h2>
        {error ? (
          <p className="mt-2 text-sm text-rose-200">{error}</p>
        ) : null}
        <form className="mt-4 space-y-3" onSubmit={(e) => void handleSubmit(e)}>
          <input
            type="password"
            value={oldPin}
            onChange={(e) => setOldPin(e.target.value)}
            placeholder="PIN attuale"
            className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 text-sm text-ink"
          />
          <input
            type="password"
            value={newPin}
            onChange={(e) => setNewPin(e.target.value)}
            placeholder={`Nuovo PIN (${VAULT_MIN_PIN_LENGTH}+)`}
            className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 text-sm text-ink"
          />
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Ripeti nuovo PIN"
            className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 text-sm text-ink"
          />
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-surface-3 px-3 py-1.5 text-sm text-ink-muted"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-surface-0 disabled:opacity-50"
            >
              Salva
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
