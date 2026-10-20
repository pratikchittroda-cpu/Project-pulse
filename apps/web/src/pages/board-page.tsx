import { useMemo } from "react";
import { Link } from "react-router-dom";
import { PageLayout } from "@projectpulse/ui";

import { useAuth } from "../app/auth-context.js";
import { useOrganization } from "../app/organization-context.js";
import { DEFAULT_PROJECT, useProject } from "../app/project-context.js";
import { KanbanBoard } from "../features/board/kanban-board.js";
import "../features/board/kanban-board.css";

export function BoardPage() {
  const { session, status } = useAuth();
  const {
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

  if (status === "loading" || loadingOrganizations || loadingProjects) {
    return (
      <p className="muted" role="status">
        Loading board…
      </p>
    );
  }

  if (organizationError || projectError) {
    return (
      <p className="auth-error" role="alert">
        {organizationError ?? projectError}
      </p>
    );
  }

  if (
    !selectedOrganizationId ||
    project.id === DEFAULT_PROJECT.id ||
    !session
  ) {
    return (
      <PageLayout
        title="Kanban board"
        description="Select an organization and project to plan work on a board."
      >
        <Link className="button button-primary" to="/app/projects">
          Open projects
        </Link>
      </PageLayout>
    );
  }

  return (
    <KanbanBoard
      archivedProject={Boolean(project.archivedAt)}
      key={`${scope.organizationId}:${scope.projectId}:${scope.userId}`}
      scope={scope}
    />
  );
}
