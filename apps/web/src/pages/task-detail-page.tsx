import { Link, useParams } from "react-router-dom";
import { PageLayout } from "@projectpulse/ui";
import { useAuth } from "../app/auth-context.js";
import { TaskDetailWorkspace } from "../features/tasks/task-detail-workspace.js";
import "../features/tasks/task-detail.css";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function TaskDetailPage() {
  const { organizationId = "", projectId = "", taskId = "" } = useParams();
  const { session, status } = useAuth();
  if (status === "loading") return <p role="status">Loading task…</p>;
  if (!session)
    return (
      <PageLayout
        title="Sign in to view task history"
        description="Task details use your authenticated project access."
      >
        <Link to="/auth/login">Sign in</Link>
      </PageLayout>
    );
  if (![organizationId, projectId, taskId].every((value) => uuid.test(value)))
    return (
      <PageLayout title="Invalid task link">
        <Link to="/app/tasks">Back to tasks</Link>
      </PageLayout>
    );
  return (
    <TaskDetailWorkspace
      key={`${organizationId}:${projectId}:${taskId}:${session.user.id}`}
      address={{ organizationId, projectId, taskId, userId: session.user.id }}
    />
  );
}
