import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createDeveloperPresence,
  developerPresenceChannelName,
  type DeveloperPresenceClient,
  type DeveloperPresenceScope,
  type DeveloperPresenceState,
  type PresenceFileInput,
} from "../apps/web/src/features/presence/developer-presence.js";

type PresenceStatus = "CHANNEL_ERROR" | "CLOSED" | "SUBSCRIBED" | "TIMED_OUT";

const scope: DeveloperPresenceScope = {
  organizationId: "organization-1",
  projectId: "project-1",
  userId: "user-1",
};

class FakePresenceChannel {
  readonly name: string;
  readonly options: unknown;
  readonly track = vi.fn(async () => "ok" as const);
  readonly untrack = vi.fn(async () => "ok" as const);
  private readonly handlers = new Map<
    string,
    ((payload?: unknown) => void)[]
  >();
  private readonly presence: Record<
    string,
    Array<DeveloperPresenceState & { presence_ref: string }>
  > = {};
  private subscription:
    | ((status: PresenceStatus, error?: Error) => void)
    | undefined;

  constructor(name: string, options: unknown) {
    this.name = name;
    this.options = options;
  }

  on(
    _type: string,
    filter: { event: string },
    callback: (payload?: unknown) => void,
  ) {
    const callbacks = this.handlers.get(filter.event) ?? [];
    callbacks.push(callback);
    this.handlers.set(filter.event, callbacks);
    return this;
  }

  subscribe(callback: (status: PresenceStatus, error?: Error) => void) {
    this.subscription = callback;
    return this;
  }

  presenceState() {
    return this.presence;
  }

  status(status: PresenceStatus, error?: Error) {
    this.subscription?.(status, error);
  }

  emitSync(
    entries: Array<DeveloperPresenceState & { presence_ref: string }>,
    key = "remote-user",
  ) {
    this.presence[key] = entries;
    for (const callback of this.handlers.get("sync") ?? []) callback();
  }

  emitJoin(
    entries: Array<DeveloperPresenceState & { presence_ref: string }>,
    key = "remote-user",
  ) {
    for (const callback of this.handlers.get("join") ?? []) {
      callback({
        currentPresences: [],
        event: "join",
        key,
        newPresences: entries,
      });
    }
  }

  emitLeave(
    entries: Array<DeveloperPresenceState & { presence_ref: string }>,
    key = "remote-user",
  ) {
    for (const callback of this.handlers.get("leave") ?? []) {
      callback({
        currentPresences: [],
        event: "leave",
        key,
        leftPresences: entries,
      });
    }
  }
}

function fakeClient() {
  let currentChannel: FakePresenceChannel | undefined;
  const client = {
    channel: vi.fn((name: string, options: unknown) => {
      currentChannel = new FakePresenceChannel(name, options);
      return currentChannel;
    }),
    removeChannel: vi.fn(async () => "ok"),
  };
  return {
    channel: () => {
      if (!currentChannel) throw new Error("The fake channel was not created.");
      return currentChannel;
    },
    client: client as unknown as DeveloperPresenceClient,
  };
}

function state(
  overrides: Partial<DeveloperPresenceState> = {},
): DeveloperPresenceState {
  return {
    activity: "editing",
    branch: "feature/presence",
    organizationId: scope.organizationId,
    projectId: scope.projectId,
    taskId: "task-1",
    userId: "user-2",
    ...overrides,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("developer presence", () => {
  it("joins, updates, and leaves a private project-scoped channel", async () => {
    const fake = fakeClient();
    const presence = createDeveloperPresence(scope, {
      authorize: vi.fn(
        async (candidate) => candidate.organizationId === scope.organizationId,
      ),
      client: fake.client,
    });
    const join = presence.join({
      activity: "editing",
      branch: "feature/presence",
      taskId: "task-1",
    });
    await Promise.resolve();
    const channel = fake.channel();
    channel.status("SUBSCRIBED");

    await expect(join).resolves.toBe("joined");
    expect(fake.client.channel).toHaveBeenCalledWith(
      developerPresenceChannelName(scope),
      {
        config: {
          presence: { enabled: true, key: scope.userId },
          private: true,
        },
      },
    );
    expect(channel.track).toHaveBeenCalledWith(
      expect.objectContaining({
        activity: "editing",
        organizationId: scope.organizationId,
        projectId: scope.projectId,
        taskId: "task-1",
        userId: scope.userId,
      }),
    );

    await expect(
      presence.update({ activity: "reviewing", taskId: "task-2" }),
    ).resolves.toBe("updated");
    expect(channel.track).toHaveBeenLastCalledWith(
      expect.objectContaining({
        activity: "reviewing",
        taskId: "task-2",
      }),
    );

    await presence.leave();
    expect(channel.untrack).toHaveBeenCalledOnce();
    expect(fake.client.removeChannel).toHaveBeenCalledOnce();
    expect(presence.getSnapshot().developers).toEqual([]);
  });

  it("expires stale remote developers and removes them on leave", async () => {
    vi.useFakeTimers();
    let currentTime = 1_000;
    const fake = fakeClient();
    const presence = createDeveloperPresence(scope, {
      authorize: () => true,
      client: fake.client,
      expiryMs: 1_000,
      now: () => currentTime,
    });
    const join = presence.join({ activity: "idle" });
    await Promise.resolve();
    const channel = fake.channel();
    channel.status("SUBSCRIBED");
    await join;

    const remote = state({ userId: "user-2" });
    channel.emitJoin([{ ...remote, presence_ref: "remote-ref" }]);
    expect(
      presence.getSnapshot().developers.map(({ userId }) => userId),
    ).toEqual(["user-1", "user-2"]);

    channel.emitLeave([{ ...remote, presence_ref: "remote-ref" }]);
    expect(
      presence.getSnapshot().developers.map(({ userId }) => userId),
    ).toEqual(["user-1"]);

    channel.emitJoin([{ ...remote, presence_ref: "remote-ref" }]);
    currentTime = 2_001;
    vi.advanceTimersByTime(1_001);
    expect(presence.getSnapshot().developers).toEqual([]);
  });

  it("rejects a cross-organization join before creating a channel", async () => {
    const fake = fakeClient();
    const authorize = vi.fn(
      (candidate: DeveloperPresenceScope) =>
        candidate.organizationId === scope.organizationId &&
        candidate.projectId === scope.projectId,
    );
    const presence = createDeveloperPresence(
      { ...scope, organizationId: "other-organization" },
      { authorize, client: fake.client },
    );

    await expect(presence.join({ activity: "editing" })).resolves.toBe(
      "unauthorized",
    );
    expect(authorize).toHaveBeenCalledWith({
      organizationId: "other-organization",
      projectId: scope.projectId,
      userId: scope.userId,
    });
    expect(fake.client.channel).not.toHaveBeenCalled();
  });

  it("does not create or retain presence while telemetry is paused", async () => {
    const fake = fakeClient();
    const presence = createDeveloperPresence(scope, {
      authorize: () => true,
      client: fake.client,
      telemetryPaused: true,
    });

    await expect(presence.join({ activity: "editing" })).resolves.toBe(
      "paused",
    );
    expect(fake.client.channel).not.toHaveBeenCalled();
    expect(presence.getSnapshot()).toMatchObject({
      developers: [],
      status: "paused",
    });

    await presence.setTelemetryPaused(false);
    expect(presence.getSnapshot().status).toBe("idle");
  });

  it("redacts file inputs and never tracks source content or full paths", async () => {
    const fake = fakeClient();
    const presence = createDeveloperPresence(scope, {
      authorize: () => true,
      client: fake.client,
    });
    const unsafeFile: PresenceFileInput & { sourceContent?: string } = {
      fileHash: "ABCDEF0123456789",
      fileName: "../../src/secret.ts",
      filePath: "/Users/developer/project/src/secret.ts",
      sourceContent: "const token = 'do-not-send';",
    };
    const join = presence.join({
      activity: "editing",
      file: unsafeFile,
    });
    await Promise.resolve();
    const channel = fake.channel();
    channel.status("SUBSCRIBED");
    await join;

    const tracked = channel.track.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(JSON.stringify(tracked)).not.toContain("/Users/developer/project");
    expect(JSON.stringify(tracked)).not.toContain("do-not-send");
    expect(tracked).not.toHaveProperty("sourceContent");
    expect(tracked).not.toHaveProperty("filePath");
    expect(tracked.file).toEqual({
      fileExtension: "ts",
      fileHash: "abcdef0123456789",
      fileName: "secret.ts",
    });
  });

  it("clears active developers when the realtime channel goes offline", async () => {
    const fake = fakeClient();
    const presence = createDeveloperPresence(scope, {
      authorize: () => true,
      client: fake.client,
    });
    const join = presence.join({ activity: "editing" });
    await Promise.resolve();
    const channel = fake.channel();
    channel.status("SUBSCRIBED");
    await join;

    channel.status("TIMED_OUT");
    expect(presence.getSnapshot()).toMatchObject({
      developers: [],
      status: "offline",
    });
    expect(fake.client.removeChannel).toHaveBeenCalledOnce();
  });
});
