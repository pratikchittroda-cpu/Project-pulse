import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { supabase } from "./auth-client.js";
import { useAuth } from "./auth-context.js";
import { useOrganization } from "./organization-context.js";
import {
  readProjects,
  readStoredWorkspaceSelection,
  storeSelectedProject,
  writeProjects,
} from "./workspace-cache.js";

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

export const DEMO_PROJECT: ProjectSummary = {
  id: "projectpulse-demo",
  key: "PULSE",
  name: "ReleaseArc",
};

export const EMPTY_PROJECT: ProjectSummary = {
  id: "",
  key: "",
  name: "No project selected",
};

const ProjectContext = createContext<ProjectContextValue | undefined>(
  undefined,
);

function storedProjectId() {
  return readStoredWorkspaceSelection().projectId;
}

export function ProjectProvider({
  children,
  initialProject,
}: ProjectProviderProps) {
  const { isDemoMode, session, status } = useAuth();
  const { selectedOrganizationId } = useOrganization();
  const fallbackProject =
    initialProject ?? (isDemoMode ? DEMO_PROJECT : EMPTY_PROJECT);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState(storedProjectId);
  const selectedProjectIdRef = useRef(selectedProjectId);
  const hasProjectData = useRef(false);
  const refreshSequence = useRef(0);
  const [project, setProject] = useState(fallbackProject);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshProjects = useCallback(
    async (preferredProjectId?: string) => {
      if (status === "loading") {
        return;
      }

      const requestId = ++refreshSequence.current;

      if (status !== "authenticated" || !session || !selectedOrganizationId) {
        hasProjectData.current = false;
        setProjects([]);
        setProject(fallbackProject);
        setIsLoading(false);
        return;
      }

      if (!hasProjectData.current) {
        setIsLoading(true);
      }
      const { data, error: queryError } = await supabase
        .from("projects")
        .select("id, name, project_key, description, team_id, archived_at")
        .eq("organization_id", selectedOrganizationId)
        .order("name");
      if (requestId !== refreshSequence.current) {
        return;
      }
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
      const requestedProjectId =
        preferredProjectId ?? selectedProjectIdRef.current;
      const nextProjectId = nextProjects.some(
        ({ id }) => id === requestedProjectId,
      )
        ? requestedProjectId
        : (activeProjects[0]?.id ?? "");
      const nextProject =
        nextProjects.find(({ id }) => id === nextProjectId) ?? fallbackProject;

      hasProjectData.current = true;
      setError(null);
      writeProjects(session.user.id, selectedOrganizationId, nextProjects);
      setProjects(nextProjects);
      setSelectedProjectId(nextProjectId);
      selectedProjectIdRef.current = nextProjectId;
      setProject(nextProject);
      if (typeof window !== "undefined") {
        if (nextProjectId) {
          storeSelectedProject(nextProjectId);
        } else {
          storeSelectedProject("");
        }
      }
    },
    [fallbackProject, isDemoMode, selectedOrganizationId, session, status],
  );

  useEffect(() => {
    if (status === "loading") {
      return;
    }

    if (!session || !selectedOrganizationId || isDemoMode) {
      refreshSequence.current += 1;
      hasProjectData.current = false;
      setProjects([]);
      setProject(fallbackProject);
      setIsLoading(false);
      return;
    }

    const cachedProjects = readProjects(
      session.user.id,
      selectedOrganizationId,
    );
    hasProjectData.current = cachedProjects.length > 0;
    setProjects(cachedProjects);
    const activeProjects = cachedProjects.filter(
      ({ archivedAt }) => !archivedAt,
    );
    const requestedProjectId = selectedProjectIdRef.current;
    const nextProjectId = cachedProjects.some(
      ({ id }) => id === requestedProjectId,
    )
      ? requestedProjectId
      : (activeProjects[0]?.id ?? "");
    const nextProject =
      cachedProjects.find(({ id }) => id === nextProjectId) ?? fallbackProject;
    setSelectedProjectId(nextProjectId);
    selectedProjectIdRef.current = nextProjectId;
    setProject(nextProject);
    setIsLoading(cachedProjects.length === 0);
    void refreshProjects();
  }, [
    fallbackProject,
    isDemoMode,
    refreshProjects,
    selectedOrganizationId,
    session,
    status,
  ]);

  useEffect(() => {
    selectedProjectIdRef.current = selectedProjectId;
  }, [selectedProjectId]);

  const selectProject = useCallback(
    (projectId: string) => {
      const nextProject = projects.find(({ id }) => id === projectId);
      if (!nextProject) {
        return;
      }

      setSelectedProjectId(projectId);
      selectedProjectIdRef.current = projectId;
      setProject(nextProject);
      storeSelectedProject(projectId);
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
