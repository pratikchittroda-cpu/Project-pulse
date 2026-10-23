import { useEffect, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { PageLayout, StatusBadge, type TaskStatus } from "@projectpulse/ui";

import { supabase } from "../../app/auth-client.js";
import { useAuth } from "../../app/auth-context.js";
import { useOrganization } from "../../app/organization-context.js";
import { useProject } from "../../app/project-context.js";

interface DashboardTask {
  id: string;
  status: string;
  taskNumber: number;
  title: string;
}

interface DashboardEvent {
  eventType: string;
  occurredAt: string;
  taskId: string;
}

interface DashboardSnapshot {
  activeTaskCount: number;
  completedTaskCount: number;
  events: DashboardEvent[];
  inReviewTaskCount: number;
  tasks: DashboardTask[];
  totalTaskCount: number;
}

interface DashboardTaskRow {
  id: string;
  status: string;
  task_number: number;
  title: string;
}

interface DashboardEventRow {
  event_type: string;
  occurred_at: string;
  task_id: string;
}

function dashboardError(error: { message: string } | null) {
  return error
    ? new Error(error.message || "Could not load dashboard data.")
    : null;
}

async function loadDashboardSnapshot(
  organizationId: string,
  projectId: string,
): Promise<DashboardSnapshot> {
  const [taskResult, eventResult] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, task_number, status")
      .eq("organization_id", organizationId)
      .eq("project_id", projectId)
      .is("archived_at", null)
      .order("updated_at", { ascending: false })
      .returns<DashboardTaskRow[]>(),
    supabase
      .from("task_events")
      .select("task_id, event_type, occurred_at")
      .eq("organization_id", organizationId)
      .eq("project_id", projectId)
      .order("occurred_at", { ascending: false })
      .limit(5)
      .returns<DashboardEventRow[]>(),
  ]);

  const firstError =
    dashboardError(taskResult.error) ?? dashboardError(eventResult.error);
  if (firstError) {
    throw firstError;
  }

  const tasks = (taskResult.data ?? []).map((task) => ({
    id: task.id,
    status: task.status,
    taskNumber: task.task_number,
    title: task.title,
  }));
  const completedTaskCount = tasks.filter(
    ({ status }) => status === "completed",
  ).length;
  const inReviewTaskCount = tasks.filter(
    ({ status }) => status === "in_review",
  ).length;
  const activeTaskCount = tasks.filter(
    ({ status }) => status !== "completed" && status !== "canceled",
  ).length;

  return {
    activeTaskCount,
    completedTaskCount,
    events: (eventResult.data ?? []).map((event) => ({
      eventType: event.event_type,
      occurredAt: event.occurred_at,
      taskId: event.task_id,
    })),
    inReviewTaskCount,
    tasks,
    totalTaskCount: tasks.length,
  };
}

function formatEventType(eventType: string) {
  return eventType
    .split(/[._-]/u)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function formatRelativeTime(timestamp: string) {
  const timestampMs = Date.parse(timestamp);
  if (Number.isNaN(timestampMs)) {
    return "recently";
  }

  const elapsedSeconds = Math.max(
    0,
    Math.floor((Date.now() - timestampMs) / 1000),
  );
  if (elapsedSeconds < 60) return "just now";
  const minutes = Math.floor(elapsedSeconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function EmptyDashboard({ needsOrganization }: { needsOrganization: boolean }) {
  return (
    <PageLayout
      description={
        needsOrganization
          ? "Create an organization to give your account a real workspace."
          : "Create a project to start seeing live tasks, events, and delivery signals."
      }
      eyebrow="Workspace setup"
      title="Welcome to ProjectPulse"
    >
      <section className="activity-panel dashboard-empty-state">
        <p className="panel-kicker">Live workspace</p>
        <h3>
          {needsOrganization
            ? "Create your first organization."
            : "Create your first project."}
        </h3>
        <p className="muted">
          Once your workspace has data, this dashboard will show live metrics
          from your organization and project.
        </p>
        <Link
          className="button button-primary button-arrow"
          to={needsOrganization ? "/app/organization" : "/app/projects"}
        >
          {needsOrganization ? "Set up organization" : "Create project"}
          <span aria-hidden="true">↗</span>
        </Link>
      </section>
    </PageLayout>
  );
}

function LiveDashboard({
  project,
  snapshot,
}: {
  project: { key: string; name: string };
  snapshot: DashboardSnapshot;
}) {
  const completionPercentage = snapshot.totalTaskCount
    ? Math.round((snapshot.completedTaskCount / snapshot.totalTaskCount) * 100)
    : 0;
  const taskById = new Map(snapshot.tasks.map((task) => [task.id, task]));
  const metrics: Array<{
    detail: string;
    icon: string;
    label: string;
    status: TaskStatus;
    value: string;
  }> = [
    {
      detail:
        snapshot.activeTaskCount > 0 ? "Current open work" : "No active tasks",
      icon: "↗",
      label: "Active tasks",
      status: snapshot.activeTaskCount > 0 ? "in_progress" : "backlog",
      value: String(snapshot.activeTaskCount),
    },
    {
      detail:
        snapshot.inReviewTaskCount > 0
          ? "Awaiting review"
          : "No tasks in review",
      icon: "⌁",
      label: "In review",
      status: snapshot.inReviewTaskCount > 0 ? "in_review" : "backlog",
      value: String(snapshot.inReviewTaskCount),
    },
    {
      detail:
        snapshot.totalTaskCount > 0
          ? `${snapshot.completedTaskCount} of ${snapshot.totalTaskCount} tasks`
          : "No tasks yet",
      icon: "✓",
      label: "Completed tasks",
      status: snapshot.completedTaskCount > 0 ? "completed" : "backlog",
      value: String(snapshot.completedTaskCount),
    },
  ];

  return (
    <div className="dashboard-page">
      <section className="page-heading dashboard-heading">
        <div>
          <p className="eyebrow">{project.key} / overview</p>
          <h2>Workspace overview.</h2>
          <p>Live task and event data from {project.name}.</p>
        </div>
        <div className="dashboard-heading-actions">
          <span className="last-updated">
            <span className="status-dot" aria-hidden="true" /> Live data
          </span>
          <Link
            className="button button-primary button-arrow"
            to="/app/activity"
          >
            View activity <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </section>
      <section className="metric-grid" aria-label="Workspace metrics">
        {metrics.map(({ detail, icon, label, status, value }, index) => (
          <article
            className={`metric-card metric-card-${index + 1}`}
            key={label}
          >
            <div className="metric-card-label">
              <span>{label}</span>
              <span className="metric-card-icon" aria-hidden="true">
                {icon}
              </span>
            </div>
            <strong>{value}</strong>
            <small>
              <StatusBadge label={detail} status={status} />
            </small>
          </article>
        ))}
      </section>
      <section
        className="dashboard-signal-band"
        aria-labelledby="live-signal-title"
      >
        <div className="signal-band-copy">
          <p className="panel-kicker">Project signal</p>
          <h3 id="live-signal-title">
            {snapshot.totalTaskCount
              ? "Task completion signal."
              : "No delivery signal yet."}
          </h3>
          <p>
            {snapshot.totalTaskCount
              ? "Calculated from the current unarchived tasks in this project."
              : "Create tasks to start building a live delivery signal."}
          </p>
          <div className="signal-band-meta">
            <span className="signal-band-change">
              {snapshot.totalTaskCount
                ? `${completionPercentage}% complete`
                : "Awaiting data"}
            </span>
            <span>from project tasks</span>
          </div>
        </div>
        <div
          aria-label={
            snapshot.totalTaskCount
              ? `Task completion: ${completionPercentage} percent`
              : "Task completion: no data"
          }
          className={`signal-score-ring${
            snapshot.totalTaskCount ? "" : " signal-score-ring-empty"
          }`}
          style={
            {
              "--signal-progress": `${completionPercentage}%`,
            } as CSSProperties
          }
        >
          <div>
            <strong>
              {snapshot.totalTaskCount ? completionPercentage : "—"}
            </strong>
            {snapshot.totalTaskCount ? <span>/ 100</span> : null}
            <small>{snapshot.totalTaskCount ? "complete" : "no data"}</small>
          </div>
        </div>
        <div
          aria-label="Recent project task events"
          className="signal-band-chart signal-band-chart-empty"
        >
          <p>
            {snapshot.events.length > 0
              ? `${snapshot.events.length} recent task events loaded.`
              : "No task events yet."}
          </p>
          <span>New changes will appear as work moves.</span>
        </div>
      </section>
      <div className="dashboard-grid">
        <section
          className="activity-panel"
          aria-labelledby="recent-activity-title"
        >
          <div className="panel-heading-row">
            <div>
              <p className="panel-kicker">Signal stream</p>
              <h3 id="recent-activity-title">Recent workspace activity</h3>
            </div>
            <Link to="/app/activity">
              View all <span aria-hidden="true">↗</span>
            </Link>
          </div>
          <ul className="activity-list">
            {snapshot.events.length > 0 ? (
              snapshot.events.map((event, index) => {
                const task = taskById.get(event.taskId);
                const taskLabel = task
                  ? `${project.key}-${task.taskNumber} · ${task.title}`
                  : "a task";
                const eventLabel =
                  formatEventType(event.eventType) || "Workspace event";
                return (
                  <li key={`${event.taskId}:${event.occurredAt}:${index}`}>
                    <span
                      className={`activity-marker activity-marker-${(index % 3) + 1}`}
                      aria-hidden="true"
                    >
                      {index % 3 === 0 ? "↗" : index % 3 === 1 ? "⌁" : "✓"}
                    </span>
                    <p>
                      {eventLabel} · {taskLabel}
                    </p>
                    <small>{formatRelativeTime(event.occurredAt)}</small>
                  </li>
                );
              })
            ) : (
              <li className="activity-empty">
                <p>No task events yet.</p>
                <small>
                  Activity will appear after the first workspace change.
                </small>
              </li>
            )}
          </ul>
        </section>
        <aside className="focus-panel" aria-labelledby="focus-title">
          <div className="focus-panel-orb" aria-hidden="true">
            ✦
          </div>
          <p className="panel-kicker">Team focus</p>
          <h3 id="focus-title">
            {snapshot.totalTaskCount
              ? "Keep the next move obvious."
              : "Create the first task."}
          </h3>
          <p>
            {snapshot.totalTaskCount
              ? "Open the task workspace to review current work and update its state."
              : "Your live metrics will begin when this project has its first task."}
          </p>
          <Link
            className="button button-secondary button-arrow"
            to="/app/tasks"
          >
            Open tasks <span aria-hidden="true">↗</span>
          </Link>
        </aside>
      </div>
    </div>
  );
}

export function LiveDashboardPage() {
  const { session, status } = useAuth();
  const {
    error: organizationError,
    isLoading: loadingOrganizations,
    selectedOrganizationId,
  } = useOrganization();
  const {
    error: projectError,
    isLoading: loadingProjects,
    project,
  } = useProject();
  const [dashboardErrorMessage, setDashboardErrorMessage] = useState<
    string | null
  >(null);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const hasRealScope = Boolean(
    status === "authenticated" &&
      session &&
      selectedOrganizationId &&
      project.id,
  );

  useEffect(() => {
    let active = true;

    if (!hasRealScope) {
      setDashboardErrorMessage(null);
      setIsLoadingDashboard(false);
      setSnapshot(null);
      return () => {
        active = false;
      };
    }

    setDashboardErrorMessage(null);
    setIsLoadingDashboard(true);
    void loadDashboardSnapshot(selectedOrganizationId, project.id)
      .then((nextSnapshot) => {
        if (active) {
          setSnapshot(nextSnapshot);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setDashboardErrorMessage(
            error instanceof Error
              ? error.message
              : "Could not load dashboard data.",
          );
        }
      })
      .finally(() => {
        if (active) {
          setIsLoadingDashboard(false);
        }
      });

    return () => {
      active = false;
    };
  }, [hasRealScope, project.id, selectedOrganizationId, session, status]);

  if (status === "loading" || loadingOrganizations || loadingProjects) {
    return (
      <p className="muted" role="status">
        Loading workspace overview…
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

  if (!session || !selectedOrganizationId) {
    return <EmptyDashboard needsOrganization />;
  }

  if (!project.id) {
    return <EmptyDashboard needsOrganization={false} />;
  }

  if (dashboardErrorMessage) {
    return (
      <p className="auth-error" role="alert">
        {dashboardErrorMessage}
      </p>
    );
  }

  if (isLoadingDashboard || !snapshot) {
    return (
      <p className="muted" role="status">
        Loading live project data…
      </p>
    );
  }

  return <LiveDashboard project={project} snapshot={snapshot} />;
}
