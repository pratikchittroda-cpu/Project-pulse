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
import {
  readOrganizations,
  readStoredWorkspaceSelection,
  storeSelectedOrganization,
  writeDashboardSnapshot,
  writeOrganizations,
  writeProjects,
} from "./workspace-cache.js";

export type OrganizationRole = "admin" | "member" | "owner" | "viewer";

export interface OrganizationSummary {
  id: string;
  name: string;
  role: OrganizationRole;
  slug: string;
}

interface OrganizationContextValue {
  error: string | null;
  isLoading: boolean;
  organizations: OrganizationSummary[];
  refreshOrganizations: () => Promise<void>;
  selectOrganization: (organizationId: string) => void;
  selectedOrganization: OrganizationSummary | undefined;
  selectedOrganizationId: string;
}

const OrganizationContext = createContext<OrganizationContextValue | undefined>(
  undefined,
);

function storedOrganizationId() {
  return readStoredWorkspaceSelection().organizationId;
}

interface WorkspaceBootstrapPayload {
  dashboard?: unknown;
  organizations?: Array<{
    id: string;
    name: string;
    role: OrganizationRole;
    slug: string;
  }>;
  projects?: Array<{
    archived_at: string | null;
    description: string | null;
    id: string;
    name: string;
    project_key: string;
    team_id: string | null;
  }>;
  selected_organization_id?: string | null;
  selected_project_id?: string | null;
}

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { session, status } = useAuth();
  const initialOrganizations = session
    ? readOrganizations(session.user.id)
    : [];
  const [organizations, setOrganizations] =
    useState<OrganizationSummary[]>(initialOrganizations);
  const [selectedOrganizationId, setSelectedOrganizationId] =
    useState(storedOrganizationId);
  const hasOrganizationData = useRef(initialOrganizations.length > 0);
  const [isLoading, setIsLoading] = useState(
    Boolean(session) && initialOrganizations.length === 0,
  );
  const [error, setError] = useState<string | null>(null);

  const refreshOrganizations = useCallback(async () => {
    if (status === "loading") {
      return;
    }

    if (status !== "authenticated" || !session) {
      hasOrganizationData.current = false;
      setOrganizations([]);
      setSelectedOrganizationId("");
      setIsLoading(false);
      return;
    }

    if (!hasOrganizationData.current) {
      setIsLoading(true);
    }
    const selection = readStoredWorkspaceSelection();
    const { data, error: queryError } = await supabase.rpc(
      "get_workspace_bootstrap",
      {
        preferred_organization_id: selection.organizationId || null,
        preferred_project_id: selection.projectId || null,
      },
    );
    setIsLoading(false);

    if (queryError) {
      setError(queryError.message);
      return;
    }

    const payload = (data ?? {}) as WorkspaceBootstrapPayload;
    const nextOrganizations = (payload.organizations ?? []).map(
      (organization) => ({
        id: organization.id,
        name: organization.name,
        role: organization.role,
        slug: organization.slug,
      }),
    );
    const selectedOrganizationId =
      payload.selected_organization_id ?? nextOrganizations[0]?.id ?? "";
    const selectedProjectId = payload.selected_project_id ?? "";
    const projects = (payload.projects ?? []).map((project) => ({
      archivedAt: project.archived_at,
      description: project.description,
      id: project.id,
      key: project.project_key,
      name: project.name,
      teamId: project.team_id,
    }));
    hasOrganizationData.current = true;
    setError(null);
    writeOrganizations(session.user.id, nextOrganizations);
    if (selectedOrganizationId) {
      writeProjects(session.user.id, selectedOrganizationId, projects);
      if (selectedProjectId && payload.dashboard) {
        writeDashboardSnapshot(
          session.user.id,
          selectedOrganizationId,
          selectedProjectId,
          payload.dashboard,
        );
      }
    }
    setOrganizations(nextOrganizations);
    setSelectedOrganizationId((current) => {
      const nextId = nextOrganizations.some(({ id }) => id === current)
        ? current
        : selectedOrganizationId;
      storeSelectedOrganization(nextId);
      return nextId;
    });
  }, [session, status]);

  useEffect(() => {
    if (status === "loading") {
      return;
    }

    if (!session) {
      hasOrganizationData.current = false;
      setOrganizations([]);
      setSelectedOrganizationId("");
      setIsLoading(false);
      return;
    }

    const cachedOrganizations = readOrganizations(session.user.id);
    hasOrganizationData.current = cachedOrganizations.length > 0;
    setOrganizations(cachedOrganizations);
    setSelectedOrganizationId((current) => {
      const nextId = cachedOrganizations.some(({ id }) => id === current)
        ? current
        : (cachedOrganizations[0]?.id ?? "");
      storeSelectedOrganization(nextId);
      return nextId;
    });
    setIsLoading(cachedOrganizations.length === 0);
    void refreshOrganizations();
  }, [refreshOrganizations, session, status]);

  const selectOrganization = useCallback((organizationId: string) => {
    setSelectedOrganizationId(organizationId);
    storeSelectedOrganization(organizationId);
  }, []);

  const selectedOrganization = organizations.find(
    ({ id }) => id === selectedOrganizationId,
  );
  const value = useMemo(
    () => ({
      error,
      isLoading,
      organizations,
      refreshOrganizations,
      selectOrganization,
      selectedOrganization,
      selectedOrganizationId,
    }),
    [
      error,
      isLoading,
      organizations,
      refreshOrganizations,
      selectOrganization,
      selectedOrganization,
      selectedOrganizationId,
    ],
  );

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);

  if (!context) {
    throw new Error(
      "useOrganization must be used inside an OrganizationProvider",
    );
  }

  return context;
}
