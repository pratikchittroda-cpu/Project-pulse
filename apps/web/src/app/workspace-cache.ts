export interface CachedOrganization {
  id: string;
  name: string;
  role: "admin" | "member" | "owner" | "viewer";
  slug: string;
}

export interface CachedProject {
  archivedAt?: string | null;
  description?: string | null;
  id: string;
  key: string;
  name: string;
  teamId?: string | null;
}

export interface CachedDashboardSnapshot {
  activeTaskCount: number;
  completedTaskCount: number;
  events: Array<{
    eventType: string;
    occurredAt: string;
    taskId: string;
  }>;
  inReviewTaskCount: number;
  risks: Array<{
    id: string;
    nextMove: string;
    reason: string;
    severity: "high" | "medium";
    taskId: string;
    taskNumber: number;
    title: string;
  }>;
  tasks: Array<{
    id: string;
    status: string;
    taskNumber: number;
    title: string;
  }>;
  totalTaskCount: number;
}

// Keep the original storage namespace so existing browser workspaces survive
// the public rebrand without losing their selected organization or project.
const SELECTED_ORGANIZATION_KEY = "projectpulse.selected-organization";
const SELECTED_PROJECT_KEY = "projectpulse.selected-project";
const ORGANIZATIONS_KEY_PREFIX = "projectpulse.organizations.";
const PROJECTS_KEY_PREFIX = "projectpulse.projects.";
const DASHBOARD_KEY_PREFIX = "projectpulse.dashboard.";

function readJson(key: string): unknown {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return JSON.parse(window.localStorage.getItem(key) ?? "null") as unknown;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // A cache miss only affects perceived loading speed.
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function readStoredWorkspaceSelection() {
  if (typeof window === "undefined") {
    return { organizationId: "", projectId: "" };
  }

  return {
    organizationId:
      window.localStorage.getItem(SELECTED_ORGANIZATION_KEY) ?? "",
    projectId: window.localStorage.getItem(SELECTED_PROJECT_KEY) ?? "",
  };
}

export function readOrganizations(userId: string): CachedOrganization[] {
  const value = readJson(`${ORGANIZATIONS_KEY_PREFIX}${userId}`);
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (organization): organization is CachedOrganization =>
      isRecord(organization) &&
      typeof organization.id === "string" &&
      typeof organization.name === "string" &&
      typeof organization.slug === "string" &&
      ["admin", "member", "owner", "viewer"].includes(
        organization.role as string,
      ),
  );
}

export function writeOrganizations(
  userId: string,
  organizations: CachedOrganization[],
) {
  writeJson(`${ORGANIZATIONS_KEY_PREFIX}${userId}`, organizations);
}

function projectsCacheKey(userId: string, organizationId: string) {
  return `${PROJECTS_KEY_PREFIX}${userId}.${organizationId}`;
}

export function readProjects(
  userId: string,
  organizationId: string,
): CachedProject[] {
  const value = readJson(projectsCacheKey(userId, organizationId));
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (project): project is CachedProject =>
      isRecord(project) &&
      typeof project.id === "string" &&
      typeof project.key === "string" &&
      typeof project.name === "string",
  );
}

export function writeProjects(
  userId: string,
  organizationId: string,
  projects: CachedProject[],
) {
  writeJson(projectsCacheKey(userId, organizationId), projects);
}

function dashboardCacheKey(
  userId: string,
  organizationId: string,
  projectId: string,
) {
  return `${DASHBOARD_KEY_PREFIX}${userId}.${organizationId}.${projectId}`;
}

export function readDashboardSnapshot(
  userId: string,
  organizationId: string,
  projectId: string,
): CachedDashboardSnapshot | null {
  const value = readJson(dashboardCacheKey(userId, organizationId, projectId));
  if (!isRecord(value)) {
    return null;
  }

  const events = Array.isArray(value.events) ? value.events : [];
  const tasks = Array.isArray(value.tasks) ? value.tasks : [];
  const normalizedEvents = events.flatMap((event) => {
    if (!isRecord(event)) {
      return [];
    }
    const eventType = event.eventType ?? event.event_type;
    const occurredAt = event.occurredAt ?? event.occurred_at;
    const taskId = event.taskId ?? event.task_id;
    return typeof eventType === "string" &&
      typeof occurredAt === "string" &&
      typeof taskId === "string"
      ? [{ eventType, occurredAt, taskId }]
      : [];
  });
  const normalizedTasks = tasks.flatMap((task) => {
    if (!isRecord(task)) {
      return [];
    }
    const id = task.id;
    const status = task.status;
    const taskNumber = task.taskNumber ?? task.task_number;
    const title = task.title;
    return typeof id === "string" &&
      typeof status === "string" &&
      typeof taskNumber === "number" &&
      typeof title === "string"
      ? [{ id, status, taskNumber, title }]
      : [];
  });
  const risks = Array.isArray(value.risks) ? value.risks : [];
  const normalizedRisks = risks.flatMap(
    (risk): CachedDashboardSnapshot["risks"] => {
      if (!isRecord(risk)) return [];
      const id = risk.id;
      const nextMove = risk.nextMove ?? risk.next_move;
      const reason = risk.reason;
      const severity = risk.severity;
      const taskId = risk.taskId ?? risk.task_id;
      const taskNumber = risk.taskNumber ?? risk.task_number;
      const title = risk.title;
      return typeof id === "string" &&
        typeof nextMove === "string" &&
        typeof reason === "string" &&
        (severity === "high" || severity === "medium") &&
        typeof taskId === "string" &&
        typeof taskNumber === "number" &&
        typeof title === "string"
        ? [{ id, nextMove, reason, severity, taskId, taskNumber, title }]
        : [];
    },
  );
  const activeTaskCount = value.activeTaskCount ?? value.active_task_count;
  const completedTaskCount =
    value.completedTaskCount ?? value.completed_task_count;
  const inReviewTaskCount =
    value.inReviewTaskCount ?? value.in_review_task_count;
  const totalTaskCount = value.totalTaskCount ?? value.total_task_count;

  return typeof activeTaskCount === "number" &&
    typeof completedTaskCount === "number" &&
    typeof inReviewTaskCount === "number" &&
    typeof totalTaskCount === "number"
    ? {
        activeTaskCount,
        completedTaskCount,
        events: normalizedEvents,
        inReviewTaskCount,
        risks: normalizedRisks,
        tasks: normalizedTasks,
        totalTaskCount,
      }
    : null;
}

export function writeDashboardSnapshot(
  userId: string,
  organizationId: string,
  projectId: string,
  snapshot: unknown,
) {
  writeJson(dashboardCacheKey(userId, organizationId, projectId), snapshot);
}

export function storeSelectedOrganization(organizationId: string) {
  if (typeof window === "undefined") {
    return;
  }
  if (organizationId) {
    window.localStorage.setItem(SELECTED_ORGANIZATION_KEY, organizationId);
  } else {
    window.localStorage.removeItem(SELECTED_ORGANIZATION_KEY);
  }
}

export function storeSelectedProject(projectId: string) {
  if (typeof window === "undefined") {
    return;
  }
  if (projectId) {
    window.localStorage.setItem(SELECTED_PROJECT_KEY, projectId);
  } else {
    window.localStorage.removeItem(SELECTED_PROJECT_KEY);
  }
}
