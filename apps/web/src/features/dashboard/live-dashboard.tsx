import { useEffect, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  FolderKanban,
  GitPullRequest,
  LayoutList,
  MessageCircle,
  RefreshCw,
  Rocket,
  Sparkles,
  Target,
  Timer,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { PageLayout, StatusBadge, type TaskStatus } from "@projectpulse/ui";

import { supabase } from "../../app/auth-client.js";
import { useAuth } from "../../app/auth-context.js";
import { useOrganization } from "../../app/organization-context.js";
import { useProject } from "../../app/project-context.js";
import {
  readDashboardSnapshot,
  writeDashboardSnapshot,
} from "../../app/workspace-cache.js";

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

interface DashboardSnapshotRow {
  active_task_count: number;
  completed_task_count: number;
  events: DashboardEventRow[];
  in_review_task_count: number;
  tasks: DashboardTaskRow[];
  total_task_count: number;
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
  const { data, error } = await supabase.rpc("get_project_dashboard_snapshot", {
    target_organization_id: organizationId,
    target_project_id: projectId,
  });
  const firstError = dashboardError(error);
  if (firstError) {
    throw firstError;
  }

  const row = (
    Array.isArray(data) ? data[0] : data
  ) as DashboardSnapshotRow | null;
  if (!row) {
    throw new Error("Could not load dashboard data.");
  }

  const tasks = (row.tasks ?? []).map((task) => ({
    id: task.id,
    status: task.status,
    taskNumber: task.task_number,
    title: task.title,
  }));

  return {
    activeTaskCount: Number(row.active_task_count),
    completedTaskCount: Number(row.completed_task_count),
    events: (row.events ?? []).map((event) => ({
      eventType: event.event_type,
      occurredAt: event.occurred_at,
      taskId: event.task_id,
    })),
    inReviewTaskCount: Number(row.in_review_task_count),
    tasks,
    totalTaskCount: Number(row.total_task_count),
  };
}

function formatEventType(eventType: string) {
  return eventType
    .split(/[._-]/u)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function eventIcon(eventType: string): LucideIcon {
  const normalized = eventType.toLowerCase();
  if (normalized.includes("review") || normalized.includes("pull")) {
    return GitPullRequest;
  }
  if (normalized.includes("comment") || normalized.includes("mention")) {
    return MessageCircle;
  }
  if (normalized.includes("status") || normalized.includes("move")) {
    return Activity;
  }
  return Zap;
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

function DashboardLoadingState() {
  return (
    <div
      aria-live="polite"
      className="dashboard-page dashboard-page-v2 dashboard-loading"
      role="status"
    >
      <div className="dashboard-loading-head">
        <div className="dashboard-skeleton dashboard-skeleton-kicker" />
        <div className="dashboard-skeleton dashboard-skeleton-title" />
        <div className="dashboard-skeleton dashboard-skeleton-copy" />
      </div>
      <div className="dashboard-loading-metrics">
        {["one", "two", "three", "four"].map((item) => (
          <div className="dashboard-skeleton-card" key={item}>
            <div className="dashboard-skeleton dashboard-skeleton-icon" />
            <div className="dashboard-skeleton dashboard-skeleton-number" />
            <div className="dashboard-skeleton dashboard-skeleton-line" />
          </div>
        ))}
      </div>
      <div className="dashboard-loading-main">
        <div className="dashboard-skeleton-card dashboard-skeleton-panel" />
        <div className="dashboard-skeleton-card dashboard-skeleton-panel" />
      </div>
    </div>
  );
}

function LiveDashboard({
  isRefreshing,
  onRefresh,
  project,
  snapshot,
}: {
  isRefreshing: boolean;
  onRefresh: () => void;
  project: { key: string; name: string };
  snapshot: DashboardSnapshot;
}) {
  const completionPercentage = snapshot.totalTaskCount
    ? Math.round((snapshot.completedTaskCount / snapshot.totalTaskCount) * 100)
    : 0;
  const taskById = new Map(snapshot.tasks.map((task) => [task.id, task]));
  const metrics: Array<{
    detail: string;
    icon: LucideIcon;
    label: string;
    status: TaskStatus;
    value: string;
    tone: string;
  }> = [
    {
      detail:
        snapshot.activeTaskCount > 0 ? "Current open work" : "No active tasks",
      icon: LayoutList,
      label: "Open work",
      status: snapshot.activeTaskCount > 0 ? "in_progress" : "backlog",
      value: String(snapshot.activeTaskCount),
      tone: "violet",
    },
    {
      detail:
        snapshot.inReviewTaskCount > 0
          ? "Awaiting review"
          : "No tasks in review",
      icon: GitPullRequest,
      label: "In review",
      status: snapshot.inReviewTaskCount > 0 ? "in_review" : "backlog",
      value: String(snapshot.inReviewTaskCount),
      tone: "coral",
    },
    {
      detail:
        snapshot.totalTaskCount > 0
          ? `${snapshot.completedTaskCount} of ${snapshot.totalTaskCount} tasks`
          : "No tasks yet",
      icon: CheckCircle2,
      label: "Completed",
      status: snapshot.completedTaskCount > 0 ? "completed" : "backlog",
      value: String(snapshot.completedTaskCount),
      tone: "mint",
    },
    {
      detail:
        snapshot.totalTaskCount > 0 ? "Across this project" : "Awaiting tasks",
      icon: Target,
      label: "Completion",
      status: snapshot.completedTaskCount > 0 ? "completed" : "backlog",
      value: `${completionPercentage}%`,
      tone: "gold",
    },
  ];
  const progressRows = [
    {
      count: snapshot.activeTaskCount,
      icon: LayoutList,
      label: "Open work",
      tone: "violet",
      value: snapshot.totalTaskCount
        ? Math.round((snapshot.activeTaskCount / snapshot.totalTaskCount) * 100)
        : 0,
    },
    {
      count: snapshot.inReviewTaskCount,
      icon: GitPullRequest,
      label: "In review",
      tone: "coral",
      value: snapshot.totalTaskCount
        ? Math.round(
            (snapshot.inReviewTaskCount / snapshot.totalTaskCount) * 100,
          )
        : 0,
    },
    {
      count: snapshot.completedTaskCount,
      icon: CheckCircle2,
      label: "Completed",
      tone: "mint",
      value: completionPercentage,
    },
  ];

  return (
    <div className="dashboard-page dashboard-page-v2">
      <section className="dashboard-hero-v2">
        <div className="dashboard-hero-copy">
          <div className="dashboard-hero-meta">
            <span className="dashboard-live-pill">
              <span className="dashboard-live-dot" aria-hidden="true" />
              Live project
            </span>
            <span className="dashboard-project-code">{project.key}</span>
          </div>
          <h2>Make the next move obvious.</h2>
          <p>
            A focused view of delivery health, review flow, and the work that
            needs attention in {project.name}.
          </p>
        </div>
        <div className="dashboard-hero-actions">
          <button
            className="dashboard-refresh-button"
            disabled={isRefreshing}
            onClick={onRefresh}
            type="button"
          >
            <RefreshCw
              aria-hidden="true"
              className={isRefreshing ? "dashboard-spin" : undefined}
              size={16}
              strokeWidth={2}
            />
            {isRefreshing ? "Refreshing" : "Refresh"}
          </button>
          <Link className="dashboard-primary-action" to="/app/tasks">
            <LayoutList aria-hidden="true" size={16} strokeWidth={2} />
            Open tasks
            <ArrowUpRight aria-hidden="true" size={15} strokeWidth={2} />
          </Link>
        </div>
      </section>
      <section
        className="dashboard-metric-grid-v2"
        aria-label="Workspace metrics"
      >
        {metrics.map(({ detail, icon: Icon, label, status, tone, value }) => (
          <article
            className={`dashboard-metric-card dashboard-metric-card-${tone}`}
            key={label}
          >
            <div className="dashboard-metric-top">
              <span className="dashboard-metric-icon" aria-hidden="true">
                <Icon size={17} strokeWidth={2} />
              </span>
              <span className="dashboard-metric-detail">{detail}</span>
            </div>
            <strong className="dashboard-metric-value">{value}</strong>
            <div className="dashboard-metric-label-row">
              <span>{label}</span>
              <StatusBadge
                label={status === "completed" ? "On track" : "Active"}
                status={status}
              />
            </div>
          </article>
        ))}
      </section>
      <div className="dashboard-main-grid-v2">
        <section className="dashboard-pulse-card" aria-labelledby="pulse-title">
          <div className="dashboard-section-heading">
            <div>
              <span className="dashboard-section-label">Delivery pulse</span>
              <h3 id="pulse-title">Project health at a glance</h3>
            </div>
            <span className="dashboard-section-status">
              <Activity aria-hidden="true" size={14} strokeWidth={2} />
              {snapshot.events.length > 0
                ? "Signals flowing"
                : "Awaiting signals"}
            </span>
          </div>
          <div className="dashboard-pulse-body">
            <div
              aria-label={
                snapshot.totalTaskCount
                  ? `Task completion: ${completionPercentage} percent`
                  : "Task completion: no data"
              }
              className={`dashboard-progress-ring${
                snapshot.totalTaskCount ? "" : " dashboard-progress-ring-empty"
              }`}
              style={
                {
                  "--dashboard-progress": `${completionPercentage}%`,
                } as CSSProperties
              }
            >
              <div>
                <strong>
                  {snapshot.totalTaskCount ? `${completionPercentage}%` : "—"}
                </strong>
                <span>complete</span>
              </div>
            </div>
            <div className="dashboard-progress-list">
              {progressRows.map(({ count, icon: Icon, label, tone, value }) => (
                <div className="dashboard-progress-row" key={label}>
                  <div className="dashboard-progress-row-top">
                    <span
                      className={`dashboard-progress-icon dashboard-progress-icon-${tone}`}
                    >
                      <Icon aria-hidden="true" size={15} strokeWidth={2} />
                    </span>
                    <span>{label}</span>
                    <strong>{count}</strong>
                  </div>
                  <div className="dashboard-progress-track">
                    <span
                      className={`dashboard-progress-fill dashboard-progress-fill-${tone}`}
                      style={{ width: `${value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="dashboard-pulse-footer">
            <span>
              <Timer aria-hidden="true" size={14} strokeWidth={2} />
              {snapshot.totalTaskCount
                ? `${snapshot.totalTaskCount} tracked tasks`
                : "No tasks tracked yet"}
            </span>
            <Link to="/app/board">
              Open board{" "}
              <ArrowUpRight aria-hidden="true" size={14} strokeWidth={2} />
            </Link>
          </div>
        </section>
        <aside className="dashboard-focus-card" aria-labelledby="focus-title">
          <div className="dashboard-focus-icon" aria-hidden="true">
            <Sparkles size={18} strokeWidth={2} />
          </div>
          <span className="dashboard-section-label">Recommended next move</span>
          <h3 id="focus-title">
            {snapshot.totalTaskCount
              ? "Keep review moving."
              : "Create the first task."}
          </h3>
          <p>
            {snapshot.totalTaskCount
              ? "Open the task workspace to clarify ownership and move the next item forward."
              : "Start with one clear task and your live delivery signal will begin to take shape."}
          </p>
          <div className="dashboard-focus-actions">
            <Link className="dashboard-focus-primary" to="/app/tasks">
              <Rocket aria-hidden="true" size={16} strokeWidth={2} />
              Open tasks
            </Link>
            <Link className="dashboard-focus-secondary" to="/app/projects">
              <FolderKanban aria-hidden="true" size={16} strokeWidth={2} />
              Project setup
            </Link>
          </div>
        </aside>
      </div>
      <div className="dashboard-lower-grid-v2">
        <section
          className="dashboard-activity-card"
          aria-labelledby="recent-activity-title"
        >
          <div className="dashboard-section-heading">
            <div>
              <span className="dashboard-section-label">Signal stream</span>
              <h3 id="recent-activity-title">Recent activity</h3>
            </div>
            <Link className="dashboard-text-link" to="/app/activity">
              View all{" "}
              <ArrowUpRight aria-hidden="true" size={14} strokeWidth={2} />
            </Link>
          </div>
          <ul className="dashboard-activity-list">
            {snapshot.events.length > 0 ? (
              snapshot.events.map((event, index) => {
                const task = taskById.get(event.taskId);
                const taskLabel = task
                  ? `${project.key}-${task.taskNumber} · ${task.title}`
                  : "a task";
                const eventLabel =
                  formatEventType(event.eventType) || "Workspace event";
                const Icon = eventIcon(event.eventType);
                return (
                  <li
                    className="dashboard-activity-item"
                    key={`${event.taskId}:${event.occurredAt}:${index}`}
                  >
                    <span
                      className={`dashboard-activity-icon dashboard-activity-icon-${(index % 3) + 1}`}
                    >
                      <Icon aria-hidden="true" size={16} strokeWidth={2} />
                    </span>
                    <span className="dashboard-activity-copy">
                      <strong>{eventLabel}</strong>
                      <span>{taskLabel}</span>
                    </span>
                    <time dateTime={event.occurredAt}>
                      {formatRelativeTime(event.occurredAt)}
                    </time>
                  </li>
                );
              })
            ) : (
              <li className="dashboard-activity-empty">
                <span className="dashboard-empty-icon" aria-hidden="true">
                  <Clock size={18} strokeWidth={2} />
                </span>
                <span>
                  <strong>No task events yet.</strong>
                  <small>
                    Activity will appear after the first workspace change.
                  </small>
                </span>
              </li>
            )}
          </ul>
        </section>
        <section
          className="dashboard-snapshot-card"
          aria-labelledby="snapshot-title"
        >
          <div className="dashboard-section-heading">
            <div>
              <span className="dashboard-section-label">
                Workspace snapshot
              </span>
              <h3 id="snapshot-title">At a glance</h3>
            </div>
            <span className="dashboard-snapshot-mark" aria-hidden="true">
              <Zap size={16} strokeWidth={2} />
            </span>
          </div>
          <div className="dashboard-snapshot-list">
            <div>
              <span>
                <LayoutList aria-hidden="true" size={15} strokeWidth={2} />
                Tracked tasks
              </span>
              <strong>{snapshot.totalTaskCount}</strong>
            </div>
            <div>
              <span>
                <Activity aria-hidden="true" size={15} strokeWidth={2} />
                Recent signals
              </span>
              <strong>{snapshot.events.length}</strong>
            </div>
            <div>
              <span>
                <Target aria-hidden="true" size={15} strokeWidth={2} />
                Project focus
              </span>
              <strong>{project.key}</strong>
            </div>
          </div>
          <div className="dashboard-snapshot-note">
            <span className="dashboard-live-dot" aria-hidden="true" />
            Data refreshes automatically as work changes.
          </div>
        </section>
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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshSequence, setRefreshSequence] = useState(0);
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const hasRealScope = Boolean(
    status === "authenticated" &&
      session &&
      selectedOrganizationId &&
      project.id,
  );

  useEffect(() => {
    let active = true;

    if (!hasRealScope || !session || !selectedOrganizationId || !project.id) {
      setDashboardErrorMessage(null);
      setIsRefreshing(false);
      setSnapshot(null);
      return () => {
        active = false;
      };
    }

    const cachedSnapshot = readDashboardSnapshot(
      session.user.id,
      selectedOrganizationId,
      project.id,
    );
    setSnapshot(cachedSnapshot);
    setDashboardErrorMessage(null);
    setIsRefreshing(true);
    void loadDashboardSnapshot(selectedOrganizationId, project.id)
      .then((nextSnapshot) => {
        if (active) {
          setSnapshot(nextSnapshot);
          writeDashboardSnapshot(
            session.user.id,
            selectedOrganizationId,
            project.id,
            nextSnapshot,
          );
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
          setIsRefreshing(false);
        }
      });

    return () => {
      active = false;
    };
  }, [
    hasRealScope,
    project.id,
    refreshSequence,
    selectedOrganizationId,
    session,
    status,
  ]);

  if (status === "loading" || loadingOrganizations || loadingProjects) {
    return <DashboardLoadingState />;
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

  if (dashboardErrorMessage && !snapshot) {
    return (
      <p className="auth-error" role="alert">
        {dashboardErrorMessage}
      </p>
    );
  }

  if (!snapshot) {
    return <DashboardLoadingState />;
  }

  return (
    <LiveDashboard
      isRefreshing={isRefreshing}
      onRefresh={() => setRefreshSequence((current) => current + 1)}
      project={project}
      snapshot={snapshot}
    />
  );
}
