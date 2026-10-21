import { describe, expect, it, vi } from "vitest";

import {
  buildNotificationDeepLink,
  createNotificationRepository,
  notificationFromRow,
  type NotificationRow,
} from "../apps/web/src/features/notifications/notification-repository.js";

const scope = {
  organizationId: "organization-1",
  projectId: "project-1",
  userId: "recipient-1",
};

function row(overrides: Partial<NotificationRow> = {}): NotificationRow {
  return {
    actor_id: "actor-1",
    body: "You were mentioned.",
    created_at: "2026-10-21T10:00:00.000Z",
    deep_link:
      "/app/organizations/organization-1/projects/project-1/tasks/task-1?event=event-1",
    dedupe_key: "event:event-1:task_comment_mention",
    id: "notification-1",
    metadata: { eventId: "event-1" },
    notification_type: "task_comment_mention",
    organization_id: "organization-1",
    project_id: "project-1",
    read_at: null,
    recipient_user_id: "recipient-1",
    source_event_id: "event-1",
    task_id: "task-1",
    title: "You were mentioned",
    ...overrides,
  };
}

function fakeClient(saved = row()) {
  const query = {
    eq: vi.fn(() => query),
    is: vi.fn(() => query),
    limit: vi.fn(() => query),
    order: vi.fn(() => query),
    returns: vi.fn(async () => ({ data: [saved], error: null })),
    select: vi.fn(() => query),
    single: vi.fn(async () => ({ data: saved, error: null })),
  };
  const rpc = vi.fn((name: string) => {
    if (name === "mark_notification_read") return query;
    if (name === "list_unread_notifications")
      return Promise.resolve({ data: [saved], error: null });
    return Promise.resolve({ data: 2, error: null });
  });
  return {
    client: {
      from: vi.fn(() => query),
      rpc,
    } as never,
    query,
    rpc,
  };
}

describe("notification repository", () => {
  it("builds task/event deep links and maps persisted rows", () => {
    expect(
      buildNotificationDeepLink({
        eventId: "event-1",
        organizationId: "organization-1",
        projectId: "project-1",
        taskId: "task-1",
      }),
    ).toContain("?event=event-1");
    expect(notificationFromRow(row())).toMatchObject({
      deepLink: expect.stringContaining("/tasks/task-1"),
      notificationType: "task_comment_mention",
      recipientUserId: "recipient-1",
    });
  });

  it("uses recipient/project filters, unread RPC retrieval, and read RPCs", async () => {
    const fake = fakeClient();
    const repository = createNotificationRepository(fake.client);

    await expect(repository.list(scope)).resolves.toHaveLength(1);
    expect(fake.query.eq).toHaveBeenCalledWith(
      "recipient_user_id",
      "recipient-1",
    );
    expect(fake.query.eq).toHaveBeenCalledWith(
      "organization_id",
      "organization-1",
    );
    expect(fake.query.eq).toHaveBeenCalledWith("project_id", "project-1");

    await expect(repository.listUnread(scope)).resolves.toHaveLength(1);
    expect(fake.rpc).toHaveBeenCalledWith("list_unread_notifications", {
      limit_count: 200,
      target_organization_id: "organization-1",
      target_project_id: "project-1",
    });
    await expect(
      repository.markRead(scope, "notification-1"),
    ).resolves.toMatchObject({
      id: "notification-1",
    });
    expect(fake.rpc).toHaveBeenCalledWith("mark_notification_read", {
      target_notification_id: "notification-1",
      target_read: true,
    });
    await expect(repository.markAllRead(scope)).resolves.toBe(2);
  });

  it("rejects a mark-read response that crosses the requested viewer scope", async () => {
    const fake = fakeClient(row({ recipient_user_id: "other-user" }));
    const repository = createNotificationRepository(fake.client);
    await expect(repository.markRead(scope, "notification-1")).rejects.toThrow(
      /scope changed/i,
    );
  });
});
