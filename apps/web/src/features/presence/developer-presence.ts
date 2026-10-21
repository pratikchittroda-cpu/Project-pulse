import {
  REALTIME_PRESENCE_LISTEN_EVENTS,
  REALTIME_SUBSCRIBE_STATES,
  type RealtimeChannel,
  type RealtimePresenceJoinPayload,
  type RealtimePresenceLeavePayload,
  type SupabaseClient,
} from "@supabase/supabase-js";

import { supabase } from "../../app/auth-client.js";

export const DEVELOPER_PRESENCE_ACTIVITIES = [
  "editing",
  "debugging",
  "testing",
  "reviewing",
  "building",
  "planning",
  "idle",
  "offline",
] as const;

export type DeveloperPresenceActivity =
  (typeof DEVELOPER_PRESENCE_ACTIVITIES)[number];
type LiveDeveloperPresenceActivity = Exclude<
  DeveloperPresenceActivity,
  "offline"
>;

export const DEFAULT_DEVELOPER_PRESENCE_EXPIRY_MS = 45_000;

export interface DeveloperPresenceScope {
  organizationId: string;
  projectId: string;
  userId: string;
}

/** Input fields accepted from an extension or editor integration. */
export interface PresenceFileInput {
  fileHash?: string | null;
  fileName?: string | null;
  filePath?: string | null;
}

/** The only file metadata that can cross the presence channel. */
export interface RedactedPresenceFile {
  fileExtension?: string;
  fileHash?: string;
  fileName?: string;
}

export interface DeveloperPresenceInput {
  activity: DeveloperPresenceActivity;
  branch?: string | null;
  file?: PresenceFileInput | RedactedPresenceFile | null;
  taskId?: string | null;
}

export type DeveloperPresenceUpdate = Partial<DeveloperPresenceInput>;

/**
 * Presence is deliberately scoped by both identifiers. The channel is private
 * and the authorizer is required at the join boundary so a caller cannot
 * silently move an authenticated user into another organization's stream.
 */
export interface DeveloperPresenceState {
  activity: LiveDeveloperPresenceActivity;
  branch: string | null;
  file?: RedactedPresenceFile;
  organizationId: string;
  projectId: string;
  taskId: string | null;
  userId: string;
}

export interface ActiveDeveloperPresence extends DeveloperPresenceState {
  /** Local receipt time; this is never sent over the channel. */
  lastSeenAt: number;
}

export type DeveloperPresenceStatus =
  | "error"
  | "idle"
  | "joining"
  | "joined"
  | "offline"
  | "paused"
  | "unauthorized";

export interface DeveloperPresenceSnapshot {
  developers: readonly ActiveDeveloperPresence[];
  status: DeveloperPresenceStatus;
}

export type DeveloperPresenceClient = Pick<
  SupabaseClient,
  "channel" | "removeChannel"
>;

export type DeveloperPresenceAuthorizer = (
  scope: DeveloperPresenceScope,
) => boolean | Promise<boolean>;

export interface DeveloperPresenceOptions {
  authorize?: DeveloperPresenceAuthorizer;
  client?: DeveloperPresenceClient;
  expiryMs?: number;
  isOnline?: () => boolean;
  now?: () => number;
  telemetryPaused?: boolean;
}

export type DeveloperPresenceJoinResult =
  | "joined"
  | "offline"
  | "paused"
  | "unauthorized";

export type DeveloperPresenceUpdateResult =
  | "not_joined"
  | "offline"
  | "paused"
  | "updated";

export interface DeveloperPresenceController {
  channelName: string;
  dispose: () => Promise<void>;
  getSnapshot: () => DeveloperPresenceSnapshot;
  join: (input: DeveloperPresenceInput) => Promise<DeveloperPresenceJoinResult>;
  leave: () => Promise<void>;
  setOffline: (offline: boolean) => Promise<void>;
  setTelemetryPaused: (paused: boolean) => Promise<void>;
  subscribe: (listener: () => void) => () => void;
  update: (
    input: DeveloperPresenceUpdate,
  ) => Promise<DeveloperPresenceUpdateResult>;
}

interface PresenceRecord {
  channelKey: string;
  lastSeenAt: number;
  presenceRef: string;
  state: DeveloperPresenceState;
}

type PresenceWireState = DeveloperPresenceState & {
  presence_ref?: string;
};

type PresenceJoin = RealtimePresenceJoinPayload<DeveloperPresenceState>;
type PresenceLeave = RealtimePresenceLeavePayload<DeveloperPresenceState>;

const LIVE_ACTIVITIES = new Set<LiveDeveloperPresenceActivity>([
  "editing",
  "debugging",
  "testing",
  "reviewing",
  "building",
  "planning",
  "idle",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function cleanText(value: unknown, maxLength = 160): string | null {
  if (typeof value !== "string") return null;
  const cleaned = [...value]
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join("")
    .trim();
  return cleaned ? cleaned.slice(0, maxLength) : null;
}

function cleanIdentifier(value: unknown) {
  return cleanText(value, 160);
}

function isLiveActivity(
  value: unknown,
): value is LiveDeveloperPresenceActivity {
  return (
    typeof value === "string" &&
    LIVE_ACTIVITIES.has(value as LiveDeveloperPresenceActivity)
  );
}

function safeFileName(value: unknown) {
  const candidate = cleanText(value, 160);
  if (!candidate) return undefined;
  const basename = candidate.split(/[\\/]/).at(-1)?.trim();
  if (!basename) return undefined;
  const redacted = basename.replace(/[^A-Za-z0-9._() -]/g, "_").slice(0, 120);
  return redacted || undefined;
}

function safeFileExtension(fileName: string | undefined) {
  const extension = fileName?.match(/\.([A-Za-z0-9]{1,16})$/)?.[1];
  return extension?.toLowerCase();
}

function safeFileHash(value: unknown) {
  if (typeof value !== "string" || !/^[a-f0-9]{16,128}$/i.test(value)) {
    return undefined;
  }
  return value.toLowerCase();
}

/**
 * Redacts a file reference to a basename, extension, and optional digest.
 * Full paths, source text, and editor buffers are intentionally discarded.
 */
export function redactPresenceFile(
  input: PresenceFileInput | RedactedPresenceFile | null | undefined,
): RedactedPresenceFile | undefined {
  if (!input) return undefined;
  const filePath = "filePath" in input ? input.filePath : undefined;
  const fileName = safeFileName(input.fileName ?? filePath);
  const fileHash = safeFileHash(input.fileHash);
  const redacted: RedactedPresenceFile = {};
  if (fileName) {
    redacted.fileName = fileName;
    redacted.fileExtension = safeFileExtension(fileName);
  }
  if (fileHash) redacted.fileHash = fileHash;
  return Object.keys(redacted).length ? redacted : undefined;
}

export function developerPresenceChannelName(
  scope: Pick<DeveloperPresenceScope, "organizationId" | "projectId">,
) {
  return `projectpulse:presence:${encodeURIComponent(scope.organizationId)}:${encodeURIComponent(scope.projectId)}`;
}

function validScope(scope: DeveloperPresenceScope) {
  return Boolean(
    cleanIdentifier(scope.organizationId) &&
      cleanIdentifier(scope.projectId) &&
      cleanIdentifier(scope.userId),
  );
}

function stateFromInput(
  scope: DeveloperPresenceScope,
  input: DeveloperPresenceInput,
): DeveloperPresenceState {
  if (!LIVE_ACTIVITIES.has(input.activity as LiveDeveloperPresenceActivity)) {
    throw new Error(
      input.activity === "offline"
        ? "Offline developers must leave the presence channel."
        : "Presence activity is not supported.",
    );
  }

  const branch = cleanText(input.branch);
  const taskId = cleanIdentifier(input.taskId);
  const file = redactPresenceFile(input.file);
  return {
    activity: input.activity as LiveDeveloperPresenceActivity,
    branch,
    ...(file ? { file } : {}),
    organizationId: scope.organizationId,
    projectId: scope.projectId,
    taskId,
    userId: scope.userId,
  };
}

function stateFromWire(
  scope: DeveloperPresenceScope,
  value: unknown,
): DeveloperPresenceState | null {
  if (!isRecord(value)) return null;
  if (
    value.organizationId !== scope.organizationId ||
    value.projectId !== scope.projectId ||
    typeof value.userId !== "string" ||
    !value.userId.trim() ||
    !isLiveActivity(value.activity)
  ) {
    return null;
  }

  const fileValue = isRecord(value.file)
    ? {
        fileHash:
          typeof value.file.fileHash === "string" ? value.file.fileHash : null,
        fileName:
          typeof value.file.fileName === "string" ? value.file.fileName : null,
      }
    : undefined;
  const file = redactPresenceFile(fileValue);
  return {
    activity: value.activity,
    branch: cleanText(value.branch),
    ...(file ? { file } : {}),
    organizationId: scope.organizationId,
    projectId: scope.projectId,
    taskId: cleanIdentifier(value.taskId),
    userId: cleanIdentifier(value.userId) ?? value.userId,
  };
}

function wirePresenceState(state: DeveloperPresenceState): PresenceWireState {
  return {
    activity: state.activity,
    branch: state.branch,
    ...(state.file ? { file: redactPresenceFile(state.file) } : {}),
    organizationId: state.organizationId,
    projectId: state.projectId,
    taskId: state.taskId,
    userId: state.userId,
  };
}

function responseError(action: string, response: string) {
  return new Error(`Could not ${action} developer presence (${response}).`);
}

export function createDeveloperPresence(
  scope: DeveloperPresenceScope,
  options: DeveloperPresenceOptions = {},
): DeveloperPresenceController {
  const client = options.client ?? supabase;
  const expiryMs = Math.max(
    1,
    Math.floor(options.expiryMs ?? DEFAULT_DEVELOPER_PRESENCE_EXPIRY_MS),
  );
  const now = options.now ?? (() => Date.now());
  const isOnline =
    options.isOnline ??
    (() => typeof navigator === "undefined" || navigator.onLine !== false);
  const channelName = developerPresenceChannelName(scope);
  const listeners = new Set<() => void>();
  const records = new Map<string, PresenceRecord>();
  let channel: RealtimeChannel | null = null;
  let currentState: DeveloperPresenceState | null = null;
  let expiryTimer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;
  let joined = false;
  let offline = false;
  let telemetryPaused = options.telemetryPaused ?? false;
  let snapshot: DeveloperPresenceSnapshot = {
    developers: [],
    status: telemetryPaused ? "paused" : "idle",
  };

  function notify() {
    snapshot = {
      developers: developersFromRecords(),
      status: snapshot.status,
    };
    for (const listener of listeners) listener();
  }

  function setStatus(status: DeveloperPresenceStatus) {
    snapshot = { ...snapshot, status };
    notify();
  }

  function clearExpiryTimer() {
    if (expiryTimer !== undefined) {
      clearTimeout(expiryTimer);
      expiryTimer = undefined;
    }
  }

  function developersFromRecords() {
    const latestByUser = new Map<string, ActiveDeveloperPresence>();
    const currentTime = now();
    for (const record of records.values()) {
      if (record.lastSeenAt + expiryMs <= currentTime) continue;
      const current = latestByUser.get(record.state.userId);
      if (!current || current.lastSeenAt <= record.lastSeenAt) {
        latestByUser.set(record.state.userId, {
          ...record.state,
          ...(record.state.file ? { file: { ...record.state.file } } : {}),
          lastSeenAt: record.lastSeenAt,
        });
      }
    }
    return [...latestByUser.values()].sort((left, right) =>
      left.userId.localeCompare(right.userId),
    );
  }

  function scheduleExpiry() {
    clearExpiryTimer();
    const nextExpiry = [...records.values()]
      .map((record) => record.lastSeenAt + expiryMs)
      .sort((left, right) => left - right)[0];
    if (nextExpiry === undefined) return;
    expiryTimer = setTimeout(
      () => {
        expiryTimer = undefined;
        const currentTime = now();
        let changed = false;
        for (const [recordId, record] of records) {
          if (record.lastSeenAt + expiryMs <= currentTime) {
            records.delete(recordId);
            changed = true;
          }
        }
        if (changed) notify();
        scheduleExpiry();
      },
      Math.max(1, nextExpiry - now()),
    );
  }

  function recordPresence(
    channelKey: string,
    value: unknown,
    fallbackRef: string,
  ) {
    const state = stateFromWire(scope, value);
    if (!state) return false;
    const presenceRef =
      isRecord(value) && typeof value.presence_ref === "string"
        ? value.presence_ref
        : fallbackRef;
    records.set(`${channelKey}:${presenceRef}`, {
      channelKey,
      lastSeenAt: now(),
      presenceRef,
      state,
    });
    return true;
  }

  function recordSelf(state: DeveloperPresenceState) {
    recordPresence(scope.userId, { ...state, presence_ref: "self" }, "self");
  }

  function removePresence(channelKey: string, presences: readonly unknown[]) {
    const refs = new Set(
      presences.flatMap((presence) =>
        isRecord(presence) && typeof presence.presence_ref === "string"
          ? [presence.presence_ref]
          : [],
      ),
    );
    let changed = false;
    for (const [recordId, record] of records) {
      if (
        record.channelKey === channelKey &&
        (refs.size === 0 || refs.has(record.presenceRef))
      ) {
        records.delete(recordId);
        changed = true;
      }
    }
    return changed;
  }

  function handleSync(currentChannel: RealtimeChannel) {
    records.clear();
    let index = 0;
    try {
      const state = currentChannel.presenceState<DeveloperPresenceState>();
      for (const [channelKey, presences] of Object.entries(state)) {
        for (const presence of presences) {
          recordPresence(channelKey, presence, `sync-${index}`);
          index += 1;
        }
      }
    } catch {
      setStatus("error");
      return;
    }
    notify();
    scheduleExpiry();
  }

  function handleJoin(payload: PresenceJoin) {
    let changed = false;
    payload.newPresences.forEach((presence, index) => {
      changed =
        recordPresence(payload.key, presence, `join-${index}`) || changed;
    });
    if (changed) notify();
    scheduleExpiry();
  }

  function handleLeave(payload: PresenceLeave) {
    if (removePresence(payload.key, payload.leftPresences)) notify();
    scheduleExpiry();
  }

  async function releaseChannel(
    currentChannel: RealtimeChannel | null,
    shouldUntrack: boolean,
  ) {
    if (!currentChannel) return;
    if (channel === currentChannel) {
      channel = null;
      joined = false;
    }
    if (shouldUntrack) {
      try {
        await currentChannel.untrack();
      } catch {
        // Presence is ephemeral; cleanup remains best effort.
      }
    }
    try {
      await client.removeChannel(currentChannel);
    } catch {
      // The client may already have closed the channel.
    }
  }

  function clearRecords() {
    records.clear();
    clearExpiryTimer();
  }

  function connectionFailure(
    currentChannel: RealtimeChannel,
    status: "error" | "offline",
    error?: Error,
  ) {
    void releaseChannel(currentChannel, false);
    currentState = null;
    clearRecords();
    if (status === "offline") offline = true;
    setStatus(status);
    return error ?? new Error("Developer presence channel is unavailable.");
  }

  async function join(
    input: DeveloperPresenceInput,
  ): Promise<DeveloperPresenceJoinResult> {
    if (disposed) return "offline";
    if (telemetryPaused) {
      await leave();
      setStatus("paused");
      return "paused";
    }
    if (input.activity === "offline") {
      await leave();
      offline = true;
      setStatus("offline");
      return "offline";
    }
    if (!isOnline()) {
      await leave();
      offline = true;
      setStatus("offline");
      return "offline";
    }
    if (!validScope(scope)) {
      clearRecords();
      setStatus("unauthorized");
      return "unauthorized";
    }

    let authorized = false;
    try {
      authorized = options.authorize ? await options.authorize(scope) : false;
    } catch {
      authorized = false;
    }
    if (!authorized || telemetryPaused) {
      await leave();
      setStatus(telemetryPaused ? "paused" : "unauthorized");
      return telemetryPaused ? "paused" : "unauthorized";
    }

    const nextState = stateFromInput(scope, input);
    if (joined && channel) {
      const updateResult = await update(input);
      if (updateResult === "updated") return "joined";
      if (updateResult === "paused" || updateResult === "offline") {
        return updateResult;
      }
      return "offline";
    }

    offline = false;
    clearRecords();
    currentState = nextState;
    setStatus("joining");
    const currentChannel = client.channel(channelName, {
      config: {
        presence: { enabled: true, key: scope.userId },
        private: true,
      },
    });
    channel = currentChannel;

    currentChannel.on(
      "presence",
      { event: REALTIME_PRESENCE_LISTEN_EVENTS.SYNC },
      () => handleSync(currentChannel),
    );
    currentChannel.on<DeveloperPresenceState>(
      "presence",
      { event: REALTIME_PRESENCE_LISTEN_EVENTS.JOIN },
      (payload) => handleJoin(payload),
    );
    currentChannel.on<DeveloperPresenceState>(
      "presence",
      { event: REALTIME_PRESENCE_LISTEN_EVENTS.LEAVE },
      (payload) => handleLeave(payload),
    );

    return new Promise<DeveloperPresenceJoinResult>((resolve, reject) => {
      let settled = false;
      currentChannel.subscribe((status, error) => {
        if (settled) {
          if (
            status === REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR ||
            status === REALTIME_SUBSCRIBE_STATES.TIMED_OUT ||
            status === REALTIME_SUBSCRIBE_STATES.CLOSED
          ) {
            connectionFailure(
              currentChannel,
              status === REALTIME_SUBSCRIBE_STATES.TIMED_OUT ||
                status === REALTIME_SUBSCRIBE_STATES.CLOSED
                ? "offline"
                : "error",
              error,
            );
          }
          return;
        }
        if (status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) {
          void currentChannel
            .track(wirePresenceState(nextState))
            .then((response) => {
              if (response !== "ok") {
                settled = true;
                reject(responseError("publish", response));
                void releaseChannel(currentChannel, false);
                currentState = null;
                clearRecords();
                setStatus("error");
                return;
              }
              settled = true;
              joined = true;
              currentState = nextState;
              recordSelf(nextState);
              setStatus("joined");
              scheduleExpiry();
              resolve("joined");
            })
            .catch((cause: unknown) => {
              settled = true;
              void releaseChannel(currentChannel, false);
              currentState = null;
              clearRecords();
              setStatus("error");
              reject(
                cause instanceof Error
                  ? cause
                  : new Error("Could not publish developer presence."),
              );
            });
          return;
        }
        if (
          status === REALTIME_SUBSCRIBE_STATES.TIMED_OUT ||
          status === REALTIME_SUBSCRIBE_STATES.CLOSED
        ) {
          settled = true;
          connectionFailure(currentChannel, "offline", error);
          resolve("offline");
          return;
        }
        if (status === REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR) {
          settled = true;
          const cause = connectionFailure(currentChannel, "error", error);
          reject(cause);
        }
      });
    });
  }

  async function update(
    input: DeveloperPresenceUpdate,
  ): Promise<DeveloperPresenceUpdateResult> {
    if (input.activity === "offline") {
      await leave();
      offline = true;
      setStatus("offline");
      return "offline";
    }
    if (telemetryPaused) {
      await leave();
      setStatus("paused");
      return "paused";
    }
    if (!joined || !channel || !currentState) {
      return offline ? "offline" : "not_joined";
    }

    const nextState = stateFromInput(scope, {
      activity: input.activity ?? currentState.activity,
      branch: input.branch === undefined ? currentState.branch : input.branch,
      file: "file" in input ? input.file : currentState.file,
      taskId: input.taskId === undefined ? currentState.taskId : input.taskId,
    });
    const response = await channel.track(wirePresenceState(nextState));
    if (response !== "ok") throw responseError("update", response);
    currentState = nextState;
    recordSelf(nextState);
    setStatus("joined");
    scheduleExpiry();
    return "updated";
  }

  async function leave() {
    const currentChannel = channel;
    currentState = null;
    offline = false;
    clearRecords();
    await releaseChannel(currentChannel, joined);
    joined = false;
    if (!telemetryPaused) snapshot = { ...snapshot, status: "idle" };
    notify();
  }

  async function setTelemetryPaused(paused: boolean) {
    telemetryPaused = paused;
    if (paused) {
      await leave();
      setStatus("paused");
      return;
    }
    if (snapshot.status === "paused") setStatus("idle");
  }

  async function setOffline(offlineState: boolean) {
    offline = offlineState;
    if (offlineState) {
      await leave();
      offline = true;
      setStatus("offline");
      return;
    }
    if (snapshot.status === "offline") setStatus("idle");
  }

  async function dispose() {
    if (disposed) return;
    disposed = true;
    await leave();
    listeners.clear();
  }

  return {
    channelName,
    dispose,
    getSnapshot: () => snapshot,
    join,
    leave,
    setOffline,
    setTelemetryPaused,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    update,
  };
}
