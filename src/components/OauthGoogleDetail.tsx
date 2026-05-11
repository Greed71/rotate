import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";
import { copySensitiveWithAutoClear } from "../clipboardSecure";
import type { Integration, OauthGoogleStatusDto } from "../types";
import { AlertMessage } from "./provider/AlertMessage";
import { CredentialGuide } from "./provider/CredentialGuide";
import { LinkedAccountBar } from "./provider/LinkedAccountBar";
import { ProviderHeader } from "./provider/ProviderHeader";
import { VercelEnvWriter } from "./provider/VercelEnvWriter";
import { errText } from "./provider/errors";
import { useVercelEnvDestination } from "./provider/useVercelEnvDestination";

type Props = {
  integration: Integration;
  integrations?: Integration[];
  onBack: () => void;
};

export function OauthGoogleDetail({ integration, integrations = [], onBack }: Props) {
  const [status, setStatus] = useState<OauthGoogleStatusDto | null>(null);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [revealedSecret, setRevealedSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const integrationId = integration.id;
  const linked = status?.linked ?? false;
  const vercelIntegration = integrations.find((item) => item.provider === "vercel");
  const handleVercelError = useCallback((message: string) => setError(message), []);
  const vercelDestination = useVercelEnvDestination({
    vercelIntegration,
    defaultEnvKey: "GOOGLE_CLIENT_SECRET",
    onError: handleVercelError,
  });
  const refreshVercelProjects = vercelDestination.refreshProjects;

  const refreshStatus = useCallback(async () => {
    try {
      const next = await invoke<OauthGoogleStatusDto>("oauth_google_status", { integrationId });
      setStatus(next);
      setClientId(next.clientId ?? "");
    } catch {
      setStatus({ linked: false, clientId: null, label: null });
    }
  }, [integrationId]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (linked && vercelIntegration) void refreshVercelProjects();
  }, [linked, vercelIntegration, refreshVercelProjects]);

  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    setHint(null);
    try {
      const generatedSecret = clientSecret.trim();
      const next = await invoke<OauthGoogleStatusDto>("oauth_google_link", {
        payload: {
          integrationId,
          clientId: clientId.trim(),
          clientSecret: generatedSecret || null,
          label: null,
        },
      });
      setStatus(next);
      setClientSecret("");
      setRevealedSecret(generatedSecret);
      setHint(generatedSecret ? "Secret Google salvato. Ora aggiorna gli env collegati." : "Client OAuth collegato. Aggiungi il secret quando lo generi da Google.");
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  async function unlink() {
    setBusy(true);
    setError(null);
    try {
      await invoke("oauth_google_unlink", { integrationId });
      setStatus({ linked: false, clientId: null, label: null });
      setClientId("");
      setClientSecret("");
      setRevealedSecret("");
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-auto px-10 py-10">
      <ProviderHeader
        providerLabel="GOOGLE OAUTH"
        title={integration.label}
        description="Custodisci il client secret generato da Google e propagalo negli env dei deploy."
        backLabel="← Torna ai servizi"
        onBack={onBack}
      />
      <AlertMessage message={error} />
      <CredentialGuide
        title="Rotazione Google OAuth"
        steps={[
          "Apri Google Auth Platform → Clients e seleziona il client OAuth.",
          "Usa Add Secret per generare un nuovo client secret. Google lo mostra una sola volta.",
          "Incolla qui il nuovo secret e aggiorna Vercel o gli altri ambienti prima di disabilitare il vecchio secret.",
        ]}
        links={[{ href: "https://console.cloud.google.com/auth/clients", label: "Google Auth Platform Clients" }]}
      />
      {linked ? (
        <LinkedAccountBar
          details={<><p className="text-xs text-ink-muted">Client collegato</p><p className="font-mono text-sm text-ink">{status?.clientId}</p></>}
          actions={<button type="button" disabled={busy} onClick={() => void unlink()} className="rounded-lg border border-rose-500/40 px-3 py-1.5 text-sm text-rose-200 hover:bg-rose-500/10">Rimuovi collegamento</button>}
        />
      ) : null}
      <form onSubmit={(e) => void save(e)} className="max-w-2xl space-y-4 rounded-2xl border border-surface-3/80 bg-surface-1/80 p-6">
        <div>
          <h2 className="text-sm font-semibold text-ink">{linked ? "Salva il nuovo secret generato da Google" : "Collega client OAuth"}</h2>
          <p className="mt-1 text-xs text-ink-muted">
            Per collegare il client basta il Google Client ID. Il secret si aggiunge dopo, quando lo generi con Add Secret nella Console Google.
          </p>
        </div>
        <a
          href="https://console.cloud.google.com/auth/clients"
          target="_blank"
          rel="noreferrer"
          className="inline-flex rounded-lg border border-accent/50 px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent/10"
        >
          Apri Google Auth Platform
        </a>
        <label className="block space-y-1.5 text-xs font-semibold text-ink-muted">
          <span>Google Client ID</span>
          <input value={clientId} onChange={(e) => setClientId(e.target.value)} className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 font-mono text-sm font-normal text-ink outline-none ring-accent/40 focus:ring-2" autoComplete="off" />
        </label>
        <label className="block space-y-1.5 text-xs font-semibold text-ink-muted">
          <span>{linked ? "Secret generato da Google" : "Google Client Secret opzionale"}</span>
          <input type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 font-mono text-sm font-normal text-ink outline-none ring-accent/40 focus:ring-2" autoComplete="off" />
          <span className="block font-normal text-ink-muted">
            Al primo collegamento puoi lasciarlo vuoto. Quando ruoti, incolla qui il secret appena creato con Add Secret nella Console Google.
          </span>
        </label>
        {hint ? <p className="text-xs text-accent">{hint}</p> : null}
        <button type="submit" disabled={busy || !clientId.trim()} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-surface-0 disabled:opacity-50">
          {busy ? "Salvataggio..." : linked ? "Salva modifiche" : "Collega client"}
        </button>
      </form>
      {revealedSecret ? (
        <section className="max-w-2xl rounded-2xl border border-amber-500/30 bg-surface-1/80 p-5">
          <h2 className="text-sm font-semibold text-amber-100">Client secret Google pronto</h2>
          <p className="mt-1 text-xs text-ink-muted">
            Questo e il valore generato da Google e salvato in Rotate. Aggiorna subito gli env collegati.
          </p>
          <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-surface-0 p-3 font-mono text-xs text-ink">{revealedSecret}</pre>
          <div className="mt-3 flex justify-end">
            <button type="button" onClick={() => void copySensitiveWithAutoClear(revealedSecret).then(() => setHint("Secret copiato negli appunti temporanei."))} className="rounded-lg border border-surface-3 px-3 py-1.5 text-sm text-ink hover:border-accent/40">Copia secret</button>
          </div>
          {vercelIntegration ? <VercelEnvWriter title="Aggiorna Vercel env" description="Scrive il client secret Google negli env del progetto." projects={vercelDestination.projects} selectedProjectId={vercelDestination.selectedProjectId} envKey={vercelDestination.envKey} targets={vercelDestination.targets} busy={vercelDestination.busy} hint={vercelDestination.hint} emptyMessage="Nessun progetto Vercel" onRefreshProjects={() => void refreshVercelProjects()} onSelectProject={vercelDestination.setSelectedProjectId} onChangeEnvKey={vercelDestination.setEnvKey} onToggleTarget={vercelDestination.toggleTarget} onWrite={() => void vercelDestination.writeValue(revealedSecret || clientSecret.trim())} /> : null}
        </section>
      ) : null}
    </div>
  );
}
