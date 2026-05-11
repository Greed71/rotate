import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { SecurityStatusDto } from "../types";
import { VAULT_MIN_PIN_LENGTH } from "../vaultConstants";
import { errText } from "./provider/errors";

const MIN_MINUTES = 1;
const MAX_MINUTES = 480;

type Props = {
  sessionTtlSeconds: number;
  onVaultUpdated: (s: SecurityStatusDto) => void;
};

export function SettingsView({ sessionTtlSeconds, onVaultUpdated }: Props) {
  const { t } = useTranslation();
  const [minutes, setMinutes] = useState(() =>
    Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, Math.round(sessionTtlSeconds / 60))),
  );
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [passwordNotice, setPasswordNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    setMinutes(Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, Math.round(sessionTtlSeconds / 60))));
  }, [sessionTtlSeconds]);

  async function save() {
    const m = Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, Math.round(minutes)));
    setSaving(true);
    setNotice(null);
    try {
      const s = await invoke<SecurityStatusDto>("security_set_session_ttl", { ttlSeconds: m * 60 });
      onVaultUpdated(s);
      setNotice({ kind: "ok", text: t("settings.saved") });
    } catch (e) {
      setNotice({ kind: "err", text: errText(e) });
    } finally {
      setSaving(false);
    }
  }

  function passwordLooksStrong(value: string) {
    const classes = [
      /[a-z]/.test(value),
      /[A-Z]/.test(value),
      /\d/.test(value),
      /[^A-Za-z0-9]/.test(value),
    ].filter(Boolean).length;
    return value.length >= 16 || (value.length >= VAULT_MIN_PIN_LENGTH && classes >= 3);
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordNotice(null);
    if (!currentPassword) {
      setPasswordNotice({ kind: "err", text: t("settings.passwordCurrentRequired") });
      return;
    }
    if (newPassword.length < VAULT_MIN_PIN_LENGTH || !passwordLooksStrong(newPassword)) {
      setPasswordNotice({ kind: "err", text: t("settings.passwordWeak", { min: VAULT_MIN_PIN_LENGTH }) });
      return;
    }
    if (newPassword !== repeatPassword) {
      setPasswordNotice({ kind: "err", text: t("settings.passwordMismatch") });
      return;
    }
    if (currentPassword === newPassword) {
      setPasswordNotice({ kind: "err", text: t("settings.passwordSame") });
      return;
    }
    setChangingPassword(true);
    try {
      await invoke("security_change_pin", { oldPin: currentPassword, newPin: newPassword });
      const s = await invoke<SecurityStatusDto>("security_status");
      onVaultUpdated(s);
      setCurrentPassword("");
      setNewPassword("");
      setRepeatPassword("");
      setPasswordNotice({ kind: "ok", text: t("settings.passwordChanged") });
    } catch (e) {
      setPasswordNotice({ kind: "err", text: errText(e) });
    } finally {
      setChangingPassword(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-8 overflow-auto px-10 py-10">
      <header className="max-w-3xl space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">{t("settings.kicker")}</p>
        <h1 className="text-3xl font-semibold tracking-tight text-ink">{t("settings.title")}</h1>
        <p className="text-sm leading-relaxed text-ink-muted">{t("settings.subtitle")}</p>
      </header>

      <section className="max-w-xl space-y-4 rounded-xl border border-surface-3/80 bg-surface-1/50 p-6">
        <div>
          <h2 className="text-sm font-semibold text-ink">{t("settings.sessionSection")}</h2>
          <p className="mt-1 text-xs text-ink-muted">{t("settings.sessionLead")}</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-ink-muted">{t("settings.sessionMinutesLabel")}</span>
            <input
              type="number"
              min={MIN_MINUTES}
              max={MAX_MINUTES}
              value={minutes}
              onChange={(ev) => setMinutes(Number(ev.target.value))}
              className="w-28 rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 text-sm text-ink outline-none ring-accent/0 transition-shadow focus:ring-2 focus:ring-accent/40"
            />
          </label>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-surface-0 hover:opacity-90 disabled:opacity-50"
          >
            {saving ? t("settings.saving") : t("settings.save")}
          </button>
        </div>
        <p className="text-xs text-ink-muted">{t("settings.sessionHint")}</p>
        {notice ? (
          <p className={`text-sm ${notice.kind === "ok" ? "text-emerald-300" : "text-rose-300"}`}>
            {notice.text}
          </p>
        ) : null}
      </section>

      <section className="max-w-xl space-y-4 rounded-xl border border-surface-3/80 bg-surface-1/50 p-6">
        <div>
          <h2 className="text-sm font-semibold text-ink">{t("settings.passwordSection")}</h2>
          <p className="mt-1 text-xs text-ink-muted">{t("settings.passwordLead")}</p>
        </div>
        <form className="space-y-3" onSubmit={(e) => void changePassword(e)}>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-ink-muted">{t("settings.currentPassword")}</span>
            <input
              type="password"
              value={currentPassword}
              onChange={(ev) => setCurrentPassword(ev.target.value)}
              autoComplete="current-password"
              className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 text-sm text-ink outline-none ring-accent/0 transition-shadow focus:ring-2 focus:ring-accent/40"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-ink-muted">{t("settings.newPassword")}</span>
            <input
              type="password"
              value={newPassword}
              onChange={(ev) => setNewPassword(ev.target.value)}
              autoComplete="new-password"
              className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 text-sm text-ink outline-none ring-accent/0 transition-shadow focus:ring-2 focus:ring-accent/40"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-ink-muted">{t("settings.repeatPassword")}</span>
            <input
              type="password"
              value={repeatPassword}
              onChange={(ev) => setRepeatPassword(ev.target.value)}
              autoComplete="new-password"
              className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 text-sm text-ink outline-none ring-accent/0 transition-shadow focus:ring-2 focus:ring-accent/40"
            />
          </label>
          <p className="text-xs text-ink-muted">{t("settings.passwordHint", { min: VAULT_MIN_PIN_LENGTH })}</p>
          <button
            type="submit"
            disabled={changingPassword}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-surface-0 hover:opacity-90 disabled:opacity-50"
          >
            {changingPassword ? t("settings.passwordSaving") : t("settings.passwordSave")}
          </button>
        </form>
        {passwordNotice ? (
          <p className={`text-sm ${passwordNotice.kind === "ok" ? "text-emerald-300" : "text-rose-300"}`}>
            {passwordNotice.text}
          </p>
        ) : null}
      </section>
    </div>
  );
}
