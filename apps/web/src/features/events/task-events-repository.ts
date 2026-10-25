import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isEventName,
  isIsoDateTime,
  parseEventEnvelope,
  toIsoDateTime,
  type EventEnvelope,
  type EventSource,
  type JsonValue,
} from "@releasearc/domain";

import { supabase } from "../../app/auth-client.js";

export interface TaskEventScope {
  organizationId: string;
  projectId: string;
  taskId: string;
}

export interface TaskEventDraft {
  actorId?: string;
  correlationId?: string;
  eventType: string;
  idempotencyKey: string;
  occurredAt?: string;
  payload: JsonValue;
  source: EventSource | string;
}

export type TaskEventRecord = EventEnvelope & {
  createdAt: string;
};

export class TaskEventValidationError extends Error {
  constructor(readonly issues: string[]) {
    super("Task event validation failed.");
  }
}

interface TaskEventRow {
  actor_id: string | null;
  correlation_id: string | null;
  created_at: string;
  entity_id: string;
  entity_type: string;
  event_type: string;
  id: string;
  idempotency_key: string;
  occurred_at: string;
  organization_id: string;
  payload: JsonValue;
  project_id: string;
  source: string;
  task_id: string;
}

const taskEventColumns =
  "id, organization_id, project_id, task_id, event_type, source, entity_type, entity_id, idempotency_key, correlation_id, actor_id, payload, occurred_at, created_at";

function eventTimes(occurredAt?: string) {
  const occurred = occurredAt ?? toIsoDateTime(new Date());
  const received = toIsoDateTime(new Date());
  return { occurred, received };
}

export function validateTaskEventDraft(
  scope: TaskEventScope,
  draft: TaskEventDraft,
) {
  const issues: string[] = [];
  if (!draft.idempotencyKey.trim()) issues.push("idempotencyKey is required");
  if (!isEventName(draft.eventType))
    issues.push("eventType must be lower-case dot-separated text");
  if (
    typeof draft.source !== "string" ||
    !/^[a-z][a-z0-9_.-]{0,39}$/.test(draft.source)
  ) {
    issues.push("source is invalid");
  }
  if (draft.actorId !== undefined && !draft.actorId.trim())
    issues.push("actorId cannot be empty");
  if (draft.correlationId !== undefined && !draft.correlationId.trim())
    issues.push("correlationId cannot be empty");
  const { occurred, received } = eventTimes(draft.occurredAt);
  if (!isIsoDateTime(occurred))
    issues.push("occurredAt must be an ISO date-time");
  if (issues.length) throw new TaskEventValidationError(issues);

  const parsed = parseEventEnvelope({
    actorId: draft.actorId,
    correlationId: draft.correlationId,
    entityId: scope.taskId,
    entityType: "task",
    eventId: "pending",
    eventType: draft.eventType,
    idempotencyKey: draft.idempotencyKey.trim(),
    occurredAt: occurred,
    organizationId: scope.organizationId,
    payload: draft.payload,
    projectId: scope.projectId,
    receivedAt: received,
    source: draft.source,
  });
  if (!parsed.ok)
    throw new TaskEventValidationError(
      parsed.error.issues.map((issue) => `${issue.field}: ${issue.message}`),
    );
  return parsed.value;
}

function toTaskEvent(row: TaskEventRow): TaskEventRecord {
  return {
    actorId: row.actor_id ?? undefined,
    correlationId: row.correlation_id ?? undefined,
    createdAt: row.created_at,
    entityId: row.entity_id,
    entityType: row.entity_type,
    eventId: row.id,
    eventType: row.event_type,
    idempotencyKey: row.idempotency_key,
    occurredAt: toIsoDateTime(row.occurred_at),
    organizationId: row.organization_id,
    payload: row.payload,
    projectId: row.project_id,
    receivedAt: toIsoDateTime(row.created_at),
    source: row.source,
  };
}

function databaseError(error: { code?: string; message: string }) {
  if (error.code === "42501")
    return new Error(
      "You do not have permission to record events for this project.",
    );
  if (error.code === "23503")
    return new Error("The task is no longer available in this project.");
  if (error.code === "23514" || error.code === "22023")
    return new Error(error.message);
  return new Error(error.message || "Could not load task events.");
}

export interface TaskEventRepository {
  list(scope: TaskEventScope): Promise<TaskEventRecord[]>;
  record(
    scope: TaskEventScope,
    draft: TaskEventDraft,
  ): Promise<TaskEventRecord>;
}

export function createTaskEventRepository(
  client: SupabaseClient = supabase,
): TaskEventRepository {
  return {
    async list(scope) {
      const events = new Map<string, TaskEventRecord>();
      const pageSize = 100;
      for (let offset = 0; ; offset += pageSize) {
        const { data, error } = await client
          .from("task_events")
          .select(taskEventColumns)
          .eq("organization_id", scope.organizationId)
          .eq("project_id", scope.projectId)
          .eq("task_id", scope.taskId)
          .order("occurred_at", { ascending: true })
          .order("created_at", { ascending: true })
          .order("id", { ascending: true })
          .range(offset, offset + pageSize - 1)
          .returns<TaskEventRow[]>();
        if (error) throw databaseError(error);
        for (const row of data ?? []) events.set(row.id, toTaskEvent(row));
        if (!data || data.length < pageSize) return [...events.values()];
      }
    },
    async record(scope, draft) {
      const envelope = validateTaskEventDraft(scope, draft);
      const { data, error } = await client.rpc("record_task_event", {
        target_actor_id: envelope.actorId ?? null,
        target_correlation_id: envelope.correlationId ?? null,
        target_event_type: envelope.eventType,
        target_idempotency_key: envelope.idempotencyKey,
        target_occurred_at: envelope.occurredAt,
        target_organization_id: envelope.organizationId,
        target_payload: envelope.payload,
        target_project_id: envelope.projectId,
        target_source: envelope.source,
        target_task_id: envelope.entityId,
      });
      if (error) throw databaseError(error);
      return toTaskEvent(data as TaskEventRow);
    },
  };
}

export const taskEventRepository = createTaskEventRepository();
