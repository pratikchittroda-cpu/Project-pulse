import type { SupabaseClient } from "@supabase/supabase-js";
import type { JsonValue } from "@releasearc/domain";

import { supabase } from "../../app/auth-client.js";
import { taskDetailPath } from "../tasks/task-detail-repository.js";

export const NOTIFICATION_TYPES = [
  "task_assigned",
  "task_status_changed",
  "task_comment_mention",
  "task_review_requested",
  "task_ci_failed",
  "task_event",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface NotificationScope {
  organizationId?: string;
  projectId?: string;
  userId: string;
}

export interface NotificationRecord {
  actorId: string | null;
  body: string;
  createdAt: string;
  deepLink: string;
  dedupeKey: string;
  id: string;
  metadata: JsonValue;
  notificationType: NotificationType;
  organizationId: string;
  projectId: string;
  readAt: string | null;
  recipientUserId: string;
  sourceEventId: string;
  taskId: string;
  title: string;
}

export interface NotificationRow {
  actor_id: string | null;
  body: string;
  created_at: string;
  deep_link: string;
  dedupe_key: string;
  id: string;
  metadata: JsonValue;
  notification_type: NotificationType;
  organization_id: string;
  project_id: string;
  read_at: string | null;
  recipient_user_id: string;
  source_event_id: string;
  task_id: string;
  title: string;
}

export type NotificationRealtimeRow = NotificationRow;

export interface NotificationRepository {
  list(scope: NotificationScope): Promise<NotificationRecord[]>;
  listUnread(scope: NotificationScope): Promise<NotificationRecord[]>;
  markAllRead(scope: NotificationScope): Promise<number>;
  markRead(
    scope: NotificationScope,
    notificationId: string,
    read?: boolean,
  ): Promise<NotificationRecord>;
}

export const notificationColumns =
  "id, organization_id, project_id, task_id, source_event_id, recipient_user_id, actor_id, notification_type, dedupe_key, title, body, deep_link, metadata, read_at, created_at";

export function buildNotificationDeepLink(input: {
  eventId: string;
  organizationId: string;
  projectId: string;
  taskId: string;
}) {
  return `${taskDetailPath(input, input.taskId)}?event=${encodeURIComponent(input.eventId)}`;
}

export function isNotificationType(value: string): value is NotificationType {
  return (NOTIFICATION_TYPES as readonly string[]).includes(value);
}

export function notificationFromRow(row: NotificationRow): NotificationRecord {
  return {
    actorId: row.actor_id,
    body: row.body,
    createdAt: row.created_at,
    deepLink: row.deep_link,
    dedupeKey: row.dedupe_key,
    id: row.id,
    metadata: row.metadata,
    notificationType: row.notification_type,
    organizationId: row.organization_id,
    projectId: row.project_id,
    readAt: row.read_at,
    recipientUserId: row.recipient_user_id,
    sourceEventId: row.source_event_id,
    taskId: row.task_id,
    title: row.title,
  };
}

function databaseError(error: { code?: string; message: string }) {
  if (error.code === "42501") {
    return new Error(
      "You no longer have access to this notification or project.",
    );
  }
  if (error.code === "PGRST116") {
    return new Error("This notification is no longer available.");
  }
  return new Error(error.message || "Could not load notifications.");
}

function scopedQuery(
  client: SupabaseClient,
  scope: NotificationScope,
  unread: boolean,
) {
  let query = client
    .from("notifications")
    .select(notificationColumns)
    .eq("recipient_user_id", scope.userId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(200);
  if (scope.organizationId) {
    query = query.eq("organization_id", scope.organizationId);
  }
  if (scope.projectId) {
    query = query.eq("project_id", scope.projectId);
  }
  if (unread) {
    query = query.is("read_at", null);
  }
  return query.returns<NotificationRow[]>();
}

export function createNotificationRepository(
  client: SupabaseClient = supabase,
): NotificationRepository {
  return {
    async list(scope) {
      const { data, error } = await scopedQuery(client, scope, false);
      if (error) throw databaseError(error);
      return (data ?? []).map(notificationFromRow);
    },
    async listUnread(scope) {
      const { data, error } = await client.rpc("list_unread_notifications", {
        target_organization_id: scope.organizationId ?? null,
        target_project_id: scope.projectId ?? null,
        limit_count: 200,
      });
      if (error) throw databaseError(error);
      return ((data ?? []) as NotificationRow[]).map(notificationFromRow);
    },
    async markAllRead(scope) {
      const { data, error } = await client.rpc("mark_all_notifications_read", {
        target_organization_id: scope.organizationId ?? null,
        target_project_id: scope.projectId ?? null,
      });
      if (error) throw databaseError(error);
      return typeof data === "number" ? data : Number(data ?? 0);
    },
    async markRead(scope, notificationId, read = true) {
      const { data, error } = await client
        .rpc("mark_notification_read", {
          target_notification_id: notificationId,
          target_read: read,
        })
        .select(notificationColumns)
        .single<NotificationRow>();
      if (error) throw databaseError(error);
      const saved = notificationFromRow(data);
      if (
        saved.recipientUserId !== scope.userId ||
        (scope.organizationId !== undefined &&
          saved.organizationId !== scope.organizationId) ||
        (scope.projectId !== undefined && saved.projectId !== scope.projectId)
      ) {
        throw new Error("Notification scope changed. Reload the inbox.");
      }
      return saved;
    },
  };
}

export const notificationRepository = createNotificationRepository();
