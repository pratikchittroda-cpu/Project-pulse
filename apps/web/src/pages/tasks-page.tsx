import { useMemo } from "react";
import { Link } from "react-router-dom";
import { PageLayout } from "@releasearc/ui";

import { useAuth } from "../app/auth-context.js";
import { useOrganization } from "../app/organization-context.js";
import { useProject } from "../app/project-context.js";
import { TasksWorkspace } from "../features/tasks/tasks-workspace.js";

export function TasksPage() {
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
        Loading project tasks…
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

  if (!selectedOrganizationId || !project.id || !session) {
    return (
      <PageLayout
        title="Tasks"
        description="Select an organization and project to manage tasks."
      >
        <Link className="button button-primary" to="/app/projects">
          Open projects
        </Link>
      </PageLayout>
    );
  }

  return (
    <TasksWorkspace
      archivedProject={Boolean(project.archivedAt)}
      key={`${scope.organizationId}:${scope.projectId}:${scope.userId}`}
      scope={scope}
    />
  );
}
