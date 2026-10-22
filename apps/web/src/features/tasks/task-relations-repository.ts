import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase } from "../../app/auth-client.js";
import {
  createTaskRepository,
  type TaskRecord,
  type TaskRepository,
  type TaskScope,
} from "./task-repository.js";

export interface TaskRelationRecord {
  id: string;
  organizationId: string;
  projectId: string;
  blockerTaskId: string;
  blockedTaskId: string;
  explanation: string | null;
  targetDate: string | null;
  createdAt: string;
  blockerTask: TaskRecord | null;
  blockedTask: TaskRecord | null;
}

export interface TaskDependencyState {
  blockers: TaskRelationRecord[];
  blocking: TaskRelationRecord[];
  availableTasks: TaskRecord[];
}

export interface TaskDependencySummary {
  blockerCount: number;
  blockingCount: number;
  hasCriticalBlocker: boolean;
}

export interface TaskDependencyDraft {
  blockerTaskId: string;
  blockedTaskId: string;
  explanation: string;
  targetDate: string;
}

export interface TaskRelationRepository {
  list(scope: TaskScope, taskId: string): Promise<TaskDependencyState>;
  summary(scope: TaskScope): Promise<Record<string, TaskDependencySummary>>;
  create(
    scope: TaskScope,
    draft: TaskDependencyDraft,
  ): Promise<TaskRelationRecord>;
  remove(
    scope: TaskScope,
    relation: TaskRelationRecord,
  ): Promise<TaskRelationRecord>;
}

interface TaskRelationRow {
  id: string;
  organization_id: string;
  project_id: string;
  task_id: string;
  related_task_id: string;
  relation_type: "blocks";
  blocker_explanation: string | null;
  blocker_target_date: string | null;
  created_at: string;
}

const relationColumns =
  "id, organization_id, project_id, task_id, related_task_id, relation_type, blocker_explanation, blocker_target_date, created_at";

function validDate(value: string) {
  if (!value) return null;
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    value.startsWith("0000") ||
    !Number.isFinite(Date.parse(`${value}T00:00:00.000Z`)) ||
    new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) !== value
  ) {
    throw new Error("Choose a valid blocker target date.");
  }
  return value;
}

export function validateTaskDependencyDraft(draft: TaskDependencyDraft) {
  const explanation = draft.explanation.trim();
  if (!draft.blockerTaskId || !draft.blockedTaskId)
    throw new Error("Choose both tasks for the dependency.");
  if (draft.blockerTaskId === draft.blockedTaskId)
    throw new Error("A task cannot depend on itself.");
  if (!explanation || explanation.length > 2000)
    throw new Error("Add an explanation between 1 and 2,000 characters.");
  return {
    blocker_task_id: draft.blockerTaskId,
    blocked_task_id: draft.blockedTaskId,
    blocker_explanation: explanation,
    blocker_target_date: validDate(draft.targetDate),
  };
}

function databaseError(error: { code?: string; message: string }) {
  if (error.code === "42501")
    return new Error(
      "You no longer have permission to change dependencies in this project. Reload the task.",
    );
  if (error.code === "23505")
    return new Error(
      error.message.includes("already exists")
        ? "That dependency already exists."
        : error.message,
    );
  if (error.code === "22023") return new Error(error.message);
  if (error.code === "55000") return new Error(error.message);
  return new Error(error.message || "Could not load or save dependencies.");
}

function toRelation(
  row: TaskRelationRow,
  tasks: Map<string, TaskRecord>,
): TaskRelationRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    projectId: row.project_id,
    blockerTaskId: row.task_id,
    blockedTaskId: row.related_task_id,
    explanation: row.blocker_explanation,
    targetDate: row.blocker_target_date,
    createdAt: row.created_at,
    blockerTask: tasks.get(row.task_id) ?? null,
    blockedTask: tasks.get(row.related_task_id) ?? null,
  };
}

export function createTaskRelationRepository(
  client: SupabaseClient = supabase,
  taskStore: TaskRepository = createTaskRepository(client),
): TaskRelationRepository {
  const pendingRequests = new Map<string, string>();

  async function rowsForProject(scope: TaskScope) {
    const { data, error } = await client
      .from("task_relations")
      .select(relationColumns)
      .eq("organization_id", scope.organizationId)
      .eq("project_id", scope.projectId)
      .eq("relation_type", "blocks")
      .order("created_at", { ascending: false })
      .returns<TaskRelationRow[]>();
    if (error) throw databaseError(error);
    return data ?? [];
  }

  async function tasksForProject(scope: TaskScope) {
    const tasks = await taskStore.list(scope, true);
    return new Map(tasks.map((task) => [task.id, task]));
  }

  async function mutate(
    scope: TaskScope,
    action: "create" | "delete",
    draft?: TaskDependencyDraft,
    relation?: TaskRelationRecord,
  ) {
    const values = draft ? validateTaskDependencyDraft(draft) : null;
    const parameters = {
      target_organization_id: scope.organizationId,
      target_project_id: scope.projectId,
      action,
      request_id: crypto.randomUUID(),
      relation_id: relation?.id ?? null,
      blocker_task_id: values?.blocker_task_id ?? null,
      blocked_task_id: values?.blocked_task_id ?? null,
      blocker_explanation: values?.blocker_explanation ?? null,
      blocker_target_date: values?.blocker_target_date ?? null,
    };
    const key = JSON.stringify([scope.userId, action, relation?.id, values]);
    const requestId = pendingRequests.get(key) ?? parameters.request_id;
    pendingRequests.set(key, requestId);
    const { data, error } = await client
      .rpc("manage_task_relation", {
        ...parameters,
        request_id: requestId,
      })
      .select(relationColumns)
      .single<TaskRelationRow>();
    if (error) throw databaseError(error);
    pendingRequests.delete(key);
    const taskMap = await tasksForProject(scope);
    return toRelation(data, taskMap);
  }

  return {
    async list(scope, taskId) {
      const [rows, taskMap] = await Promise.all([
        rowsForProject(scope),
        tasksForProject(scope),
      ]);
      const relations = rows.map((row) => toRelation(row, taskMap));
      return {
        blockers: relations.filter(
          ({ blockedTaskId }) => blockedTaskId === taskId,
        ),
        blocking: relations.filter(
          ({ blockerTaskId }) => blockerTaskId === taskId,
        ),
        availableTasks: [...taskMap.values()].filter(
          (task) => !task.archivedAt && task.id !== taskId,
        ),
      };
    },
    async summary(scope) {
      const [rows, taskMap] = await Promise.all([
        rowsForProject(scope),
        tasksForProject(scope),
      ]);
      const result: Record<string, TaskDependencySummary> = {};
      for (const row of rows) {
        const blocker = taskMap.get(row.task_id);
        const blocked = taskMap.get(row.related_task_id);
        if (!blocker || !blocked || blocker.archivedAt || blocked.archivedAt)
          continue;
        const blockerSummary = (result[row.task_id] ??= {
          blockerCount: 0,
          blockingCount: 0,
          hasCriticalBlocker: false,
        });
        blockerSummary.blockingCount += 1;
        const blockedSummary = (result[row.related_task_id] ??= {
          blockerCount: 0,
          blockingCount: 0,
          hasCriticalBlocker: false,
        });
        blockedSummary.blockerCount += 1;
        if (
          (blocker.priority === "urgent" || blocker.priority === "high") &&
          blocker.status !== "completed" &&
          blocker.status !== "canceled"
        ) {
          blockedSummary.hasCriticalBlocker = true;
        }
      }
      return result;
    },
    create: (scope, draft) => mutate(scope, "create", draft),
    remove: (scope, relation) => mutate(scope, "delete", undefined, relation),
  };
}

export const taskDependencyRepository = createTaskRelationRepository();
