import {
  REALTIME_SUBSCRIBE_STATES,
  type RealtimePostgresChangesPayload,
  type SupabaseClient,
} from "@supabase/supabase-js";

import { supabase } from "../../app/auth-client.js";
import {
  isNotificationType,
  notificationFromRow,
  type NotificationRecord,
  type NotificationRealtimeRow,
  type NotificationScope,
} from "./notification-repository.js";

export type NotificationRealtimeEvent = "DELETE" | "INSERT" | "UPDATE";

export interface NotificationRealtimeChange {
  eventType: NotificationRealtimeEvent;
  notification: NotificationRecord;
}

export interface NotificationRealtimeHandlers {
  onChange: (change: NotificationRealtimeChange) => void;
  onResync: () => void | Promise<void>;
}

export interface NotificationRealtimeSubscription {
  subscribe: (
    scope: NotificationScope,
    handlers: NotificationRealtimeHandlers,
  ) => () => void;
}

export type NotificationRealtimeClient = Pick<
  SupabaseClient,
  "channel" | "removeChannel"
>;

export interface NotificationDelivery {
  subscribe: (
    scope: NotificationScope,
    handlers: Pick<NotificationRealtimeHandlers, "onChange">,
  ) => () => void;
}

type NotificationRealtimePayload =
  RealtimePostgresChangesPayload<NotificationRealtimeRow>;

function objectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function notificationFromRealtimeRow(
  value: unknown,
  scope: NotificationScope,
): NotificationRecord | null {
  if (!objectRecord(value)) return null;
  const row = value as Partial<NotificationRealtimeRow>;
  if (
    typeof row.id !== "string" ||
    typeof row.organization_id !== "string" ||
    typeof row.project_id !== "string" ||
    typeof row.task_id !== "string" ||
    typeof row.source_event_id !== "string" ||
    typeof row.recipient_user_id !== "string" ||
    typeof row.notification_type !== "string" ||
    !isNotificationType(row.notification_type) ||
    typeof row.dedupe_key !== "string" ||
    typeof row.title !== "string" ||
    typeof row.body !== "string" ||
    typeof row.deep_link !== "string" ||
    typeof row.created_at !== "string" ||
    (row.read_at !== null && typeof row.read_at !== "string")
  ) {
    return null;
  }
  if (row.recipient_user_id !== scope.userId) return null;
  if (
    (scope.organizationId !== undefined &&
      row.organization_id !== scope.organizationId) ||
    (scope.projectId !== undefined && row.project_id !== scope.projectId)
  ) {
    return null;
  }
  if (!Object.prototype.hasOwnProperty.call(row, "metadata")) return null;
  return notificationFromRow(row as NotificationRealtimeRow);
}

export function notificationRealtimeChannelName(scope: NotificationScope) {
  return `projectpulse:notifications:${encodeURIComponent(scope.userId)}:${encodeURIComponent(scope.organizationId ?? "all")}:${encodeURIComponent(scope.projectId ?? "all")}`;
}

export function notificationRealtimeFilter(scope: NotificationScope) {
  return `recipient_user_id=eq.${scope.userId}`;
}

export function createNotificationRealtimeSubscription(
  client: NotificationRealtimeClient = supabase,
): NotificationRealtimeSubscription {
  return {
    subscribe(scope, handlers) {
      let active = true;
      let hasEstablished = false;
      let needsResync = false;
      const delivered = new Map<string, Set<string>>();
      const channel = client
        .channel(notificationRealtimeChannelName(scope))
        .on<NotificationRealtimeRow>(
          "postgres_changes",
          {
            event: "*",
            filter: notificationRealtimeFilter(scope),
            schema: "public",
            table: "notifications",
          },
          (payload: NotificationRealtimePayload) => {
            if (!active) return;
            if (
              payload.eventType !== "INSERT" &&
              payload.eventType !== "UPDATE" &&
              payload.eventType !== "DELETE"
            ) {
              return;
            }
            const row =
              payload.eventType === "DELETE" ? payload.old : payload.new;
            const notification = notificationFromRealtimeRow(row, scope);
            if (!notification) return;
            const fingerprint = `${payload.eventType}:${notification.id}:${JSON.stringify(notification)}`;
            const fingerprints =
              delivered.get(notification.id) ?? new Set<string>();
            if (fingerprints.has(fingerprint)) return;
            fingerprints.add(fingerprint);
            delivered.set(notification.id, fingerprints);
            handlers.onChange({
              eventType: payload.eventType,
              notification,
            });
          },
        )
        .subscribe((status) => {
          if (!active) return;
          const retrieve = () => {
            try {
              const result = handlers.onResync();
              if (result instanceof Promise) void result.catch(() => undefined);
            } catch {
              // Retrieval owns its own error presentation.
            }
          };
          if (status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) {
            if (hasEstablished || needsResync) {
              retrieve();
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
            retrieve();
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

export function createNotificationDelivery(
  realtimeSubscription: NotificationRealtimeSubscription | null,
  retrieve: (scope: NotificationScope) => Promise<void>,
): NotificationDelivery {
  return {
    subscribe(scope, handlers) {
      if (!realtimeSubscription) {
        void Promise.resolve()
          .then(() => retrieve(scope))
          .catch(() => undefined);
        return () => undefined;
      }
      try {
        return realtimeSubscription.subscribe(scope, {
          onChange: handlers.onChange,
          onResync: () => retrieve(scope),
        });
      } catch {
        void Promise.resolve()
          .then(() => retrieve(scope))
          .catch(() => undefined);
        return () => undefined;
      }
    },
  };
}

export const notificationRealtimeSubscription =
  createNotificationRealtimeSubscription();
