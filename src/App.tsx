import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CloudflareDetail } from "./components/CloudflareDetail";
import { ExploreView } from "./components/ExploreView";
import { HomeView } from "./components/HomeView";
import { ServicePlaceholderDetail } from "./components/ServicePlaceholderDetail";
import { ServicesView } from "./components/ServicesView";
import { LanguageSwitcher } from "./components/LanguageSwitcher";
import { Sidebar } from "./components/Sidebar";
import { ChangePinModal } from "./components/vault/ChangePinModal";
import { PinSetupScreen } from "./components/vault/PinSetupScreen";
import { UnlockScreen } from "./components/vault/UnlockScreen";
import type { Integration, IntegrationDto, NavId, ProviderId, SecurityStatusDto } from "./types";
import { integrationFromDto } from "./types";

async function loadIntegrationsFromDisk(): Promise<Integration[]> {
  const rows = await invoke<IntegrationDto[]>("integrations_list");
  return rows.map(integrationFromDto);
}

function errText(e: unknown): string {
  if (typeof e === "string") return e;
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return String(e);
}

function MainShell(props: {
  vault: SecurityStatusDto;
  onVaultUpdated: (s: SecurityStatusDto) => void;
  onOpenChangePin: () => void;
}) {
  const { vault, onVaultUpdated, onOpenChangePin } = props;
  const { t } = useTranslation();
  const [nav, setNav] = useState<NavId>("home");
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [backendHint, setBackendHint] = useState(() => t("app.backendConnecting"));
  const [openedService, setOpenedService] = useState<Integration | null>(null);

  const handleNavigate = useCallback((id: NavId) => {
    setNav(id);
    if (id === "services") setOpenedService(null);
  }, []);

  const refreshVault = useCallback(async () => {
    try {
      const s = await invoke<SecurityStatusDto>("security_status");
      onVaultUpdated(s);
    } catch {
      /* ignore */
    }
  }, [onVaultUpdated]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const line = await invoke<string>("platform_blurb");
        if (!cancelled) setBackendHint(line);
      } catch {
        if (!cancelled) setBackendHint(t("app.browserOnlyBackend"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await loadIntegrationsFromDisk();
        if (!cancelled) setIntegrations(list);
      } catch {
        if (!cancelled) setIntegrations([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vault.unlocked]);

  useEffect(() => {
    if (!vault.unlocked) return;
    const id = window.setInterval(() => {
      void refreshVault();
    }, 15_000);
    return () => window.clearInterval(id);
  }, [vault.unlocked, refreshVault]);

  const handleAdd = useCallback(
    async (provider: ProviderId) => {
      if (integrations.some((p) => p.provider === provider)) {
        setNav("services");
        return;
      }
      try {
        const row = await invoke<IntegrationDto>("integrations_add", {
          provider,
          label: t(`providers.${provider}.defaultLabel`),
        });
        setIntegrations((prev) => [...prev, integrationFromDto(row)]);
        setNav("services");
      } catch (e) {
        console.error(e);
        try {
          const list = await loadIntegrationsFromDisk();
          setIntegrations(list);
        } catch {
          /* ignore */
        }
      }
    },
    [integrations, t],
  );

  const lockVault = useCallback(async () => {
    try {
      const s = await invoke<SecurityStatusDto>("security_lock");
      onVaultUpdated(s);
    } catch (e) {
      console.error(e);
    }
  }, [onVaultUpdated]);

  const closeServiceDetail = useCallback(() => setOpenedService(null), []);

  const sessionMinutes =
    vault.sessionSecondsRemaining != null
      ? Math.max(0, Math.ceil(vault.sessionSecondsRemaining / 60))
      : null;

  return (
    <div className="flex h-full bg-surface-0 text-ink">
      <Sidebar
        active={nav}
        onNavigate={handleNavigate}
        serviceCount={integrations.length}
        backendHint={backendHint}
        vaultUnlocked={vault.unlocked}
        sessionMinutesRemaining={sessionMinutes}
        onLockVault={() => void lockVault()}
        onOpenChangePin={onOpenChangePin}
      />
      <main className="flex min-w-0 flex-1 flex-col bg-gradient-to-br from-surface-0 via-surface-0 to-surface-1">
        {nav === "home" ? (
          <HomeView integrations={integrations} onGoExplore={() => setNav("explore")} />
        ) : null}
        {nav === "explore" ? (
          <ExploreView integrations={integrations} onAdd={handleAdd} />
        ) : null}
        {nav === "services" ? (
          openedService ? (
            openedService.provider === "cloudflare" ? (
              <CloudflareDetail integration={openedService} onBack={closeServiceDetail} />
            ) : (
              <ServicePlaceholderDetail integration={openedService} onBack={closeServiceDetail} />
            )
          ) : (
            <ServicesView
              integrations={integrations}
              onGoExplore={() => setNav("explore")}
              onOpenIntegration={setOpenedService}
            />
          )
        ) : null}
      </main>
    </div>
  );
}

function App() {
  const { t } = useTranslation();
  const [vault, setVault] = useState<SecurityStatusDto | null>(null);
  const [vaultLoadError, setVaultLoadError] = useState<string | null>(null);
  const [changePinOpen, setChangePinOpen] = useState(false);

  const refreshVault = useCallback(async () => {
    try {
      const s = await invoke<SecurityStatusDto>("security_status");
      setVault(s);
      setVaultLoadError(null);
    } catch (e) {
      setVaultLoadError(errText(e));
      setVault(null);
    }
  }, []);

  useEffect(() => {
    void refreshVault();
  }, [refreshVault]);

  if (vaultLoadError && vault === null) {
    return (
      <div className="relative flex h-full flex-col items-center justify-center bg-surface-0 px-6 text-center text-sm text-rose-200">
        <div className="absolute right-4 top-4 z-10 sm:right-6 sm:top-6">
          <LanguageSwitcher />
        </div>
        {t("app.vaultUnavailable", { error: vaultLoadError })}
      </div>
    );
  }

  if (!vault) {
    return (
      <div className="relative flex h-full flex-col items-center justify-center bg-surface-0 text-ink-muted">
        <div className="absolute right-4 top-4 z-10 sm:right-6 sm:top-6">
          <LanguageSwitcher />
        </div>
        {t("app.vaultInit")}
      </div>
    );
  }

  if (!vault.pinConfigured) {
    return <PinSetupScreen onConfigured={(s) => setVault(s)} />;
  }

  if (!vault.unlocked) {
    return <UnlockScreen onUnlocked={(s) => setVault(s)} />;
  }

  return (
    <>
      <MainShell
        vault={vault}
        onVaultUpdated={setVault}
        onOpenChangePin={() => setChangePinOpen(true)}
      />
      <ChangePinModal
        open={changePinOpen}
        onClose={() => setChangePinOpen(false)}
        onSuccess={() => void refreshVault()}
      />
    </>
  );
}

export default App;
