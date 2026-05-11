import { invoke } from "@tauri-apps/api/core";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { VAULT_MIN_PIN_LENGTH } from "../../vaultConstants";
import { errText } from "../provider/errors";

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export function ChangePinModal({ open, onClose, onSuccess }: Props) {
  const { t } = useTranslation();
  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  function passwordLooksStrong(value: string) {
    const classes = [
      /[a-z]/.test(value),
      /[A-Z]/.test(value),
      /\d/.test(value),
      /[^A-Za-z0-9]/.test(value),
    ].filter(Boolean).length;
    return value.length >= 16 || (value.length >= VAULT_MIN_PIN_LENGTH && classes >= 3);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPin.length < VAULT_MIN_PIN_LENGTH || !passwordLooksStrong(newPin)) {
      setError(t("changePin.newMin", { min: VAULT_MIN_PIN_LENGTH }));
      return;
    }
    if (newPin !== confirm) {
      setError(t("changePin.mismatch"));
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
        <h2 className="text-lg font-semibold text-ink">{t("changePin.title")}</h2>
        {error ? <p className="mt-2 text-sm text-rose-200">{error}</p> : null}
        <form className="mt-4 space-y-3" onSubmit={(e) => void handleSubmit(e)}>
          <input
            type="password"
            value={oldPin}
            onChange={(e) => setOldPin(e.target.value)}
            placeholder={t("changePin.currentPh")}
            className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 text-sm text-ink"
          />
          <input
            type="password"
            value={newPin}
            onChange={(e) => setNewPin(e.target.value)}
            placeholder={t("changePin.newPh", { min: VAULT_MIN_PIN_LENGTH })}
            className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 text-sm text-ink"
          />
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={t("changePin.repeatPh")}
            className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 text-sm text-ink"
          />
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-surface-3 px-3 py-1.5 text-sm text-ink-muted"
            >
              {t("changePin.cancel")}
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-surface-0 disabled:opacity-50"
            >
              {t("changePin.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
