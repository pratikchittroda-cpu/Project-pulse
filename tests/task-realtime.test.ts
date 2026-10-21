import { describe, expect, it, vi } from "vitest";

import {
  createTaskRealtimeSubscription,
  taskRealtimeChannelName,
  taskRealtimeFilter,
  type TaskRealtimeClient,
} from "../apps/web/src/features/board/task-realtime.js";
import type {
  TaskRealtimeRow,
  TaskScope,
} from "../apps/web/src/features/tasks/task-repository.js";

type Payload = {
  commit_timestamp: string;
  errors: string[];
  eventType: "DELETE" | "INSERT" | "UPDATE";
  new: TaskRealtimeRow;
  old: Partial<TaskRealtimeRow>;
  schema: string;
  table: string;
};
type SubscriptionStatus = "CHANNEL_ERROR" | "SUBSCRIBED" | "TIMED_OUT";

const scope: TaskScope = {
  organizationId: "organization-1",
  projectId: "project-1",
  projectKey: "SHIP",
  userId: "user-1",
};

function row(overrides: Partial<TaskRealtimeRow> = {}): TaskRealtimeRow {
  return {
    archived_at: null,
    assignee_id: null,
    cycle_id: null,
    description: "A realtime task",
    due_date: null,
    epic_id: null,
    estimate: null,
    id: "task-1",
    labels: [],
    milestone_id: null,
    organization_id: scope.organizationId,
    priority: "medium",
    project_id: scope.projectId,
    status: "backlog",
    task_number: 42,
    title: "Realtime task",
    updated_at: "2026-10-21T10:00:00.000Z",
    ...overrides,
  };
}

function insertPayload(next = row()): Payload {
  return {
    commit_timestamp: next.updated_at ?? "2026-10-21T10:00:00.000Z",
    errors: [],
    eventType: "INSERT",
    new: next,
    old: {},
    schema: "public",
    table: "tasks",
  };
}

function updatePayload(next = row(), previous = row()): Payload {
  return {
    commit_timestamp: next.updated_at ?? "2026-10-21T10:00:00.000Z",
    errors: [],
    eventType: "UPDATE",
    new: next,
    old: previous,
    schema: "public",
    table: "tasks",
  };
}

function deletePayload(previous = row()): Payload {
  return {
    commit_timestamp: previous.updated_at ?? "2026-10-21T10:00:00.000Z",
    errors: [],
    eventType: "DELETE",
    new: {},
    old: previous,
    schema: "public",
    table: "tasks",
  };
}

class FakeChannel {
  callback: ((payload: Payload) => void) | undefined;
  filter: Record<string, string> | undefined;
  statusCallback: ((status: SubscriptionStatus) => void) | undefined;

  constructor(readonly name: string) {}

  on(
    _type: string,
    filter: Record<string, string>,
    callback: (payload: Payload) => void,
  ) {
    this.filter = filter;
    this.callback = callback;
    return this;
  }

  subscribe(callback: (status: SubscriptionStatus) => void) {
    this.statusCallback = callback;
    return this;
  }

  emit(payload: Payload) {
    this.callback?.(payload);
  }

  status(status: SubscriptionStatus) {
    this.statusCallback?.(status);
  }
}

function fakeClient() {
  let channel: FakeChannel | undefined;
  const client = {
    channel: vi.fn((name: string) => {
      channel = new FakeChannel(name);
      return channel;
    }),
    removeChannel: vi.fn(async () => "ok"),
  };
  return {
    channel: () => {
      if (!channel) throw new Error("The fake channel was not created.");
      return channel;
    },
    client: client as unknown as TaskRealtimeClient,
  };
}

describe("project-scoped task realtime subscription", () => {
  it("subscribes with tenant filters and applies each scoped change once", () => {
    const fake = fakeClient();
    const onChange = vi.fn();
    const unsubscribe = createTaskRealtimeSubscription(fake.client).subscribe(
      scope,
      { onChange, onResync: vi.fn() },
    );
    const channel = fake.channel();

    expect(fake.client.channel).toHaveBeenCalledWith(
      taskRealtimeChannelName(scope),
    );
    expect(channel.filter).toEqual({
      event: "*",
      filter: taskRealtimeFilter(scope),
      schema: "public",
      table: "tasks",
    });

    const inserted = insertPayload();
    channel.emit(inserted);
    channel.emit(inserted);
    channel.emit(
      insertPayload({
        ...row(),
        id: "private-task",
        organization_id: "other-organization",
      }),
    );
    channel.emit(
      insertPayload({
        ...row(),
        id: "other-project-task",
        project_id: "other-project",
      }),
    );
    channel.emit(
      updatePayload({
        ...row(),
        status: "in_progress",
        updated_at: "2026-10-21T10:01:00.000Z",
      }),
    );
    const deleted = deletePayload({
      id: row().id,
      updated_at: "2026-10-21T10:02:00.000Z",
    });
    channel.emit(deleted);
    channel.emit(deleted);
    channel.emit(
      updatePayload({
        ...row(),
        status: "in_progress",
        updated_at: "2026-10-21T10:01:00.000Z",
      }),
    );

    expect(onChange).toHaveBeenCalledTimes(3);
    expect(onChange.mock.calls.map(([change]) => change.eventType)).toEqual([
      "INSERT",
      "UPDATE",
      "DELETE",
    ]);
    expect(onChange.mock.calls[0]?.[0].task.key).toBe("SHIP-42");
    expect(onChange.mock.calls[2]?.[0].task).toBeNull();

    unsubscribe();
    expect(fake.client.removeChannel).toHaveBeenCalledTimes(1);
    channel.emit(
      updatePayload({
        ...row(),
        updated_at: "2026-10-21T10:02:00.000Z",
      }),
    );
    expect(onChange).toHaveBeenCalledTimes(3);
  });

  it("resyncs after a channel reconnect without resyncing the first join", () => {
    const fake = fakeClient();
    const onResync = vi.fn();
    createTaskRealtimeSubscription(fake.client).subscribe(scope, {
      onChange: vi.fn(),
      onResync,
    });
    const channel = fake.channel();

    channel.status("SUBSCRIBED");
    expect(onResync).not.toHaveBeenCalled();
    channel.status("CHANNEL_ERROR");
    channel.status("SUBSCRIBED");
    expect(onResync).toHaveBeenCalledTimes(1);
    channel.status("CHANNEL_ERROR");
    channel.status("SUBSCRIBED");
    expect(onResync).toHaveBeenCalledTimes(2);
    channel.status("TIMED_OUT");
    channel.status("SUBSCRIBED");
    expect(onResync).toHaveBeenCalledTimes(3);
  });
});
