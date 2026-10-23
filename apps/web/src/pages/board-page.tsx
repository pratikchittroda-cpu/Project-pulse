import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { PageLayout } from "@projectpulse/ui";

import { useAuth } from "../app/auth-context.js";
import { useOrganization } from "../app/organization-context.js";
import { useProject } from "../app/project-context.js";
import { KanbanBoard } from "../features/board/kanban-board.js";
import { DeveloperPresencePanel } from "../features/presence/active-developers.js";
import { createDeveloperPresence } from "../features/presence/developer-presence.js";
import "../features/board/kanban-board.css";
import "../features/presence/presence.css";

function BoardPresence({
  scope,
}: {
  scope: {
    organizationId: string;
    projectId: string;
    userId: string;
  };
}) {
  const presence = useMemo(
    () =>
      createDeveloperPresence(scope, {
        // Supabase Realtime RLS remains the authoritative access check. This
        // local guard only lets the mounted board attempt the private join.
        authorize: () => true,
      }),
    [scope.organizationId, scope.projectId, scope.userId],
  );

  useEffect(() => {
    void presence.join({ activity: "testing" }).catch(() => undefined);

    return () => {
      // Leave rather than permanently disposing so React StrictMode can
      // remount the effect during local development.
      void presence.leave();
    };
  }, [presence]);

  return <DeveloperPresencePanel presence={presence} />;
}

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

  if (!selectedOrganizationId || !project.id || !session) {
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
    <div className="board-realtime-workspace">
      <KanbanBoard
        archivedProject={Boolean(project.archivedAt)}
        key={`${scope.organizationId}:${scope.projectId}:${scope.userId}`}
        scope={scope}
      />
      <BoardPresence
        scope={{
          organizationId: scope.organizationId,
          projectId: scope.projectId,
          userId: scope.userId,
        }}
      />
    </div>
  );
}
