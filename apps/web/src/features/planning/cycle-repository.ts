import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "../../app/auth-client.js";
import type { TaskScope } from "../tasks/task-repository.js";

export type CycleStatus =
  | "planned"
  | "active"
  | "paused"
  | "completed"
  | "canceled";
export type CycleAction = "cancel" | "complete" | "pause" | "start";

export interface CycleTaskSnapshot {
  id: string;
  key: string;
  number: string;
  title: string;
  estimate: number | null;
  status: string;
  completed: boolean;
  terminal: boolean;
}

export interface CycleRecord {
  id: string;
  name: string;
  organizationId: string;
  projectId: string;
  status: CycleStatus;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  pausedAt: string | null;
  completedAt: string | null;
  initialCommitment: number | null;
  committedPoints: number;
  completedPoints: number;
  addedPoints: number;
  removedPoints: number;
  carriedOverPoints: number;
  taskCount: number;
  completedTaskCount: number;
  addedTaskCount: number;
  removedTaskCount: number;
  carriedOverTaskCount: number;
  initialTasks: CycleTaskSnapshot[];
  completionTasks: CycleTaskSnapshot[];
}

export interface CycleDraft {
  name: string;
  startsAt: string;
  endsAt: string;
}

interface CycleRow {
  id: string;
  name: string;
  organization_id: string;
  project_id: string;
  status: CycleStatus;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  paused_at: string | null;
  completed_at: string | null;
  initial_commitment: number | null;
  committed_points: number;
  completed_points: number;
  added_points: number;
  removed_points: number;
  carried_over_points: number;
  task_count: number;
  completed_task_count: number;
  added_task_count: number;
  removed_task_count: number;
  carried_over_task_count: number;
  initial_tasks: CycleTaskSnapshot[];
  completion_tasks: CycleTaskSnapshot[];
}

const cycleColumns =
  "id, name, organization_id, project_id, status, starts_at, ends_at, created_at, updated_at, started_at, paused_at, completed_at, initial_commitment, committed_points, completed_points, added_points, removed_points, carried_over_points, task_count, completed_task_count, added_task_count, removed_task_count, carried_over_task_count, initial_tasks, completion_tasks";

function toCycle(row: CycleRow): CycleRecord {
  return {
    id: row.id,
    name: row.name,
    organizationId: row.organization_id,
    projectId: row.project_id,
    status: row.status,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt: row.started_at,
    pausedAt: row.paused_at,
    completedAt: row.completed_at,
    initialCommitment: row.initial_commitment,
    committedPoints: row.committed_points,
    completedPoints: row.completed_points,
    addedPoints: row.added_points,
    removedPoints: row.removed_points,
    carriedOverPoints: row.carried_over_points,
    taskCount: row.task_count,
    completedTaskCount: row.completed_task_count,
    addedTaskCount: row.added_task_count,
    removedTaskCount: row.removed_task_count,
    carriedOverTaskCount: row.carried_over_task_count,
    initialTasks: row.initial_tasks,
    completionTasks: row.completion_tasks,
  };
}

export function validateCycleDraft(draft: CycleDraft) {
  const name = draft.name.trim();
  if (!name || name.length > 160)
    throw new Error("Use a sprint name between 1 and 160 characters.");
  for (const value of [draft.startsAt, draft.endsAt]) {
    if (
      value &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
        value.startsWith("0000") ||
        !Number.isFinite(Date.parse(`${value}T00:00:00.000Z`)) ||
        new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) !== value)
    ) {
      throw new Error("Choose valid calendar dates for the sprint.");
    }
  }
  if (draft.startsAt && draft.endsAt && draft.endsAt < draft.startsAt)
    throw new Error("Sprint end must be on or after its start date.");
  return {
    name,
    startsAt: draft.startsAt ? `${draft.startsAt}T00:00:00.000Z` : null,
    endsAt: draft.endsAt ? `${draft.endsAt}T00:00:00.000Z` : null,
  };
}

export interface CycleRepository {
  list(scope: TaskScope): Promise<CycleRecord[]>;
  create(scope: TaskScope, draft: CycleDraft): Promise<CycleRecord>;
  edit(
    scope: TaskScope,
    cycle: CycleRecord,
    draft: CycleDraft,
  ): Promise<CycleRecord>;
  manage(
    scope: TaskScope,
    action: CycleAction,
    cycle: CycleRecord,
  ): Promise<CycleRecord>;
}

export function createCycleRepository(
  client: SupabaseClient = supabase,
): CycleRepository {
  const pending = new Map<string, string>();
  async function mutate(
    scope: TaskScope,
    action: string,
    cycle?: CycleRecord,
    draft?: CycleDraft,
  ) {
    const values = draft ? validateCycleDraft(draft) : null;
    const parameters = {
      target_organization_id: scope.organizationId,
      target_project_id: scope.projectId,
      action,
      target_cycle_id: cycle?.id ?? null,
      expected_updated_at: cycle?.updatedAt ?? null,
      cycle_name: values?.name ?? null,
      cycle_starts_at: values?.startsAt ?? null,
      cycle_ends_at: values?.endsAt ?? null,
    };
    const key = JSON.stringify([scope.userId, parameters]);
    const requestId = pending.get(key) ?? crypto.randomUUID();
    pending.set(key, requestId);
    const { data, error } = await client
      .rpc("manage_cycle", { ...parameters, request_id: requestId })
      .select(cycleColumns)
      .single<CycleRow>();
    if (error) {
      if (error.code === "23505" && error.message.includes("cycles_one_active"))
        throw new Error(
          "This project already has an active sprint. Pause or complete it first.",
        );
      throw new Error(
        error.message ||
          "Could not save the sprint. Reload planning to check the result.",
      );
    }
    pending.delete(key);
    return toCycle(data);
  }
  return {
    async list(scope) {
      const rows: CycleRecord[] = [];
      const pageSize = 100;
      for (let offset = 0; ; offset += pageSize) {
        const { data, error } = await client
          .from("cycles")
          .select(cycleColumns)
          .eq("organization_id", scope.organizationId)
          .eq("project_id", scope.projectId)
          .order("created_at", { ascending: false })
          .order("id")
          .range(offset, offset + pageSize - 1)
          .returns<CycleRow[]>();
        if (error) throw new Error(error.message || "Could not load sprints.");
        rows.push(...(data ?? []).map(toCycle));
        if (!data || data.length < pageSize) return rows;
      }
    },
    create: (scope, draft) => mutate(scope, "create", undefined, draft),
    edit: (scope, cycle, draft) => mutate(scope, "edit", cycle, draft),
    manage: (scope, action, cycle) => mutate(scope, action, cycle),
  };
}

export const cycleRepository = createCycleRepository();
