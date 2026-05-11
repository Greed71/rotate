import { invoke } from "@tauri-apps/api/core";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "../LanguageSwitcher";
import type { SecurityStatusDto } from "../../types";
import { errText } from "../provider/errors";

type Props = {
  onUnlocked: (status: SecurityStatusDto) => void;
};

export function UnlockScreen({ onUnlocked }: Props) {
  const { t } = useTranslation();
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
    <div className="relative flex min-h-full flex-col items-center justify-center bg-surface-0 px-6 py-16">
      <div className="absolute right-4 top-4 z-10 sm:right-6 sm:top-6">
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-surface-3/80 bg-surface-1/90 p-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            {t("vault.lockedKicker")}
          </p>
          <h1 className="mt-2 text-xl font-semibold text-ink">{t("vault.unlockTitle")}</h1>
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
            placeholder={t("vault.unlockPlaceholder")}
            autoComplete="current-password"
            autoFocus
          />
          <button
            type="submit"
            disabled={busy || !pin}
            className="w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-surface-0 hover:brightness-110 disabled:opacity-50"
          >
            {busy ? t("vault.unlockBusy") : t("vault.unlock")}
          </button>
        </form>
      </div>
    </div>
  );
}
