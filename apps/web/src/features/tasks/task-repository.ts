import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_TASK_PRIORITIES,
  formatTaskKey,
  type TaskPriority,
} from "@projectpulse/domain";

import { supabase } from "../../app/auth-client.js";

export interface TaskScope {
  organizationId: string;
  projectId: string;
  projectKey: string;
  userId: string;
}

export interface TaskRecord {
  archivedAt: string | null;
  branchName?: string | null;
  cycleId: string | null;
  epicId: string | null;
  milestoneId: string | null;
  assigneeId: string | null;
  description: string | null;
  dueDate: string | null;
  estimate: number | null;
  id: string;
  key: string;
  labels: string[];
  number: string;
  priority: TaskPriority;
  pullRequestNumber?: number | string | null;
  pullRequestTitle?: string | null;
  pullRequestUrl?: string | null;
  status: string;
  teamId?: string | null;
  title: string;
  updatedAt: string;
}

export interface TaskDraft {
  assigneeId: string;
  description: string;
  dueDate: string;
  estimate: string;
  labels: string;
  priority: TaskPriority;
  status: string;
  title: string;
}

export interface TaskOptions {
  assignees: { id: string }[];
  canWrite: boolean;
  sprints?: { id: string; label: string; status: string }[];
  statuses: { isTerminal?: boolean; label: string; status: string }[];
  teams?: { id: string; label: string }[];
}

export type TaskFieldErrors = Partial<Record<keyof TaskDraft, string>>;

export interface TaskPlanningPatch {
  cycleId: string | null;
  estimate: number | null;
  epicId?: string | null;
  milestoneId?: string | null;
}

export class TaskValidationError extends Error {
  constructor(readonly fields: TaskFieldErrors) {
    super("Check the highlighted task fields.");
  }
}

interface TaskRow {
  archived_at: string | null;
  branch_name?: string | null;
  cycle_id: string | null;
  epic_id: string | null;
  milestone_id: string | null;
  assignee_id: string | null;
  description: string | null;
  due_date: string | null;
  estimate: number | null;
  id: string;
  labels: string[];
  number: string;
  priority: TaskPriority;
  pull_request_number?: number | string | null;
  pull_request_title?: string | null;
  pull_request_url?: string | null;
  status: string;
  team_id?: string | null;
  title: string;
  updated_at: string;
}

// Cast bigint on the server, before JSON decoding, so task identities never lose precision.
const taskColumns =
  "id, number:task_number::text, title, description, status, priority, assignee_id, labels, estimate, due_date, cycle_id, epic_id, milestone_id, team_id, archived_at, updated_at";

export const emptyTaskDraft: TaskDraft = {
  assigneeId: "",
  description: "",
  dueDate: "",
  estimate: "",
  labels: "",
  priority: "medium",
  status: "backlog",
  title: "",
};

export function taskToDraft(task: TaskRecord): TaskDraft {
  return {
    assigneeId: task.assigneeId ?? "",
    description: task.description ?? "",
    dueDate: task.dueDate ?? "",
    estimate: task.estimate === null ? "" : String(task.estimate),
    labels: task.labels.join(", "),
    priority: task.priority,
    status: task.status,
    title: task.title,
  };
}

export function taskPayload(draft: TaskDraft) {
  const fields: TaskFieldErrors = {};
  const title = draft.title.trim();
  const labels = [
    ...new Set(
      draft.labels
        .split(",")
        .map((label) => label.trim())
        .filter(Boolean),
    ),
  ];
  const estimate = draft.estimate.trim();
  if (!title || title.length > 240) {
    fields.title = "Use a title between 1 and 240 characters.";
  }
  if (!/^[a-z][a-z0-9_]{1,39}$/.test(draft.status)) {
    fields.status = "Choose a configured project status.";
  }
  if (!DEFAULT_TASK_PRIORITIES.includes(draft.priority)) {
    fields.priority = "Choose urgent, high, medium, or low.";
  }
  if (labels.length > 20 || labels.some((label) => label.length > 40)) {
    fields.labels = "Use at most 20 labels, each up to 40 characters.";
  }
  if (estimate && !/^\d{1,8}(\.\d{1,2})?$/.test(estimate)) {
    fields.estimate =
      "Use a non-negative estimate below 100,000,000 with up to two decimal places.";
  }
  if (
    draft.dueDate &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(draft.dueDate) ||
      draft.dueDate.startsWith("0000") ||
      !Number.isFinite(Date.parse(`${draft.dueDate}T00:00:00.000Z`)) ||
      new Date(`${draft.dueDate}T00:00:00.000Z`).toISOString().slice(0, 10) !==
        draft.dueDate)
  ) {
    fields.dueDate = "Choose a valid calendar date.";
  }
  if (Object.keys(fields).length) {
    throw new TaskValidationError(fields);
  }
  return {
    assignee_id: draft.assigneeId || null,
    description: draft.description.trim() || null,
    due_date: draft.dueDate || null,
    estimate: estimate ? Number(estimate) : null,
    labels,
    priority: draft.priority,
    status: draft.status,
    title,
  };
}

function toTask(row: TaskRow, projectKey: string): TaskRecord {
  return {
    archivedAt: row.archived_at,
    branchName: row.branch_name ?? null,
    cycleId: row.cycle_id,
    epicId: row.epic_id,
    milestoneId: row.milestone_id,
    assigneeId: row.assignee_id,
    description: row.description,
    dueDate: row.due_date,
    estimate: row.estimate,
    id: row.id,
    key: formatTaskKey(projectKey, row.number),
    labels: row.labels,
    number: row.number,
    priority: row.priority,
    pullRequestNumber: row.pull_request_number ?? null,
    pullRequestTitle: row.pull_request_title ?? null,
    pullRequestUrl: row.pull_request_url ?? null,
    status: row.status,
    teamId: row.team_id ?? null,
    title: row.title,
    updatedAt: row.updated_at,
  };
}

function databaseError(error: { code?: string; message: string }) {
  if (error.code === "42501") {
    return new Error(
      "You no longer have permission to change tasks in this project. Reload to check your access.",
    );
  }
  if (error.code === "PGRST116" || error.code === "40001") {
    return new Error(
      "This task changed or is no longer available. Reload tasks before trying again.",
    );
  }
  if (error.code === "55000") return new Error(error.message);
  if (error.code === "23503") {
    return new Error(
      "The selected status or project member is no longer available. Reload tasks and choose again.",
    );
  }
  if (
    error.code === "23514" ||
    error.code === "22007" ||
    error.code === "22008" ||
    error.code === "22003"
  ) {
    return new Error(
      "Check the task title, labels, assignee, estimate, and due date. " +
        error.message,
    );
  }
  return new Error(error.message || "Could not load or save tasks. Try again.");
}

export interface TaskRepository {
  get(scope: TaskScope, taskId: string): Promise<TaskRecord | null>;
  cycleName(scope: TaskScope, cycleId: string): Promise<string | null>;
  list(scope: TaskScope, includeArchived: boolean): Promise<TaskRecord[]>;
  options(scope: TaskScope): Promise<TaskOptions>;
  save(
    scope: TaskScope,
    draft: TaskDraft,
    previous?: TaskRecord,
  ): Promise<TaskRecord>;
  setArchived(
    scope: TaskScope,
    task: TaskRecord,
    archived: boolean,
  ): Promise<TaskRecord>;
  updatePlanning(
    scope: TaskScope,
    task: TaskRecord,
    patch: TaskPlanningPatch,
  ): Promise<TaskRecord>;
}

export function createTaskRepository(
  client: SupabaseClient = supabase,
): TaskRepository {
  // Retain IDs for failed/uncertain responses so an explicit retry of the same
  // operation uses the server's receipt. No automatic retry of a mutation.
  const pendingRequests = new Map<string, string>();
  async function mutate(
    scope: TaskScope,
    action: string,
    values: Record<string, unknown>,
    previous?: TaskRecord,
  ) {
    const key = JSON.stringify([
      scope.organizationId,
      scope.projectId,
      scope.userId,
      action,
      previous?.id,
      previous?.updatedAt,
      values,
    ]);
    const requestId = pendingRequests.get(key) ?? crypto.randomUUID();
    pendingRequests.set(key, requestId);
    const { data, error } = await client
      .rpc("mutate_task", {
        target_organization_id: scope.organizationId,
        target_project_id: scope.projectId,
        request_id: requestId,
        action,
        target_task_id: previous?.id ?? null,
        task_values: values,
        expected_updated_at: previous?.updatedAt ?? null,
      })
      .select(taskColumns)
      .single<TaskRow>();
    if (error) throw databaseError(error);
    pendingRequests.delete(key);
    return toTask(data, scope.projectKey);
  }
  return {
    async get(scope, taskId) {
      const { data, error } = await client
        .from("tasks")
        .select(taskColumns)
        .eq("organization_id", scope.organizationId)
        .eq("project_id", scope.projectId)
        .eq("id", taskId)
        .maybeSingle<TaskRow>();
      if (error) throw databaseError(error);
      return data ? toTask(data, scope.projectKey) : null;
    },
    async cycleName(scope, cycleId) {
      const { data, error } = await client
        .from("cycles")
        .select("name")
        .eq("organization_id", scope.organizationId)
        .eq("project_id", scope.projectId)
        .eq("id", cycleId)
        .maybeSingle<{ name: string }>();
      if (error) throw databaseError(error);
      return data?.name ?? null;
    },
    async list(scope, includeArchived) {
      const tasks = new Map<string, TaskRecord>();
      const pageSize = 200;
      for (let offset = 0; ; offset += pageSize) {
        let query = client
          .from("tasks")
          .select(taskColumns)
          .eq("organization_id", scope.organizationId)
          .eq("project_id", scope.projectId)
          .order("task_number", { ascending: false })
          .range(offset, offset + pageSize - 1);
        if (!includeArchived) query = query.is("archived_at", null);
        const { data, error } = await query.returns<TaskRow[]>();
        if (error) throw databaseError(error);
        for (const row of data ?? [])
          tasks.set(row.id, toTask(row, scope.projectKey));
        if (!data || data.length < pageSize) return [...tasks.values()];
      }
    },
    async options(scope) {
      const [
        workflow,
        organizationMembers,
        projectMembers,
        permission,
        teams,
        sprints,
      ] = await Promise.all([
        client
          .from("project_workflow_statuses")
          .select("label, status, is_terminal")
          .eq("organization_id", scope.organizationId)
          .eq("project_id", scope.projectId)
          .order("position")
          .order("status")
          .returns<{ is_terminal: boolean; label: string; status: string }[]>(),
        client
          .from("organization_memberships")
          .select("user_id, role")
          .eq("organization_id", scope.organizationId)
          .returns<{ user_id: string; role: string }[]>(),
        client
          .from("project_memberships")
          .select("user_id")
          .eq("organization_id", scope.organizationId)
          .eq("project_id", scope.projectId)
          .returns<{ user_id: string }[]>(),
        client.rpc("can_write_project", {
          target_organization_id: scope.organizationId,
          target_project_id: scope.projectId,
        }),
        client
          .from("teams")
          .select("id, name, team_key")
          .eq("organization_id", scope.organizationId)
          .order("name")
          .returns<{ id: string; name: string; team_key: string }[]>(),
        client
          .from("cycles")
          .select("id, name, status")
          .eq("organization_id", scope.organizationId)
          .eq("project_id", scope.projectId)
          .order("created_at", { ascending: false })
          .returns<{ id: string; name: string; status: string }[]>(),
      ]);
      const error =
        workflow.error ??
        organizationMembers.error ??
        projectMembers.error ??
        permission.error ??
        teams.error ??
        sprints.error;
      if (error) throw databaseError(error);
      const projectUserIds = new Set(
        (projectMembers.data ?? []).map(({ user_id }) => user_id),
      );
      return {
        assignees: (organizationMembers.data ?? [])
          .filter(
            ({ user_id, role }) =>
              role === "owner" ||
              role === "admin" ||
              projectUserIds.has(user_id),
          )
          .map(({ user_id }) => ({ id: user_id })),
        canWrite: permission.data === true,
        sprints: (sprints.data ?? []).map(({ id, name, status }) => ({
          id,
          label: name,
          status,
        })),
        statuses: (workflow.data ?? []).map(
          ({ is_terminal, label, status }) => ({
            isTerminal: is_terminal,
            label,
            status,
          }),
        ),
        teams: (teams.data ?? []).map(({ id, name, team_key }) => ({
          id,
          label: `${team_key} · ${name}`,
        })),
      };
    },
    async save(scope, draft, previous) {
      return mutate(
        scope,
        previous ? "update" : "create",
        taskPayload(draft),
        previous,
      );
    },
    async setArchived(scope, task, archived) {
      return mutate(scope, archived ? "archive" : "restore", {}, task);
    },
    async updatePlanning(scope, task, patch) {
      if (
        patch.estimate !== null &&
        (!Number.isFinite(patch.estimate) ||
          patch.estimate < 0 ||
          patch.estimate >= 100000000 ||
          Number(patch.estimate.toFixed(2)) !== patch.estimate)
      ) {
        throw new TaskValidationError({
          estimate:
            "Use a non-negative estimate below 100,000,000 with at most two decimal places.",
        });
      }
      return mutate(
        scope,
        "update",
        {
          cycle_id: patch.cycleId,
          estimate: patch.estimate,
          ...(Object.prototype.hasOwnProperty.call(patch, "epicId")
            ? { epic_id: patch.epicId }
            : {}),
          ...(Object.prototype.hasOwnProperty.call(patch, "milestoneId")
            ? { milestone_id: patch.milestoneId }
            : {}),
        },
        task,
      );
    },
  };
}

export const taskRepository = createTaskRepository();
