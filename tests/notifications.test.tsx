// @vitest-environment jsdom

import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NotificationInbox } from "../apps/web/src/pages/notifications-page.js";
import type {
  NotificationRecord,
  NotificationRepository,
} from "../apps/web/src/features/notifications/notification-repository.js";

afterEach(cleanup);

function notification(
  overrides: Partial<NotificationRecord> = {},
): NotificationRecord {
  return {
    actorId: "actor-1",
    body: "You were mentioned on the task.",
    createdAt: "2026-10-21T10:00:00.000Z",
    deepLink:
      "/app/organizations/organization-1/projects/project-1/tasks/task-1?event=event-1",
    dedupeKey: "event:event-1:task_comment_mention",
    id: "notification-1",
    metadata: { eventId: "event-1" },
    notificationType: "task_comment_mention",
    organizationId: "organization-1",
    projectId: "project-1",
    readAt: null,
    recipientUserId: "recipient-1",
    sourceEventId: "event-1",
    taskId: "task-1",
    title: "You were mentioned",
    ...overrides,
  };
}

function setup() {
  const repository: NotificationRepository = {
    list: vi.fn(async () => [notification()]),
    listUnread: vi.fn(async () => [notification()]),
    markAllRead: vi.fn(async () => 1),
    markRead: vi.fn(async (_scope, id, read = true) =>
      notification({ id, readAt: read ? "2026-10-21T10:01:00.000Z" : null }),
    ),
  };
  render(
    <MemoryRouter>
      <NotificationInbox
        realtimeSubscription={null}
        repository={repository}
        scope={{
          organizationId: "organization-1",
          projectId: "project-1",
          userId: "recipient-1",
        }}
      />
    </MemoryRouter>,
  );
  return repository;
}

describe("notification inbox", () => {
  it("renders unread deep links and persists an individual read action", async () => {
    const repository = setup();
    const inbox = await screen.findByRole("region", {
      name: "Notification inbox",
    });
    expect(within(inbox).getByText("You were mentioned")).toBeTruthy();
    expect(
      within(inbox)
        .getByRole("link", { name: /You were mentioned/ })
        .getAttribute("href"),
    ).toContain("/tasks/task-1?event=event-1");
    fireEvent.click(
      within(inbox).getByRole("button", {
        name: /Mark read: You were mentioned/,
      }),
    );
    await waitFor(() =>
      expect(repository.markRead).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "recipient-1" }),
        "notification-1",
        true,
      ),
    );
  });

  it("marks every visible notification read and keeps empty-state copy available", async () => {
    const repository = setup();
    const button = await screen.findByRole("button", { name: "Mark all read" });
    await waitFor(() => expect(button.hasAttribute("disabled")).toBe(false));
    fireEvent.click(button);
    await waitFor(() =>
      expect(repository.markAllRead).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: "organization-1",
          projectId: "project-1",
        }),
      ),
    );
    expect(screen.getByText("You are caught up.")).toBeTruthy();
  });
});
