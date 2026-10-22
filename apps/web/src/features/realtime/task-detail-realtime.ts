import {
  REALTIME_SUBSCRIBE_STATES,
  type RealtimePostgresChangesPayload,
  type SupabaseClient,
} from "@supabase/supabase-js";

import { supabase } from "../../app/auth-client.js";

export const TASK_DETAIL_REALTIME_TABLES = [
  "attachments",
  "comments",
  "comment_mentions",
  "task_checklist_items",
  "task_events",
  "task_relations",
  "tasks",
] as const;

export type TaskDetailRealtimeTable =
  (typeof TASK_DETAIL_REALTIME_TABLES)[number];
export type TaskDetailRealtimeEvent = "DELETE" | "INSERT" | "UPDATE";

export interface TaskDetailRealtimeScope {
  organizationId: string;
  projectId: string;
  taskId: string;
}

export interface TaskDetailRealtimeChange {
  eventType: TaskDetailRealtimeEvent;
  recordId: string;
  table: TaskDetailRealtimeTable;
}

export interface TaskDetailRealtimeHandlers {
  onChange: (change: TaskDetailRealtimeChange) => void;
  onResync: () => void | Promise<void>;
}

export interface TaskDetailRealtimeSubscription {
  subscribe: (
    scope: TaskDetailRealtimeScope,
    handlers: TaskDetailRealtimeHandlers,
  ) => () => void;
}

export type TaskDetailRealtimeClient = Pick<
  SupabaseClient,
  "channel" | "removeChannel"
>;

type RealtimeRow = Record<string, unknown>;
type RealtimePayload = RealtimePostgresChangesPayload<RealtimeRow>;

function isDetailTable(value: string): value is TaskDetailRealtimeTable {
  return (TASK_DETAIL_REALTIME_TABLES as readonly string[]).includes(value);
}

function rowValue(row: unknown, key: string) {
  return typeof row === "object" && row !== null && key in row
    ? (row as Record<string, unknown>)[key]
    : undefined;
}

function matchesScope(
  table: TaskDetailRealtimeTable,
  row: unknown,
  scope: TaskDetailRealtimeScope,
) {
  if (
    rowValue(row, "organization_id") !== undefined &&
    rowValue(row, "organization_id") !== scope.organizationId
  ) {
    return false;
  }
  if (
    rowValue(row, "project_id") !== undefined &&
    rowValue(row, "project_id") !== scope.projectId
  ) {
    return false;
  }
  if (table === "tasks") return rowValue(row, "id") === scope.taskId;
  if (table === "task_relations") {
    return (
      rowValue(row, "task_id") === scope.taskId ||
      rowValue(row, "related_task_id") === scope.taskId
    );
  }
  return rowValue(row, "task_id") === scope.taskId;
}

export function taskDetailRealtimeChannelName(scope: TaskDetailRealtimeScope) {
  return `projectpulse:task-detail:${encodeURIComponent(scope.organizationId)}:${encodeURIComponent(scope.projectId)}:${encodeURIComponent(scope.taskId)}`;
}

export function taskDetailRealtimeChangeFromPayload(
  payload: RealtimePayload,
  scope: TaskDetailRealtimeScope,
): TaskDetailRealtimeChange | null {
  if (
    payload.schema !== "public" ||
    !isDetailTable(payload.table) ||
    (payload.eventType !== "INSERT" &&
      payload.eventType !== "UPDATE" &&
      payload.eventType !== "DELETE")
  ) {
    return null;
  }

  const row = payload.eventType === "DELETE" ? payload.old : payload.new;
  const recordId = rowValue(row, "id");
  if (typeof recordId !== "string" || !recordId) return null;
  if (!matchesScope(payload.table, row, scope)) return null;

  return {
    eventType: payload.eventType,
    recordId,
    table: payload.table,
  };
}

export function createTaskDetailRealtimeSubscription(
  client: TaskDetailRealtimeClient = supabase,
): TaskDetailRealtimeSubscription {
  return {
    subscribe(scope, handlers) {
      let active = true;
      let established = false;
      let needsResync = false;
      const delivered = new Set<string>();
      const channel = client.channel(taskDetailRealtimeChannelName(scope));
      const listen = (table: TaskDetailRealtimeTable) => {
        channel.on<RealtimeRow>(
          "postgres_changes",
          {
            event: "*",
            filter:
              table === "tasks"
                ? `id=eq.${scope.taskId}`
                : table === "task_relations"
                  ? `project_id=eq.${scope.projectId}`
                  : `task_id=eq.${scope.taskId}`,
            schema: "public",
            table,
          },
          (payload) => {
            if (!active) return;
            const change = taskDetailRealtimeChangeFromPayload(payload, scope);
            if (!change) return;
            const fingerprint = `${change.table}:${change.eventType}:${change.recordId}:${payload.commit_timestamp}`;
            if (delivered.has(fingerprint)) return;
            delivered.add(fingerprint);
            handlers.onChange(change);
          },
        );
      };

      for (const table of TASK_DETAIL_REALTIME_TABLES) listen(table);

      channel.subscribe((status) => {
        if (!active) return;
        if (status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) {
          if (established || needsResync) {
            try {
              const result = handlers.onResync();
              if (result instanceof Promise) void result.catch(() => undefined);
            } catch {
              // The task detail owns error presentation for resync failures.
            }
          }
          established = true;
          needsResync = false;
          return;
        }
        if (
          status === REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR ||
          status === REALTIME_SUBSCRIBE_STATES.TIMED_OUT ||
          status === REALTIME_SUBSCRIBE_STATES.CLOSED
        ) {
          needsResync = true;
          try {
            const result = handlers.onResync();
            if (result instanceof Promise) void result.catch(() => undefined);
          } catch {
            // The task detail owns error presentation for resync failures.
          }
        }
      });

      return () => {
        if (!active) return;
        active = false;
        try {
          void client.removeChannel(channel).catch(() => undefined);
        } catch {
          // Cleanup remains best-effort if the client is already closed.
        }
      };
    },
  };
}

export const taskDetailRealtimeSubscription =
  createTaskDetailRealtimeSubscription();
