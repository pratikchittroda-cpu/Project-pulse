import { describe, expect, it, vi } from "vitest";

import {
  createNotificationDelivery,
  createNotificationRealtimeSubscription,
  notificationRealtimeChannelName,
  notificationRealtimeFilter,
  type NotificationRealtimeClient,
} from "../apps/web/src/features/notifications/notification-realtime.js";
import type {
  NotificationRealtimeRow,
  NotificationScope,
} from "../apps/web/src/features/notifications/notification-repository.js";

type Payload = {
  commit_timestamp: string;
  errors: string[];
  eventType: "DELETE" | "INSERT" | "UPDATE";
  new: NotificationRealtimeRow;
  old: Partial<NotificationRealtimeRow>;
  schema: string;
  table: string;
};
type SubscriptionStatus =
  | "CHANNEL_ERROR"
  | "CLOSED"
  | "SUBSCRIBED"
  | "TIMED_OUT";

const scope: NotificationScope = {
  organizationId: "organization-1",
  projectId: "project-1",
  userId: "recipient-1",
};

function row(
  overrides: Partial<NotificationRealtimeRow> = {},
): NotificationRealtimeRow {
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
    client: client as unknown as NotificationRealtimeClient,
  };
}

function insertPayload(next = row()): Payload {
  return {
    commit_timestamp: next.created_at,
    errors: [],
    eventType: "INSERT",
    new: next,
    old: {},
    schema: "public",
    table: "notifications",
  };
}

describe("recipient-scoped notification realtime", () => {
  it("uses Supabase v2 filters, drops other recipients, and deduplicates deliveries", () => {
    const fake = fakeClient();
    const onChange = vi.fn();
    const unsubscribe = createNotificationRealtimeSubscription(
      fake.client,
    ).subscribe(scope, { onChange, onResync: vi.fn() });
    const channel = fake.channel();

    expect(fake.client.channel).toHaveBeenCalledWith(
      notificationRealtimeChannelName(scope),
    );
    expect(channel.filter).toEqual({
      event: "*",
      filter: notificationRealtimeFilter(scope),
      schema: "public",
      table: "notifications",
    });
    const inserted = insertPayload();
    channel.emit(inserted);
    channel.emit(inserted);
    channel.emit(
      insertPayload(
        row({ id: "other-recipient", recipient_user_id: "other-user" }),
      ),
    );
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0].notification.recipientUserId).toBe(
      "recipient-1",
    );
    unsubscribe();
    channel.emit(insertPayload(row({ id: "after-unsubscribe" })));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(fake.client.removeChannel).toHaveBeenCalledOnce();
  });

  it("retrieves after realtime failure/reconnect and supports a null delivery fallback", async () => {
    const fake = fakeClient();
    const onResync = vi.fn();
    createNotificationRealtimeSubscription(fake.client).subscribe(scope, {
      onChange: vi.fn(),
      onResync,
    });
    const channel = fake.channel();
    channel.status("CHANNEL_ERROR");
    channel.status("SUBSCRIBED");
    expect(onResync).toHaveBeenCalledTimes(2);

    const retrieve = vi.fn(async () => undefined);
    const delivery = createNotificationDelivery(null, retrieve);
    const unsubscribe = delivery.subscribe(scope, { onChange: vi.fn() });
    unsubscribe();
    await Promise.resolve();
    expect(retrieve).toHaveBeenCalledWith(scope);
  });
});
