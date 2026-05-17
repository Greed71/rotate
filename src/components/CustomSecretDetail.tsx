import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { copySensitiveWithAutoClear } from "../clipboardSecure";
import type {
  CustomSecretFormat,
  CustomSecretProfile,
  CustomSecretRotateResult,
  CustomSecretRow,
  Integration,
} from "../types";
import { AlertMessage } from "./provider/AlertMessage";
import { LinkedAccountBar } from "./provider/LinkedAccountBar";
import { ProviderHeader } from "./provider/ProviderHeader";
import { ProviderLoadingPanel } from "./provider/ProviderLoadingPanel";
import { SecretPropagationModal } from "./provider/SecretPropagationModal";
import { errText } from "./provider/errors";
import { useSecretPropagation } from "./provider/useSecretPropagation";

const PROFILES: CustomSecretProfile[] = [
  "random_secret",
  "hmac_sha256",
  "aes_256_gcm",
  "xchacha20_poly1305",
  "jwt_hs256",
  "jwt_hs512",
];

const FORMATS: CustomSecretFormat[] = ["base64url", "base64", "hex"];

type Props = {
  integration: Integration;
  integrations?: Integration[];
  onBack: () => void;
};

function formatDate(value: number | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

export function CustomSecretDetail({ integration, integrations = [], onBack }: Props) {
  const { t } = useTranslation();
  const [items, setItems] = useState<CustomSecretRow[]>([]);
  const [name, setName] = useState("");
  const [envKey, setEnvKey] = useState("");
  const [profile, setProfile] = useState<CustomSecretProfile>("random_secret");
  const [format, setFormat] = useState<CustomSecretFormat>("base64url");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CustomSecretRotateResult | null>(null);
  const [copyHint, setCopyHint] = useState<string | null>(null);
  const [propagationOpen, setPropagationOpen] = useState(false);

  const integrationId = integration.id;
  const handlePropagationError = useCallback((message: string) => setError(message), []);
  const propagation = useSecretPropagation({
    integrations,
    defaultEnvKey: (result?.envKey ?? envKey.trim().toUpperCase()) || "CUSTOM_SECRET",
    secretValue: result?.value ?? "",
    onError: handlePropagationError,
  });
  const propagationVercelIntegrationId = propagation.vercelIntegration?.id;
  const refreshPropagationVercelProjects = propagation.vercel.refreshProjects;

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const next = await invoke<CustomSecretRow[]>("custom_secret_list", { integrationId });
      setItems(next);
      setError(null);
    } catch (err) {
      setError(errText(err));
    } finally {
      setLoading(false);
    }
  }, [integrationId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (result && propagationVercelIntegrationId) void refreshPropagationVercelProjects();
  }, [result, propagationVercelIntegrationId, refreshPropagationVercelProjects]);

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    setCopyHint(null);
    try {
      const next = await invoke<CustomSecretRotateResult>("custom_secret_generate", {
        payload: {
          integrationId,
          name: name.trim(),
          envKey: envKey.trim(),
          profile,
          format,
        },
      });
      setResult(next);
      setPropagationOpen(false);
      setName("");
      setEnvKey("");
      await refresh();
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  async function rotate(row: CustomSecretRow) {
    setBusy(true);
    setError(null);
    setResult(null);
    setCopyHint(null);
    try {
      const next = await invoke<CustomSecretRotateResult>("custom_secret_rotate", {
        payload: { integrationId, id: row.id },
      });
      setResult(next);
      setPropagationOpen(false);
      await refresh();
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: CustomSecretRow) {
    setBusy(true);
    setError(null);
    try {
      await invoke("custom_secret_delete", { payload: { integrationId, id: row.id } });
      await refresh();
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-auto px-10 py-10">
      <ProviderHeader
        providerLabel="CUSTOM"
        title={integration.label}
        description={t("customSecrets.description")}
        backLabel={t("common.backToServices")}
        onBack={onBack}
      />
      <AlertMessage message={error} />
      <LinkedAccountBar
        details={
          <>
            <p className="text-xs text-ink-muted">{t("customSecrets.vaultTitle")}</p>
            <p className="text-sm text-ink">{t("customSecrets.vaultLead")}</p>
          </>
        }
        actions={
          <button
            type="button"
            disabled={loading}
            onClick={() => void refresh()}
            className="rounded-lg border border-surface-3 px-3 py-1.5 text-sm text-ink hover:border-accent/40 disabled:opacity-50"
          >
            {t("customSecrets.refresh")}
          </button>
        }
      />

      <section className="grid gap-5 xl:grid-cols-[minmax(320px,420px)_1fr]">
        <form
          onSubmit={(e) => void generate(e)}
          className="space-y-4 rounded-2xl border border-surface-3/80 bg-surface-1/80 p-5"
        >
          <div>
            <h2 className="text-sm font-semibold text-ink">{t("customSecrets.createTitle")}</h2>
            <p className="mt-1 text-xs leading-relaxed text-ink-muted">{t("customSecrets.createLead")}</p>
          </div>
          <label className="block space-y-1.5 text-xs font-semibold text-ink-muted">
            <span>{t("customSecrets.name")}</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 text-sm font-normal text-ink outline-none ring-accent/40 focus:ring-2"
            />
          </label>
          <label className="block space-y-1.5 text-xs font-semibold text-ink-muted">
            <span>{t("customSecrets.envKey")}</span>
            <input
              value={envKey}
              onChange={(e) => setEnvKey(e.target.value)}
              placeholder="APP_SECRET"
              className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 font-mono text-sm font-normal text-ink outline-none ring-accent/40 focus:ring-2"
            />
          </label>
          <label className="block space-y-1.5 text-xs font-semibold text-ink-muted">
            <span>{t("customSecrets.profile")}</span>
            <select
              value={profile}
              onChange={(e) => setProfile(e.target.value as CustomSecretProfile)}
              className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 text-sm font-normal text-ink outline-none ring-accent/40 focus:ring-2"
            >
              {PROFILES.map((item) => (
                <option key={item} value={item}>
                  {t(`customSecrets.profiles.${item}.label`)}
                </option>
              ))}
            </select>
            <span className="block font-normal text-ink-muted">
              {t(`customSecrets.profiles.${profile}.hint`)}
            </span>
          </label>
          <label className="block space-y-1.5 text-xs font-semibold text-ink-muted">
            <span>{t("customSecrets.format")}</span>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as CustomSecretFormat)}
              className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 text-sm font-normal text-ink outline-none ring-accent/40 focus:ring-2"
            >
              {FORMATS.map((item) => (
                <option key={item} value={item}>
                  {t(`customSecrets.formats.${item}`)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={busy || !name.trim() || !envKey.trim()}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-surface-0 disabled:opacity-50"
          >
            {busy ? t("customSecrets.generating") : t("customSecrets.generate")}
          </button>
        </form>

        <section className="space-y-3 rounded-2xl border border-surface-3/80 bg-surface-1/60 p-5">
          <div>
            <h2 className="text-sm font-semibold text-ink">{t("customSecrets.listTitle")}</h2>
            <p className="mt-1 text-xs text-ink-muted">{t("customSecrets.listLead")}</p>
          </div>
          {loading ? (
            <ProviderLoadingPanel
              title={t("customSecrets.loadingTitle")}
              description={t("customSecrets.loadingDescription")}
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-surface-3/80">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-2/80 text-[11px] uppercase tracking-wide text-ink-muted">
                  <tr>
                    <th className="px-4 py-3 font-semibold">{t("customSecrets.colName")}</th>
                    <th className="px-4 py-3 font-semibold">{t("customSecrets.colProfile")}</th>
                    <th className="px-4 py-3 font-semibold">{t("customSecrets.colEnv")}</th>
                    <th className="px-4 py-3 font-semibold">{t("customSecrets.colRotated")}</th>
                    <th className="px-4 py-3 font-semibold">{t("customSecrets.colActions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-3/60 bg-surface-1/40">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-5 text-center text-ink-muted">
                        {t("customSecrets.empty")}
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => (
                      <tr key={item.id} className="text-ink">
                        <td className="px-4 py-3 font-medium">{item.name}</td>
                        <td className="px-4 py-3 text-xs text-ink-muted">
                          {t(`customSecrets.profiles.${item.profile}.label`)} /{" "}
                          {t(`customSecrets.formats.${item.format}`)}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-ink-muted">{item.envKey}</td>
                        <td className="px-4 py-3 text-xs text-ink-muted">{formatDate(item.lastRotatedAt)}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void rotate(item)}
                              className="rounded-lg border border-accent/50 px-2.5 py-1 text-xs font-medium text-accent hover:bg-accent/10 disabled:opacity-50"
                            >
                              {t("customSecrets.rotate")}
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void remove(item)}
                              className="rounded-lg border border-rose-500/40 px-2.5 py-1 text-xs font-medium text-rose-200 hover:bg-rose-500/10 disabled:opacity-50"
                            >
                              {t("customSecrets.delete")}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>

      {result ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-amber-500/30 bg-surface-1 p-6 shadow-2xl">
            <h3 className="text-sm font-semibold text-amber-100">{t("customSecrets.resultTitle")}</h3>
            <p className="mt-1 text-xs text-ink-muted">
              {t("customSecrets.resultLead", { envKey: result.envKey })}
            </p>
            <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-surface-0 p-3 font-mono text-xs text-ink">
              {result.value}
            </pre>
            {copyHint ? <p className="mt-2 text-xs text-accent">{copyHint}</p> : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPropagationOpen(true)}
                className="rounded-lg border border-accent/50 px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent/10"
              >
                {t("customSecrets.propagate")}
              </button>
              <button
                type="button"
                onClick={() =>
                  void copySensitiveWithAutoClear(result.value).then(() => setCopyHint(t("customSecrets.copied")))
                }
                className="rounded-lg border border-surface-3 px-3 py-1.5 text-sm text-ink hover:border-accent/40"
              >
                {t("customSecrets.copy")}
              </button>
              <button
                type="button"
                onClick={() => setResult(null)}
                className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-surface-0"
              >
                {t("common.close")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {result ? (
        <SecretPropagationModal
          open={propagationOpen}
          valueLabel={t("customSecrets.valueLabel")}
          state={propagation}
          onClose={() => setPropagationOpen(false)}
        />
      ) : null}
    </div>
  );
}
