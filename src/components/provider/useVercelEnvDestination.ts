import { invoke } from "@tauri-apps/api/core";
import { useCallback, useState } from "react";
import type { DeployTarget } from "../../secretDestinations";
import type { Integration, VercelProjectRow } from "../../types";
import { errText } from "./errors";

type Options = {
  vercelIntegration: Integration | undefined;
  defaultEnvKey: string;
  onError: (message: string) => void;
};

export function useVercelEnvDestination({
  vercelIntegration,
  defaultEnvKey,
  onError,
}: Options) {
  const [projects, setProjects] = useState<VercelProjectRow[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [envKey, setEnvKey] = useState(defaultEnvKey);
  const [targets, setTargets] = useState(["production"]);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const refreshProjects = useCallback(async () => {
    if (!vercelIntegration) {
      setProjects([]);
      setSelectedProjectId("");
      return;
    }
    try {
      const list = await invoke<VercelProjectRow[]>("vercel_list_projects", {
        integrationId: vercelIntegration.id,
      });
      setProjects(list);
      setSelectedProjectId((current) =>
        current && list.some((project) => project.id === current) ? current : list[0]?.id || "",
      );
    } catch (e) {
      setProjects([]);
      setSelectedProjectId("");
      onError(errText(e));
    }
  }, [onError, vercelIntegration]);

  const toggleTarget = useCallback((target: DeployTarget) => {
    setTargets((current) =>
      current.includes(target) ? current.filter((item) => item !== target) : [...current, target],
    );
  }, []);

  const writeValue = useCallback(
    async (value: string) => {
      if (!vercelIntegration) return false;
      const project = projects.find((item) => item.id === selectedProjectId);
      const key = envKey.trim();
      if (!project || !key || !value) return false;
      setBusy(true);
      setHint(null);
      try {
        await invoke("vercel_upsert_project_env", {
          payload: {
            integrationId: vercelIntegration.id,
            projectId: project.id,
            projectName: project.name,
            key,
            value,
            targets,
          },
        });
        setHint(`Env ${key} aggiornata in Vercel (${project.name}).`);
        return true;
      } catch (e) {
        onError(errText(e));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [envKey, onError, projects, selectedProjectId, targets, vercelIntegration],
  );

  return {
    projects,
    selectedProjectId,
    envKey,
    targets,
    busy,
    hint,
    refreshProjects,
    setSelectedProjectId,
    setEnvKey,
    setHint,
    toggleTarget,
    writeValue,
  };
}
