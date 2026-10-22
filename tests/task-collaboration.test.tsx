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
import { afterEach, describe, expect, it, vi } from "vitest";

import { TimelineEntry } from "../apps/web/src/features/events/task-timeline.js";
import { TaskCollaborationPanel } from "../apps/web/src/features/tasks/task-collaboration-panel.js";
import type {
  TaskAttachmentRecord,
  TaskChecklistItemRecord,
  TaskCollaborationRepository,
  TaskCommentRecord,
} from "../apps/web/src/features/tasks/task-collaboration-repository.js";
import type { TaskScope } from "../apps/web/src/features/tasks/task-repository.js";
import { taskEventFixture } from "./task-fixtures.js";

afterEach(cleanup);

const scope: TaskScope = {
  organizationId: "organization-1",
  projectId: "project-1",
  projectKey: "SHIP",
  userId: "writer-1",
};

function comment(
  overrides: Partial<TaskCommentRecord> = {},
): TaskCommentRecord {
  return {
    authorId: "writer-1",
    body: "Original comment",
    createdAt: "2026-10-21T10:00:00.000Z",
    deletedAt: null,
    editVersion: 0,
    id: "comment-1",
    mentionedUserIds: [],
    taskId: "task-1",
    updatedAt: "2026-10-21T10:00:00.000Z",
    ...overrides,
  };
}

function checklistItem(
  overrides: Partial<TaskChecklistItemRecord> = {},
): TaskChecklistItemRecord {
  return {
    completedAt: null,
    completedBy: null,
    createdAt: "2026-10-21T10:00:00.000Z",
    id: "item-1",
    position: 0,
    taskId: "task-1",
    title: "Confirm deployment",
    updatedAt: "2026-10-21T10:00:00.000Z",
    ...overrides,
  };
}

function attachment(): TaskAttachmentRecord {
  return {
    byteSize: 12,
    commentId: null,
    contentType: "text/plain",
    createdAt: "2026-10-21T10:00:00.000Z",
    fileName: "notes.txt",
    id: "attachment-1",
    storagePath: "organization-1/project-1/task-1/attachment-notes.txt",
    taskId: "task-1",
    uploadedBy: "writer-1",
  };
}

function setup({ canWrite = true } = {}) {
  const repository: TaskCollaborationRepository = {
    createChecklistItem: vi.fn(async () => checklistItem({ id: "item-2" })),
    createComment: vi.fn(async (_scope, _taskId, draft) =>
      comment({ body: draft.body, mentionedUserIds: draft.mentionedUserIds }),
    ),
    deleteChecklistItem: vi.fn(async (_scope, _taskId, item) => item),
    deleteComment: vi.fn(async (_scope, _taskId, item) =>
      comment({
        ...item,
        body: "Comment deleted",
        deletedAt: "2026-10-21T11:00:00.000Z",
      }),
    ),
    editComment: vi.fn(async (_scope, _taskId, item, draft) =>
      comment({
        ...item,
        body: draft.body,
        editVersion: 1,
        mentionedUserIds: draft.mentionedUserIds,
      }),
    ),
    getAttachmentUrl: vi.fn(async () => "https://storage.example.test/signed"),
    listAttachments: vi.fn(async () => [attachment()]),
    listChecklistItems: vi.fn(async () => [checklistItem()]),
    listComments: vi.fn(async () => [comment()]),
    listMentionCandidates: vi.fn(async () => [
      { userId: "writer-1" },
      { userId: "member-2" },
    ]),
    toggleChecklistItem: vi.fn(async (_scope, _taskId, item, completed) =>
      checklistItem({
        ...item,
        completedAt: completed ? "2026-10-21T11:00:00.000Z" : null,
      }),
    ),
    uploadAttachment: vi.fn(async () => attachment()),
  };
  const view = render(
    <TaskCollaborationPanel
      canWrite={canWrite}
      projectArchived={!canWrite}
      repository={repository}
      scope={scope}
      taskId="task-1"
    />,
  );
  return { repository, view };
}

describe("task collaboration panel", () => {
  it("lets the author edit/delete comments and limits mention choices to project members", async () => {
    const { repository } = setup();
    const comments = await screen.findByRole("region", {
      name: "Task comments",
    });
    expect(within(comments).getByLabelText("Mention member-2")).toBeTruthy();
    fireEvent.click(within(comments).getByLabelText("Mention member-2"));
    fireEvent.change(within(comments).getByLabelText("Comment"), {
      target: { value: "A useful update" },
    });
    fireEvent.click(
      within(comments).getByRole("button", { name: "Add comment" }),
    );
    await waitFor(() =>
      expect(repository.createComment).toHaveBeenCalledWith(scope, "task-1", {
        body: "A useful update",
        mentionedUserIds: ["member-2"],
      }),
    );

    fireEvent.click(
      within(comments).getByRole("button", { name: "Edit comment" }),
    );
    fireEvent.change(
      within(comments).getByLabelText("Edit comment comment-1"),
      {
        target: { value: "Edited update" },
      },
    );
    fireEvent.click(
      within(comments).getByRole("button", { name: "Save comment" }),
    );
    await waitFor(() => expect(repository.editComment).toHaveBeenCalled());

    fireEvent.click(
      within(comments).getByRole("button", { name: "Delete comment" }),
    );
    await waitFor(() =>
      expect(repository.deleteComment).toHaveBeenCalledWith(
        scope,
        "task-1",
        expect.objectContaining({ id: "comment-1" }),
      ),
    );
  });

  it("toggles checklist items without exposing task status mutation controls", async () => {
    const { repository } = setup();
    const checklist = await screen.findByRole("region", {
      name: "Task checklist",
    });
    fireEvent.click(
      within(checklist).getByLabelText("Complete Confirm deployment"),
    );
    await waitFor(() =>
      expect(repository.toggleChecklistItem).toHaveBeenCalledWith(
        scope,
        "task-1",
        expect.objectContaining({ id: "item-1" }),
        true,
      ),
    );
    expect(checklist.textContent).toContain(
      "Checklist changes do not change task status.",
    );
  });

  it("keeps viewer and archived-project collaboration read-only while retaining metadata", async () => {
    const { repository } = setup({ canWrite: false });
    const openWindow = vi.spyOn(window, "open").mockImplementation(() => null);
    expect(await screen.findByText(/archived.*read-only/i)).toBeTruthy();
    expect(screen.getByText("Original comment")).toBeTruthy();
    expect(screen.getByText("notes.txt")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open attachment" }));
    await waitFor(() =>
      expect(repository.getAttachmentUrl).toHaveBeenCalledWith(
        expect.objectContaining({ fileName: "notes.txt" }),
      ),
    );
    expect(openWindow).toHaveBeenCalledWith(
      "https://storage.example.test/signed",
      "_blank",
      "noopener,noreferrer",
    );
    expect(screen.queryByRole("button", { name: "Add comment" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Add checklist item" }),
    ).toBeNull();
    expect(screen.queryByLabelText("Upload attachment")).toBeNull();
    expect(repository.createComment).not.toHaveBeenCalled();
    openWindow.mockRestore();
  });

  it("renders deleted content as a safe history tombstone", () => {
    render(
      <ol>
        <TimelineEntry
          currentUserId="writer-1"
          event={taskEventFixture({
            eventType: "task.comment_deleted",
            payload: {
              version: 1,
              commentId: "comment-1",
              contentState: "redacted",
              body: "private comment body",
            },
          })}
        />
      </ol>,
    );
    expect(
      screen.getByText("Original content is not shown in history."),
    ).toBeTruthy();
    expect(screen.queryByText("private comment body")).toBeNull();
  });
});
