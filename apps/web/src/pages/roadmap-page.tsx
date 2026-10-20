import { useMemo } from "react";
import { Link } from "react-router-dom";
import { PageLayout } from "@projectpulse/ui";

import { useAuth } from "../app/auth-context.js";
import { useOrganization } from "../app/organization-context.js";
import { DEFAULT_PROJECT, useProject } from "../app/project-context.js";
import { RoadmapWorkspace } from "../features/roadmap/roadmap-workspace.js";
import "../features/roadmap/roadmap.css";

export function RoadmapPage() {
  const { session, status } = useAuth();
  const {
    selectedOrganization,
    selectedOrganizationId,
    isLoading: loadingOrganizations,
    error: organizationError,
  } = useOrganization();
  const {
    project,
    isLoading: loadingProjects,
    error: projectError,
  } = useProject();
  const scope = useMemo(
    () => ({
      organizationId: selectedOrganizationId,
      projectId: project.id,
      projectKey: project.key,
      userId: session?.user.id ?? "",
    }),
    [project.id, project.key, selectedOrganizationId, session?.user.id],
  );

  if (status === "loading" || loadingOrganizations || loadingProjects)
    return (
      <p className="muted" role="status">
        Loading roadmap…
      </p>
    );
  if (organizationError || projectError)
    return (
      <p className="auth-error" role="alert">
        {organizationError ?? projectError}
      </p>
    );
  if (!selectedOrganizationId || project.id === DEFAULT_PROJECT.id || !session)
    return (
      <PageLayout
        title="Roadmap"
        description="Select an organization and project to plan initiatives, epics, and milestones."
      >
        <Link className="button button-primary" to="/app/projects">
          Open projects
        </Link>
      </PageLayout>
    );
  return (
    <RoadmapWorkspace
      archivedProject={Boolean(project.archivedAt)}
      canAdministerOrganization={
        selectedOrganization?.role === "owner" ||
        selectedOrganization?.role === "admin"
      }
      key={`${scope.organizationId}:${scope.projectId}:${scope.userId}`}
      scope={scope}
    />
  );
}
