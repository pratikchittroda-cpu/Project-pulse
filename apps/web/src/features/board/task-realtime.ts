import {
  REALTIME_SUBSCRIBE_STATES,
  type RealtimePostgresChangesPayload,
  type SupabaseClient,
} from "@supabase/supabase-js";

import { supabase } from "../../app/auth-client.js";
import {
  taskFromRealtimeRow,
  type TaskRealtimeRow,
  type TaskRecord,
  type TaskScope,
} from "../tasks/task-repository.js";

export type TaskRealtimeEvent = "DELETE" | "INSERT" | "UPDATE";

export interface TaskRealtimeChange {
  eventType: TaskRealtimeEvent;
  task: TaskRecord | null;
  taskId: string;
  version: string;
}

export interface TaskRealtimeHandlers {
  onChange: (change: TaskRealtimeChange) => void;
  onResync: () => void | Promise<void>;
}

export interface TaskRealtimeSubscription {
  subscribe: (scope: TaskScope, handlers: TaskRealtimeHandlers) => () => void;
}

export type TaskRealtimeClient = Pick<
  SupabaseClient,
  "channel" | "removeChannel"
>;

type TaskRealtimePayload = RealtimePostgresChangesPayload<TaskRealtimeRow>;

interface DeliveredTaskEvents {
  fingerprints: Set<string>;
  version: string;
}

function compareVersions(left: string, right: string) {
  if (left === right) return 0;
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  if (Number.isFinite(leftTime) && Number.isFinite(rightTime)) {
    return leftTime < rightTime ? -1 : 1;
  }
  return left < right ? -1 : 1;
}

function matchesScope(
  row: Partial<TaskRealtimeRow>,
  scope: TaskScope,
  requireScope: boolean,
) {
  if (
    row.organization_id !== undefined &&
    row.organization_id !== scope.organizationId
  ) {
    return false;
  }
  if (row.project_id !== undefined && row.project_id !== scope.projectId) {
    return false;
  }
  return (
    !requireScope ||
    (row.organization_id === scope.organizationId &&
      row.project_id === scope.projectId)
  );
}

export function taskRealtimeChangeFromPayload(
  payload: TaskRealtimePayload,
  scope: TaskScope,
): TaskRealtimeChange | null {
  if (
    payload.schema !== "public" ||
    payload.table !== "tasks" ||
    (payload.eventType !== "INSERT" &&
      payload.eventType !== "UPDATE" &&
      payload.eventType !== "DELETE")
  ) {
    return null;
  }

  const next = payload.new as TaskRealtimeRow;
  const previous = payload.old as Partial<TaskRealtimeRow>;
  const identity = payload.eventType === "DELETE" ? previous : next;
  const taskId = typeof identity.id === "string" ? identity.id : null;
  if (!taskId) return null;

  if (
    !matchesScope(
      payload.eventType === "DELETE" ? previous : next,
      scope,
      payload.eventType !== "DELETE",
    ) ||
    !matchesScope(previous, scope, false)
  ) {
    return null;
  }

  const task =
    payload.eventType === "DELETE"
      ? null
      : taskFromRealtimeRow(next, scope.projectKey);
  if (payload.eventType !== "DELETE" && !task) return null;

  return {
    eventType: payload.eventType,
    task,
    taskId,
    version: task?.updatedAt || payload.commit_timestamp,
  };
}

export function taskRealtimeChannelName(scope: TaskScope) {
  return `projectpulse:tasks:${encodeURIComponent(scope.organizationId)}:${encodeURIComponent(scope.projectId)}`;
}

export function taskRealtimeFilter(scope: TaskScope) {
  // Supabase Realtime accepts one Postgres filter per listener. Project scope
  // is the narrowest server-side filter; the client still validates both
  // organization and project IDs before applying an event.
  return `project_id=eq.${scope.projectId}`;
}

export function createTaskRealtimeSubscription(
  client: TaskRealtimeClient = supabase,
): TaskRealtimeSubscription {
  return {
    subscribe(scope, handlers) {
      let active = true;
      let hasEstablished = false;
      let needsResync = false;
      const delivered = new Map<string, DeliveredTaskEvents>();
      const channel = client
        .channel(taskRealtimeChannelName(scope))
        .on<TaskRealtimeRow>(
          "postgres_changes",
          {
            event: "*",
            filter: taskRealtimeFilter(scope),
            schema: "public",
            table: "tasks",
          },
          (payload) => {
            if (!active) return;
            const change = taskRealtimeChangeFromPayload(payload, scope);
            if (!change) return;

            const fingerprint = `${change.eventType}:${change.taskId}:${change.version}:${change.task ? JSON.stringify(change.task) : "deleted"}`;
            const previous = delivered.get(change.taskId);
            if (previous) {
              const versionOrder = compareVersions(
                change.version,
                previous.version,
              );
              if (versionOrder < 0) return;
              if (
                versionOrder === 0 &&
                previous.fingerprints.has(fingerprint)
              ) {
                return;
              }
              if (versionOrder > 0) {
                delivered.set(change.taskId, {
                  fingerprints: new Set([fingerprint]),
                  version: change.version,
                });
              } else {
                previous.fingerprints.add(fingerprint);
              }
            } else {
              delivered.set(change.taskId, {
                fingerprints: new Set([fingerprint]),
                version: change.version,
              });
            }
            handlers.onChange(change);
          },
        )
        .subscribe((status) => {
          if (!active) return;
          if (status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) {
            if (hasEstablished || needsResync) {
              try {
                const result = handlers.onResync();
                if (result instanceof Promise)
                  void result.catch(() => undefined);
              } catch {
                // The board owns resync error presentation.
              }
            }
            hasEstablished = true;
            needsResync = false;
            return;
          }
          if (
            status === REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR ||
            status === REALTIME_SUBSCRIBE_STATES.TIMED_OUT ||
            status === REALTIME_SUBSCRIBE_STATES.CLOSED
          ) {
            needsResync = true;
          }
        });

      return () => {
        if (!active) return;
        active = false;
        try {
          void client.removeChannel(channel).catch(() => undefined);
        } catch {
          // Cleanup must remain best-effort if the client is already closed.
        }
      };
    },
  };
}

export const taskRealtimeSubscription = createTaskRealtimeSubscription();
