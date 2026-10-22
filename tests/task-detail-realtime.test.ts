import { describe, expect, it, vi } from "vitest";

import {
  createTaskDetailRealtimeSubscription,
  taskDetailRealtimeChannelName,
  type TaskDetailRealtimeClient,
} from "../apps/web/src/features/realtime/task-detail-realtime.js";

type Handler = (payload: Record<string, unknown>) => void;

class FakeChannel {
  readonly handlers: Handler[] = [];
  private statusHandler:
    | ((status: "CHANNEL_ERROR" | "CLOSED" | "SUBSCRIBED") => void)
    | undefined;

  on(_type: string, _filter: unknown, handler: Handler) {
    this.handlers.push(handler);
    return this;
  }

  subscribe(
    handler: (status: "CHANNEL_ERROR" | "CLOSED" | "SUBSCRIBED") => void,
  ) {
    this.statusHandler = handler;
    return this;
  }

  status(status: "CHANNEL_ERROR" | "CLOSED" | "SUBSCRIBED") {
    this.statusHandler?.(status);
  }

  emit(payload: Record<string, unknown>) {
    for (const handler of this.handlers) handler(payload);
  }
}

const scope = {
  organizationId: "organization-1",
  projectId: "project-1",
  taskId: "task-1",
};

function payload(
  table: string,
  eventType: "DELETE" | "INSERT" | "UPDATE",
  row: Record<string, unknown>,
) {
  return {
    commit_timestamp: "2026-10-22T10:00:00.000Z",
    eventType,
    new: eventType === "DELETE" ? {} : row,
    old: eventType === "INSERT" ? {} : row,
    schema: "public",
    table,
  };
}

describe("task detail realtime subscription", () => {
  it("subscribes to task detail tables and filters unrelated records", () => {
    const channel = new FakeChannel();
    const client = {
      channel: vi.fn(() => channel),
      removeChannel: vi.fn(async () => "ok"),
    } as unknown as TaskDetailRealtimeClient;
    const onChange = vi.fn();
    const subscription = createTaskDetailRealtimeSubscription(client);
    const unsubscribe = subscription.subscribe(scope, {
      onChange,
      onResync: vi.fn(),
    });

    expect(client.channel).toHaveBeenCalledWith(
      taskDetailRealtimeChannelName(scope),
    );
    expect(channel.handlers).toHaveLength(7);

    channel.emit(
      payload("comments", "INSERT", {
        id: "comment-1",
        organization_id: scope.organizationId,
        project_id: scope.projectId,
        task_id: scope.taskId,
      }),
    );
    channel.emit(
      payload("comments", "INSERT", {
        id: "comment-2",
        organization_id: scope.organizationId,
        project_id: scope.projectId,
        task_id: "other-task",
      }),
    );
    channel.emit(
      payload("task_relations", "UPDATE", {
        id: "relation-1",
        organization_id: scope.organizationId,
        project_id: scope.projectId,
        task_id: "other-task",
        related_task_id: scope.taskId,
      }),
    );

    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenNthCalledWith(1, {
      eventType: "INSERT",
      recordId: "comment-1",
      table: "comments",
    });
    expect(onChange).toHaveBeenNthCalledWith(2, {
      eventType: "UPDATE",
      recordId: "relation-1",
      table: "task_relations",
    });

    unsubscribe();
    expect(client.removeChannel).toHaveBeenCalledWith(channel);
  });

  it("resynchronizes after a reconnect and ignores duplicate delivery", () => {
    const channel = new FakeChannel();
    const client = {
      channel: vi.fn(() => channel),
      removeChannel: vi.fn(async () => "ok"),
    } as unknown as TaskDetailRealtimeClient;
    const onChange = vi.fn();
    const onResync = vi.fn();
    createTaskDetailRealtimeSubscription(client).subscribe(scope, {
      onChange,
      onResync,
    });

    channel.status("SUBSCRIBED");
    channel.status("CLOSED");
    channel.status("SUBSCRIBED");
    expect(onResync).toHaveBeenCalledTimes(2);

    const row = {
      id: "event-1",
      organization_id: scope.organizationId,
      project_id: scope.projectId,
      task_id: scope.taskId,
    };
    channel.emit(payload("task_events", "INSERT", row));
    channel.emit(payload("task_events", "INSERT", row));
    expect(onChange).toHaveBeenCalledOnce();
  });
});
