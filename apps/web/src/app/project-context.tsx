import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { supabase } from "./auth-client.js";
import { useAuth } from "./auth-context.js";
import { useOrganization } from "./organization-context.js";

export interface ProjectSummary {
  archivedAt?: string | null;
  description?: string | null;
  id: string;
  key: string;
  name: string;
  teamId?: string | null;
}

interface ProjectContextValue {
  error: string | null;
  isLoading: boolean;
  projects: ProjectSummary[];
  project: ProjectSummary;
  refreshProjects: (preferredProjectId?: string) => Promise<void>;
  selectProject: (projectId: string) => void;
}

interface ProjectProviderProps {
  children: ReactNode;
  initialProject?: ProjectSummary;
}

export const DEFAULT_PROJECT: ProjectSummary = {
  id: "projectpulse-demo",
  key: "PULSE",
  name: "ProjectPulse",
};

const STORAGE_KEY = "projectpulse.selected-project";

const ProjectContext = createContext<ProjectContextValue | undefined>(
  undefined,
);

function storedProjectId() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(STORAGE_KEY) ?? "";
}

export function ProjectProvider({
  children,
  initialProject = DEFAULT_PROJECT,
}: ProjectProviderProps) {
  const { session, status } = useAuth();
  const { selectedOrganizationId } = useOrganization();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState(storedProjectId);
  const [project, setProject] = useState(initialProject);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshProjects = useCallback(
    async (preferredProjectId?: string) => {
      if (status !== "authenticated" || !session || !selectedOrganizationId) {
        setProjects([]);
        setProject(initialProject);
        return;
      }

      setIsLoading(true);
      const { data, error: queryError } = await supabase
        .from("projects")
        .select("id, name, project_key, description, team_id, archived_at")
        .eq("organization_id", selectedOrganizationId)
        .order("name");
      setIsLoading(false);

      if (queryError) {
        setError(queryError.message);
        return;
      }

      const nextProjects = (data ?? []).map((record) => ({
        archivedAt: (record.archived_at as string | null) ?? null,
        description: (record.description as string | null) ?? null,
        id: record.id as string,
        key: record.project_key as string,
        name: record.name as string,
        teamId: (record.team_id as string | null) ?? null,
      }));
      const activeProjects = nextProjects.filter(
        ({ archivedAt }) => !archivedAt,
      );
      const requestedProjectId = preferredProjectId ?? selectedProjectId;
      const nextProjectId = nextProjects.some(
        ({ id }) => id === requestedProjectId,
      )
        ? requestedProjectId
        : (activeProjects[0]?.id ?? "");
      const nextProject =
        nextProjects.find(({ id }) => id === nextProjectId) ?? initialProject;

      setError(null);
      setProjects(nextProjects);
      setSelectedProjectId(nextProjectId);
      setProject(nextProject);
      if (typeof window !== "undefined") {
        if (nextProjectId) {
          window.localStorage.setItem(STORAGE_KEY, nextProjectId);
        } else {
          window.localStorage.removeItem(STORAGE_KEY);
        }
      }
    },
    [
      initialProject,
      selectedOrganizationId,
      selectedProjectId,
      session,
      status,
    ],
  );

  useEffect(() => {
    void refreshProjects();
  }, [refreshProjects]);

  const selectProject = useCallback(
    (projectId: string) => {
      const nextProject = projects.find(({ id }) => id === projectId);
      if (!nextProject) {
        return;
      }

      setSelectedProjectId(projectId);
      setProject(nextProject);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, projectId);
      }
    },
    [projects],
  );

  const value = useMemo(
    () => ({
      error,
      isLoading,
      projects,
      project,
      refreshProjects,
      selectProject,
    }),
    [error, isLoading, projects, project, refreshProjects, selectProject],
  );

  return (
    <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);

  if (!context) {
    throw new Error("useProject must be used inside a ProjectProvider");
  }

  return context;
}
