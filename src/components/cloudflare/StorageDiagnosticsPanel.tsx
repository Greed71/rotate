import type { SecretStorageDiagnosticsDto } from "../../types";

type Props = {
  diagnostics: SecretStorageDiagnosticsDto;
};

export function StorageDiagnosticsPanel({ diagnostics }: Props) {
  return (
    <section className="rounded-2xl border border-surface-3/80 bg-surface-1/60 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">Diagnostica Credential Manager</h2>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
            diagnostics.ok ? "bg-accent/15 text-accent" : "bg-rose-500/15 text-rose-200"
          }`}
        >
          {diagnostics.ok ? "OK" : "Errore"}
        </span>
      </div>
      <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-[180px_1fr]">
        <dt className="text-ink-muted">Voce Cloudflare attesa</dt>
        <dd className="break-all font-mono text-ink">{diagnostics.credentialTarget}</dd>
        <dt className="text-ink-muted">Voce test</dt>
        <dd className="break-all font-mono text-ink">{diagnostics.probeTarget}</dd>
        <dt className="text-ink-muted">Creazione entry</dt>
        <dd className="font-mono text-ink">{diagnostics.entryNew}</dd>
        <dt className="text-ink-muted">Scrittura test</dt>
        <dd className="font-mono text-ink">{diagnostics.setPassword}</dd>
        <dt className="text-ink-muted">Lettura test</dt>
        <dd className="font-mono text-ink">{diagnostics.getPassword}</dd>
        <dt className="text-ink-muted">Pulizia test</dt>
        <dd className="font-mono text-ink">{diagnostics.deleteCredential}</dd>
        <dt className="text-ink-muted">Fallback DPAPI</dt>
        <dd className="font-mono text-ink">{diagnostics.dpapiRoundtrip}</dd>
      </dl>
    </section>
  );
}
