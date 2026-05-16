import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { DeployTarget } from "../../secretDestinations";
import type {
  GithubActionsSecretUpsertResult,
  Integration,
  LocalEnvInspectResult,
  LocalEnvUpsertResult,
} from "../../types";
import { errText } from "./errors";
import { useVercelEnvDestination } from "./useVercelEnvDestination";

type Options = {
  integrations: Integration[];
  defaultEnvKey: string;
  secretValue: string;
  onError: (message: string) => void;
};

export function useSecretPropagation({
  integrations,
  defaultEnvKey,
  secretValue,
  onError,
}: Options) {
  const { t } = useTranslation();
  const vercelIntegration = integrations.find((item) => item.provider === "vercel");
  const githubIntegration = integrations.find((item) => item.provider === "github");
  const vercel = useVercelEnvDestination({ vercelIntegration, defaultEnvKey, onError });

  const [localEnvPath, setLocalEnvPath] = useState("");
  const [localEnvKeys, setLocalEnvKeys] = useState<string[]>([]);
  const [localEnvKey, setLocalEnvKey] = useState(defaultEnvKey);
  const [localEnvBusy, setLocalEnvBusy] = useState(false);
  const [localEnvHint, setLocalEnvHint] = useState<string | null>(null);
  const [githubOwner, setGithubOwner] = useState("");
  const [githubRepo, setGithubRepo] = useState("");
  const [githubSecretName, setGithubSecretName] = useState(defaultEnvKey);
  const [githubBusy, setGithubBusy] = useState(false);
  const [githubHint, setGithubHint] = useState<string | null>(null);
  const [includeVercel, setIncludeVercel] = useState(false);
  const [includeLocalEnv, setIncludeLocalEnv] = useState(false);
  const [includeGithub, setIncludeGithub] = useState(false);
  const [batchBusy, setBatchBusy] = useState(false);
  const [batchHint, setBatchHint] = useState<string | null>(null);

  useEffect(() => {
    vercel.setEnvKey(defaultEnvKey);
    setLocalEnvKey(defaultEnvKey);
    setGithubSecretName(defaultEnvKey);
  }, [defaultEnvKey, vercel.setEnvKey]);

  const inspectLocalEnv = useCallback(async () => {
    const path = localEnvPath.trim();
    if (!path) return;
    setLocalEnvBusy(true);
    setLocalEnvHint(null);
    try {
      const result = await invoke<LocalEnvInspectResult>("local_env_read_keys", { path });
      setLocalEnvPath(result.path);
      setLocalEnvKeys(result.keys);
      const preferred =
        result.keys.find((key) => key === defaultEnvKey) ||
        result.keys.find((key) => key.toUpperCase().includes(defaultEnvKey.split("_")[0] || "")) ||
        result.keys[0] ||
        defaultEnvKey;
      setLocalEnvKey(preferred);
      setLocalEnvHint(
        result.exists
          ? t("propagation.localEnvKeysFound", { count: result.keys.length })
          : t("propagation.localEnvWillCreate"),
      );
    } catch (err) {
      onError(errText(err));
    } finally {
      setLocalEnvBusy(false);
    }
  }, [defaultEnvKey, localEnvPath, onError, t]);

  const writeLocalEnv = useCallback(async () => {
    const path = localEnvPath.trim();
    const key = localEnvKey.trim();
    if (!path || !key || !secretValue) return false;
    setLocalEnvBusy(true);
    setLocalEnvHint(null);
    try {
      const result = await invoke<LocalEnvUpsertResult>("local_env_upsert_secret", {
        payload: { path, key, value: secretValue },
      });
      setLocalEnvPath(result.path);
      setLocalEnvKey(result.key);
      setLocalEnvHint(
        result.created
          ? t("propagation.localEnvCreated", { key: result.key })
          : t("propagation.localEnvUpdated", { key: result.key }),
      );
      setLocalEnvKeys((current) =>
        current.includes(result.key) ? current : [...current, result.key],
      );
      return true;
    } catch (err) {
      onError(errText(err));
      return false;
    } finally {
      setLocalEnvBusy(false);
    }
  }, [localEnvKey, localEnvPath, onError, secretValue, t]);

  const writeGithub = useCallback(async () => {
    if (!githubIntegration || !secretValue) return false;
    const owner = githubOwner.trim();
    const repo = githubRepo.trim();
    const name = githubSecretName.trim();
    if (!owner || !repo || !name) return false;
    setGithubBusy(true);
    setGithubHint(null);
    try {
      const result = await invoke<GithubActionsSecretUpsertResult>("github_upsert_actions_secret", {
        payload: {
          integrationId: githubIntegration.id,
          owner,
          repo,
          name,
          value: secretValue,
        },
      });
      setGithubOwner(result.owner);
      setGithubRepo(result.repo);
      setGithubSecretName(result.name);
      setGithubHint(t("propagation.githubUpdated", {
        name: result.name,
        owner: result.owner,
        repo: result.repo,
      }));
      return true;
    } catch (err) {
      onError(errText(err));
      return false;
    } finally {
      setGithubBusy(false);
    }
  }, [githubIntegration, githubOwner, githubRepo, githubSecretName, onError, secretValue, t]);

  const writeVercel = useCallback(async () => {
    if (
      !vercelIntegration ||
      !secretValue ||
      !vercel.selectedProjectId ||
      !vercel.envKey.trim() ||
      vercel.targets.length === 0
    ) {
      return false;
    }
    return await vercel.writeValue(secretValue);
  }, [secretValue, vercel, vercelIntegration]);

  const applySelected = useCallback(async () => {
    const jobs: Array<[string, () => Promise<boolean>]> = [];
    if (includeVercel) jobs.push(["Vercel", writeVercel]);
    if (includeLocalEnv) jobs.push(["Env locale", writeLocalEnv]);
    if (includeGithub) jobs.push(["GitHub", writeGithub]);
    if (jobs.length === 0) return;
    setBatchBusy(true);
    setBatchHint(null);
    const results: string[] = [];
    try {
      for (const [label, job] of jobs) {
        const ok = await job();
        results.push(`${label}: ${ok ? t("propagation.updated") : t("propagation.notUpdated")}`);
      }
      setBatchHint(results.join(" - "));
    } finally {
      setBatchBusy(false);
    }
  }, [
    includeGithub,
    includeLocalEnv,
    includeVercel,
    writeGithub,
    writeLocalEnv,
    writeVercel,
    t,
  ]);

  return {
    vercelIntegration,
    githubIntegration,
    vercel,
    localEnvPath,
    setLocalEnvPath,
    localEnvKeys,
    localEnvKey,
    setLocalEnvKey,
    localEnvBusy,
    localEnvHint,
    inspectLocalEnv,
    writeLocalEnv,
    writeVercel,
    githubOwner,
    setGithubOwner,
    githubRepo,
    setGithubRepo,
    githubSecretName,
    setGithubSecretName,
    githubBusy,
    githubHint,
    writeGithub,
    includeVercel,
    setIncludeVercel,
    includeLocalEnv,
    setIncludeLocalEnv,
    includeGithub,
    setIncludeGithub,
    batchBusy,
    batchHint,
    applySelected,
    toggleVercelTarget(target: DeployTarget) {
      vercel.toggleTarget(target);
    },
  };
}

export type SecretPropagationState = ReturnType<typeof useSecretPropagation>;
