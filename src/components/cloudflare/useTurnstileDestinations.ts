import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";
import type { DeployTarget } from "../../secretDestinations";
import type {
  Integration,
  GithubActionsSecretUpsertResult,
  LocalEnvInspectResult,
  LocalEnvUpsertResult,
  PagesProjectRow,
  SecretsStoreRow,
  SecretsStoreSecretRow,
  SupabaseProjectRow,
  SupabaseSecretRow,
  TurnstileRotateResult,
  VercelProjectRow,
  WorkerScriptRow,
  WorkerSecretRow,
} from "../../types";
import { errText } from "../provider/errors";

type Args = {
  integrationId: string;
  linked: boolean;
  turnstileResult: TurnstileRotateResult | null;
  vercelIntegration?: Integration;
  supabaseIntegration?: Integration;
  githubIntegration?: Integration;
  setError: (message: string | null) => void;
};

export function useTurnstileDestinations({
  integrationId,
  linked,
  turnstileResult,
  vercelIntegration,
  supabaseIntegration,
  githubIntegration,
  setError,
}: Args) {
  const [workerScripts, setWorkerScripts] = useState<WorkerScriptRow[]>([]);
  const [workerSecrets, setWorkerSecrets] = useState<WorkerSecretRow[]>([]);
  const [selectedWorker, setSelectedWorker] = useState("");
  const [workerSecretName, setWorkerSecretName] = useState("TURNSTILE_SECRET_KEY");
  const [workerUpdateHint, setWorkerUpdateHint] = useState<string | null>(null);
  const [workerBusy, setWorkerBusy] = useState(false);
  const [pagesProjects, setPagesProjects] = useState<PagesProjectRow[]>([]);
  const [selectedPagesProject, setSelectedPagesProject] = useState("");
  const [pagesEnvironment, setPagesEnvironment] = useState<"production" | "preview">("production");
  const [pagesSecretName, setPagesSecretName] = useState("TURNSTILE_SECRET_KEY");
  const [pagesBusy, setPagesBusy] = useState(false);
  const [pagesUpdateHint, setPagesUpdateHint] = useState<string | null>(null);
  const [secretsStores, setSecretsStores] = useState<SecretsStoreRow[]>([]);
  const [secretsStoreSecrets, setSecretsStoreSecrets] = useState<SecretsStoreSecretRow[]>([]);
  const [selectedSecretsStore, setSelectedSecretsStore] = useState("");
  const [secretsStoreSecretId, setSecretsStoreSecretId] = useState("");
  const [secretsStoreSecretName, setSecretsStoreSecretName] = useState("TURNSTILE_SECRET_KEY");
  const [secretsStoreScopes, setSecretsStoreScopes] = useState("workers");
  const [secretsStoreBusy, setSecretsStoreBusy] = useState(false);
  const [secretsStoreUpdateHint, setSecretsStoreUpdateHint] = useState<string | null>(null);
  const [vercelProjects, setVercelProjects] = useState<VercelProjectRow[]>([]);
  const [selectedVercelProjectId, setSelectedVercelProjectId] = useState("");
  const [vercelEnvKey, setVercelEnvKey] = useState("TURNSTILE_SECRET_KEY");
  const [vercelTargets, setVercelTargets] = useState(["production"]);
  const [vercelBusy, setVercelBusy] = useState(false);
  const [vercelUpdateHint, setVercelUpdateHint] = useState<string | null>(null);
  const [supabaseProjects, setSupabaseProjects] = useState<SupabaseProjectRow[]>([]);
  const [supabaseSecrets, setSupabaseSecrets] = useState<SupabaseSecretRow[]>([]);
  const [selectedSupabaseProjectRef, setSelectedSupabaseProjectRef] = useState("");
  const [supabaseSecretName, setSupabaseSecretName] = useState("TURNSTILE_SECRET_KEY");
  const [selectedSupabaseSecretNames, setSelectedSupabaseSecretNames] = useState<string[]>([]);
  const [supabaseBusy, setSupabaseBusy] = useState(false);
  const [supabaseUpdateHint, setSupabaseUpdateHint] = useState<string | null>(null);
  const [localEnvPath, setLocalEnvPath] = useState("");
  const [localEnvKeys, setLocalEnvKeys] = useState<string[]>([]);
  const [localEnvKey, setLocalEnvKey] = useState("TURNSTILE_SECRET_KEY");
  const [localEnvBusy, setLocalEnvBusy] = useState(false);
  const [localEnvUpdateHint, setLocalEnvUpdateHint] = useState<string | null>(null);
  const [includeVercel, setIncludeVercel] = useState(false);
  const [includeSupabase, setIncludeSupabase] = useState(false);
  const [includeLocalEnv, setIncludeLocalEnv] = useState(false);
  const [githubOwner, setGithubOwner] = useState("");
  const [githubRepo, setGithubRepo] = useState("");
  const [githubSecretName, setGithubSecretName] = useState("TURNSTILE_SECRET_KEY");
  const [githubBusy, setGithubBusy] = useState(false);
  const [githubUpdateHint, setGithubUpdateHint] = useState<string | null>(null);
  const [includeGithub, setIncludeGithub] = useState(false);
  const [batchBusy, setBatchBusy] = useState(false);
  const [batchHint, setBatchHint] = useState<string | null>(null);

  const resetDestinations = useCallback(() => {
    setWorkerScripts([]);
    setWorkerSecrets([]);
    setPagesProjects([]);
    setSecretsStores([]);
    setSecretsStoreSecrets([]);
    setVercelProjects([]);
    setSupabaseProjects([]);
    setSupabaseSecrets([]);
    setSelectedSupabaseSecretNames([]);
  }, []);

  const resetDestinationHints = useCallback(() => {
    setWorkerUpdateHint(null);
    setPagesUpdateHint(null);
    setSecretsStoreUpdateHint(null);
    setVercelUpdateHint(null);
    setSupabaseUpdateHint(null);
    setLocalEnvUpdateHint(null);
    setGithubUpdateHint(null);
    setBatchHint(null);
  }, []);

  const refreshWorkerScripts = useCallback(async () => {
    try {
      const list = await invoke<WorkerScriptRow[]>("cloudflare_list_worker_scripts", {
        integrationId,
      });
      setWorkerScripts(list);
      setSelectedWorker((current) =>
        current && list.some((worker) => worker.id === current) ? current : list[0]?.id || "",
      );
    } catch {
      setWorkerScripts([]);
      setWorkerSecrets([]);
      setSelectedWorker("");
    }
  }, [integrationId]);

  const refreshWorkerSecrets = useCallback(
    async (scriptName: string) => {
      const name = scriptName.trim();
      if (!name) {
        setWorkerSecrets([]);
        return;
      }
      try {
        const list = await invoke<WorkerSecretRow[]>("cloudflare_list_worker_secrets", {
          integrationId,
          scriptName: name,
        });
        setWorkerSecrets(list);
        const preferred =
          list.find((secret) => secret.name.toUpperCase().includes("TURNSTILE"))?.name ??
          list[0]?.name ??
          "TURNSTILE_SECRET_KEY";
        setWorkerSecretName((current) => current || preferred);
      } catch {
        setWorkerSecrets([]);
      }
    },
    [integrationId],
  );

  const refreshPagesProjects = useCallback(async () => {
    try {
      const list = await invoke<PagesProjectRow[]>("cloudflare_list_pages_projects", {
        integrationId,
      });
      setPagesProjects(list);
      setSelectedPagesProject((current) =>
        current && list.some((project) => project.name === current) ? current : list[0]?.name || "",
      );
    } catch {
      setPagesProjects([]);
      setSelectedPagesProject("");
    }
  }, [integrationId]);

  const refreshSecretsStores = useCallback(async () => {
    try {
      const list = await invoke<SecretsStoreRow[]>("cloudflare_list_secrets_stores", {
        integrationId,
      });
      setSecretsStores(list);
      setSelectedSecretsStore((current) =>
        current && list.some((store) => store.id === current) ? current : list[0]?.id || "",
      );
    } catch {
      setSecretsStores([]);
      setSecretsStoreSecrets([]);
      setSelectedSecretsStore("");
    }
  }, [integrationId]);

  const refreshSecretsStoreSecrets = useCallback(
    async (storeId: string) => {
      const id = storeId.trim();
      if (!id) {
        setSecretsStoreSecrets([]);
        return;
      }
      try {
        const list = await invoke<SecretsStoreSecretRow[]>(
          "cloudflare_list_secrets_store_secrets",
          { integrationId, storeId: id },
        );
        setSecretsStoreSecrets(list);
        const preferred =
          list.find((secret) => secret.name.toUpperCase().includes("TURNSTILE")) ?? list[0];
        if (preferred) {
          setSecretsStoreSecretId((current) => current || preferred.id);
          setSecretsStoreSecretName((current) => current || preferred.name);
          setSecretsStoreScopes((current) => current || preferred.scopes.join(", "));
        }
      } catch {
        setSecretsStoreSecrets([]);
      }
    },
    [integrationId],
  );

  const refreshVercelProjects = useCallback(async () => {
    if (!vercelIntegration) {
      setVercelProjects([]);
      setSelectedVercelProjectId("");
      return;
    }
    try {
      const list = await invoke<VercelProjectRow[]>("vercel_list_projects", {
        integrationId: vercelIntegration.id,
      });
      setVercelProjects(list);
      setSelectedVercelProjectId((current) =>
        current && list.some((project) => project.id === current) ? current : list[0]?.id || "",
      );
    } catch {
      setVercelProjects([]);
      setSelectedVercelProjectId("");
    }
  }, [vercelIntegration]);

  const refreshSupabaseProjects = useCallback(async () => {
    if (!supabaseIntegration) {
      setSupabaseProjects([]);
      setSelectedSupabaseProjectRef("");
      return;
    }
    try {
      const list = await invoke<SupabaseProjectRow[]>("supabase_list_projects", {
        integrationId: supabaseIntegration.id,
      });
      setSupabaseProjects(list);
      setSelectedSupabaseProjectRef((current) =>
        current && list.some((project) => project.reference === current)
          ? current
          : list[0]?.reference || "",
      );
    } catch {
      setSupabaseProjects([]);
      setSelectedSupabaseProjectRef("");
    }
  }, [supabaseIntegration]);

  const refreshSupabaseSecrets = useCallback(
    async (projectRef: string) => {
      if (!supabaseIntegration || !projectRef.trim()) {
        setSupabaseSecrets([]);
        setSelectedSupabaseSecretNames([]);
        return;
      }
      try {
        const list = await invoke<SupabaseSecretRow[]>("supabase_list_project_secrets", {
          integrationId: supabaseIntegration.id,
          projectRef,
        });
        setSupabaseSecrets(list);
        setSupabaseSecretName(
          list.find((secret) => secret.name.toUpperCase().includes("TURNSTILE"))?.name ||
            list[0]?.name ||
            "TURNSTILE_SECRET_KEY",
        );
        const preferred =
          list.find((secret) => secret.name.toUpperCase().includes("TURNSTILE"))?.name ||
          list[0]?.name;
        setSelectedSupabaseSecretNames((current) =>
          current.length > 0 && current.every((name) => list.some((secret) => secret.name === name))
            ? current
            : preferred
              ? [preferred]
              : [],
        );
      } catch {
        setSupabaseSecrets([]);
        setSelectedSupabaseSecretNames([]);
      }
    },
    [supabaseIntegration],
  );

  const updateWorkerWithTurnstileSecret = useCallback(async () => {
    if (!turnstileResult) return;
    const scriptName = selectedWorker.trim();
    const secretName = workerSecretName.trim();
    if (!scriptName || !secretName) return;
    setWorkerBusy(true);
    setWorkerUpdateHint(null);
    setError(null);
    try {
      const row = await invoke<WorkerSecretRow>("cloudflare_update_worker_secret", {
        integrationId,
        scriptName,
        secretName,
        secretValue: turnstileResult.secret,
      });
      setWorkerUpdateHint(`Secret ${row.name} aggiornato in ${scriptName}.`);
      await refreshWorkerSecrets(scriptName);
    } catch (err) {
      setError(errText(err));
    } finally {
      setWorkerBusy(false);
    }
  }, [integrationId, refreshWorkerSecrets, selectedWorker, setError, turnstileResult, workerSecretName]);

  const updatePagesWithTurnstileSecret = useCallback(async () => {
    if (!turnstileResult) return;
    const projectName = selectedPagesProject.trim();
    const secretName = pagesSecretName.trim();
    if (!projectName || !secretName) return;
    setPagesBusy(true);
    setPagesUpdateHint(null);
    setError(null);
    try {
      await invoke("cloudflare_update_pages_secret", {
        integrationId,
        projectName,
        environment: pagesEnvironment,
        secretName,
        secretValue: turnstileResult.secret,
      });
      setPagesUpdateHint(`Secret ${secretName} aggiornato in Pages (${projectName}, ${pagesEnvironment}).`);
      await refreshPagesProjects();
    } catch (err) {
      setError(errText(err));
    } finally {
      setPagesBusy(false);
    }
  }, [integrationId, pagesEnvironment, pagesSecretName, refreshPagesProjects, selectedPagesProject, setError, turnstileResult]);

  const updateSecretsStoreWithTurnstileSecret = useCallback(async () => {
    if (!turnstileResult) return;
    const storeId = selectedSecretsStore.trim();
    const secretName = secretsStoreSecretName.trim();
    if (!storeId || !secretName) return;
    const scopes = secretsStoreScopes
      .split(",")
      .map((scope) => scope.trim())
      .filter(Boolean);
    setSecretsStoreBusy(true);
    setSecretsStoreUpdateHint(null);
    setError(null);
    try {
      const row = await invoke<SecretsStoreSecretRow>("cloudflare_upsert_secrets_store_secret", {
        payload: {
          integrationId,
          storeId,
          secretId: secretsStoreSecretId.trim() || null,
          secretName,
          secretValue: turnstileResult.secret,
          scopes,
        },
      });
      setSecretsStoreSecretId(row.id);
      setSecretsStoreSecretName(row.name);
      setSecretsStoreUpdateHint(`Secret ${row.name} aggiornato in Secrets Store.`);
      await refreshSecretsStoreSecrets(storeId);
    } catch (err) {
      setError(errText(err));
    } finally {
      setSecretsStoreBusy(false);
    }
  }, [integrationId, refreshSecretsStoreSecrets, secretsStoreScopes, secretsStoreSecretId, secretsStoreSecretName, selectedSecretsStore, setError, turnstileResult]);

  const updateVercelWithTurnstileSecret = useCallback(async () => {
    if (!turnstileResult || !vercelIntegration) return false;
    const project = vercelProjects.find((item) => item.id === selectedVercelProjectId);
    const key = vercelEnvKey.trim();
    if (!project || !key) return false;
    setVercelBusy(true);
    setVercelUpdateHint(null);
    setError(null);
    try {
      await invoke("vercel_upsert_project_env", {
        payload: {
          integrationId: vercelIntegration.id,
          projectId: project.id,
          projectName: project.name,
          key,
          value: turnstileResult.secret,
          targets: vercelTargets,
        },
      });
      setVercelUpdateHint(`Env ${key} aggiornata in Vercel (${project.name}).`);
      return true;
    } catch (err) {
      setError(errText(err));
      return false;
    } finally {
      setVercelBusy(false);
    }
  }, [selectedVercelProjectId, setError, turnstileResult, vercelEnvKey, vercelIntegration, vercelProjects, vercelTargets]);

  const updateSupabaseWithTurnstileSecret = useCallback(async () => {
    if (!turnstileResult || !supabaseIntegration) return false;
    const project = supabaseProjects.find((item) => item.reference === selectedSupabaseProjectRef);
    const names =
      selectedSupabaseSecretNames.length > 0
        ? selectedSupabaseSecretNames
        : [supabaseSecretName.trim()].filter(Boolean);
    if (!project || names.length === 0) return false;
    setSupabaseBusy(true);
    setSupabaseUpdateHint(null);
    setError(null);
    try {
      await invoke("supabase_upsert_project_secrets", {
        payload: {
          integrationId: supabaseIntegration.id,
          projectRef: project.reference,
          projectName: project.name,
          names,
          value: turnstileResult.secret,
        },
      });
      setSupabaseUpdateHint(`${names.length} secret aggiornati in Supabase (${project.name}).`);
      await refreshSupabaseSecrets(project.reference);
      return true;
    } catch (err) {
      setError(errText(err));
      return false;
    } finally {
      setSupabaseBusy(false);
    }
  }, [refreshSupabaseSecrets, selectedSupabaseProjectRef, selectedSupabaseSecretNames, setError, supabaseIntegration, supabaseProjects, supabaseSecretName, turnstileResult]);

  const inspectLocalEnv = useCallback(async () => {
    const path = localEnvPath.trim();
    if (!path) return;
    setLocalEnvBusy(true);
    setLocalEnvUpdateHint(null);
    setError(null);
    try {
      const result = await invoke<LocalEnvInspectResult>("local_env_read_keys", { path });
      setLocalEnvPath(result.path);
      setLocalEnvKeys(result.keys);
      const preferred =
        result.keys.find((key) => key.toUpperCase().includes("TURNSTILE")) ||
        result.keys[0] ||
        localEnvKey ||
        "TURNSTILE_SECRET_KEY";
      setLocalEnvKey(preferred);
      setLocalEnvUpdateHint(
        result.exists
          ? `${result.keys.length} chiavi rilevate nel file env.`
          : "Il file non esiste ancora: Rotate lo creera alla scrittura.",
      );
    } catch (err) {
      setError(errText(err));
    } finally {
      setLocalEnvBusy(false);
    }
  }, [localEnvKey, localEnvPath, setError]);

  const updateLocalEnvWithTurnstileSecret = useCallback(async () => {
    if (!turnstileResult) return false;
    const path = localEnvPath.trim();
    const key = localEnvKey.trim();
    if (!path || !key) return false;
    setLocalEnvBusy(true);
    setLocalEnvUpdateHint(null);
    setError(null);
    try {
      const result = await invoke<LocalEnvUpsertResult>("local_env_upsert_secret", {
        payload: { path, key, value: turnstileResult.secret },
      });
      setLocalEnvPath(result.path);
      setLocalEnvKey(result.key);
      setLocalEnvUpdateHint(
        result.created
          ? `Variabile ${result.key} creata nel file env locale.`
          : `Variabile ${result.key} aggiornata nel file env locale.`,
      );
      if (!localEnvKeys.includes(result.key)) {
        setLocalEnvKeys((current) => [...current, result.key]);
      }
      return true;
    } catch (err) {
      setError(errText(err));
      return false;
    } finally {
      setLocalEnvBusy(false);
    }
  }, [localEnvKey, localEnvKeys, localEnvPath, setError, turnstileResult]);

  const updateGithubWithTurnstileSecret = useCallback(async () => {
    if (!turnstileResult || !githubIntegration) return false;
    const owner = githubOwner.trim();
    const repo = githubRepo.trim();
    const name = githubSecretName.trim();
    if (!owner || !repo || !name) return false;
    setGithubBusy(true);
    setGithubUpdateHint(null);
    setError(null);
    try {
      const result = await invoke<GithubActionsSecretUpsertResult>(
        "github_upsert_actions_secret",
        {
          payload: {
            integrationId: githubIntegration.id,
            owner,
            repo,
            name,
            value: turnstileResult.secret,
          },
        },
      );
      setGithubOwner(result.owner);
      setGithubRepo(result.repo);
      setGithubSecretName(result.name);
      setGithubUpdateHint(`Secret ${result.name} aggiornato in ${result.owner}/${result.repo}.`);
      return true;
    } catch (err) {
      setError(errText(err));
      return false;
    } finally {
      setGithubBusy(false);
    }
  }, [githubIntegration, githubOwner, githubRepo, githubSecretName, setError, turnstileResult]);

  const applySelectedDestinations = useCallback(async () => {
    const jobs: Array<[string, () => Promise<boolean>]> = [];
    if (includeVercel) jobs.push(["Vercel", updateVercelWithTurnstileSecret]);
    if (includeSupabase) jobs.push(["Supabase", updateSupabaseWithTurnstileSecret]);
    if (includeLocalEnv) jobs.push(["Env locale", updateLocalEnvWithTurnstileSecret]);
    if (includeGithub) jobs.push(["GitHub", updateGithubWithTurnstileSecret]);
    if (jobs.length === 0) return;
    setBatchBusy(true);
    setBatchHint(null);
    const results: string[] = [];
    try {
      for (const [label, job] of jobs) {
        const ok = await job();
        results.push(`${label}: ${ok ? "aggiornato" : "non aggiornato"}`);
      }
      setBatchHint(results.join(" · "));
    } finally {
      setBatchBusy(false);
    }
  }, [
    includeLocalEnv,
    includeGithub,
    includeSupabase,
    includeVercel,
    updateLocalEnvWithTurnstileSecret,
    updateSupabaseWithTurnstileSecret,
    updateVercelWithTurnstileSecret,
    updateGithubWithTurnstileSecret,
  ]);

  useEffect(() => {
    if (linked && selectedWorker) {
      void refreshWorkerSecrets(selectedWorker);
    }
  }, [linked, selectedWorker, refreshWorkerSecrets]);

  useEffect(() => {
    if (linked && selectedSecretsStore) {
      void refreshSecretsStoreSecrets(selectedSecretsStore);
    }
  }, [linked, selectedSecretsStore, refreshSecretsStoreSecrets]);

  useEffect(() => {
    if (linked && selectedSupabaseProjectRef) {
      void refreshSupabaseSecrets(selectedSupabaseProjectRef);
    }
  }, [linked, selectedSupabaseProjectRef, refreshSupabaseSecrets]);

  return {
    workerScripts,
    workerSecrets,
    selectedWorker,
    setSelectedWorker,
    workerSecretName,
    setWorkerSecretName,
    workerUpdateHint,
    setWorkerUpdateHint,
    workerBusy,
    pagesProjects,
    selectedPagesProject,
    setSelectedPagesProject,
    pagesEnvironment,
    setPagesEnvironment,
    pagesSecretName,
    setPagesSecretName,
    pagesBusy,
    pagesUpdateHint,
    setPagesUpdateHint,
    secretsStores,
    secretsStoreSecrets,
    selectedSecretsStore,
    setSelectedSecretsStore,
    setSecretsStoreSecretId,
    secretsStoreSecretName,
    setSecretsStoreSecretName,
    secretsStoreScopes,
    setSecretsStoreScopes,
    secretsStoreBusy,
    secretsStoreUpdateHint,
    setSecretsStoreUpdateHint,
    vercelProjects,
    selectedVercelProjectId,
    setSelectedVercelProjectId,
    vercelEnvKey,
    setVercelEnvKey,
    vercelTargets,
    vercelBusy,
    vercelUpdateHint,
    setVercelUpdateHint,
    supabaseProjects,
    supabaseSecrets,
    selectedSupabaseProjectRef,
    setSelectedSupabaseProjectRef,
    supabaseSecretName,
    setSupabaseSecretName,
    selectedSupabaseSecretNames,
    supabaseBusy,
    supabaseUpdateHint,
    setSupabaseUpdateHint,
    localEnvPath,
    setLocalEnvPath,
    localEnvKeys,
    localEnvKey,
    setLocalEnvKey,
    localEnvBusy,
    localEnvUpdateHint,
    setLocalEnvUpdateHint,
    includeVercel,
    setIncludeVercel,
    includeSupabase,
    setIncludeSupabase,
    includeLocalEnv,
    setIncludeLocalEnv,
    batchBusy,
    batchHint,
    githubOwner,
    setGithubOwner,
    githubRepo,
    setGithubRepo,
    githubSecretName,
    setGithubSecretName,
    githubBusy,
    githubUpdateHint,
    setGithubUpdateHint,
    includeGithub,
    setIncludeGithub,
    resetDestinations,
    resetDestinationHints,
    refreshWorkerScripts,
    refreshPagesProjects,
    refreshSecretsStores,
    refreshVercelProjects,
    refreshSupabaseProjects,
    updateWorkerWithTurnstileSecret,
    updatePagesWithTurnstileSecret,
    updateSecretsStoreWithTurnstileSecret,
    updateVercelWithTurnstileSecret,
    updateSupabaseWithTurnstileSecret,
    inspectLocalEnv,
    updateLocalEnvWithTurnstileSecret,
    updateGithubWithTurnstileSecret,
    applySelectedDestinations,
    toggleVercelTarget(target: DeployTarget) {
      setVercelTargets((current) =>
        current.includes(target) ? current.filter((item) => item !== target) : [...current, target],
      );
    },
    toggleSupabaseSecretName(name: string) {
      setSelectedSupabaseSecretNames((current) =>
        current.includes(name) ? current.filter((item) => item !== name) : [...current, name],
      );
    },
  };
}
