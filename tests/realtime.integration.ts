import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createSupabaseClient } from "../apps/web/src/app/auth-client.js";
import { createDeveloperPresence } from "../apps/web/src/features/presence/developer-presence.js";

const container =
  process.env.SUPABASE_DB_CONTAINER ?? "supabase_db_projectpulse";
const organizationId = randomUUID();
const projectId = randomUUID();
const taskId = randomUUID();
const password = `${randomUUID()}Aa1!`;
const users: { id: string; email: string }[] = [];
let apiUrl = "";
let anonKey = "";
let serviceKey = "";
type SupabaseTestClient = ReturnType<typeof createSupabaseClient>;
type RealtimeChannelLike = {
  subscribe: (callback: (status: string, error?: Error) => void) => unknown;
};
let writer: SupabaseTestClient | undefined;
let recipient: SupabaseTestClient | undefined;

function sql(input: string) {
  const result = spawnSync(
    "docker",
    [
      "exec",
      "--interactive",
      container,
      "psql",
      "-X",
      "-qAt",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
    ],
    { input, encoding: "utf8", timeout: 15_000 },
  );
  if (result.error || result.status !== 0) {
    throw new Error(result.error?.message ?? result.stderr);
  }
  return result.stdout.trim();
}

async function serviceRequest(path: string, method: string, body?: object) {
  const response = await fetch(`${apiUrl}${path}`, {
    method,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(
      `Realtime integration request ${method} ${path.split("?")[0]} failed: HTTP ${response.status}`,
    );
  }
  return response;
}

async function waitFor(
  condition: () => boolean,
  message: string,
  timeoutMs = 8_000,
) {
  const deadline = Date.now() + timeoutMs;
  while (!condition() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!condition()) throw new Error(message);
}

async function subscribe(channel: RealtimeChannelLike) {
  await new Promise<void>((resolve, reject) => {
    channel.subscribe((status, error) => {
      if (status === "SUBSCRIBED") resolve();
      if (
        status === "CHANNEL_ERROR" ||
        status === "TIMED_OUT" ||
        status === "CLOSED"
      ) {
        reject(error ?? new Error(`Realtime subscription ended: ${status}`));
      }
    });
  });
}

beforeAll(async () => {
  const status = spawnSync(
    "corepack",
    ["pnpm", "exec", "supabase", "status", "--output", "json"],
    { encoding: "utf8", timeout: 15_000 },
  );
  if (status.error || status.status !== 0) {
    throw new Error(
      "Local Supabase is required for realtime integration tests.",
    );
  }
  const configuration = JSON.parse(
    status.stdout.slice(status.stdout.indexOf("{")),
  ) as Record<string, string>;
  apiUrl = configuration.API_URL;
  if (!["127.0.0.1", "localhost", "[::1]"].includes(new URL(apiUrl).hostname)) {
    throw new Error("Realtime fixtures may only run against local Supabase.");
  }
  anonKey = configuration.ANON_KEY;
  serviceKey = configuration.SERVICE_ROLE_KEY;

  for (const label of ["writer", "recipient"]) {
    const email = `realtime-${label}-${randomUUID()}@example.test`;
    const response = await serviceRequest("/auth/v1/admin/users", "POST", {
      email,
      password,
      email_confirm: true,
    });
    const user = (await response.json()) as { id: string };
    users.push({ id: user.id, email });
  }

  sql(`begin;
    insert into public.organizations (id, name, slug)
    values ('${organizationId}', 'Realtime integration organization', 'realtime-${organizationId}');
    insert into public.organization_memberships (organization_id, user_id, role)
    values
      ('${organizationId}', '${users[0].id}', 'member'),
      ('${organizationId}', '${users[1].id}', 'member');
    insert into public.projects (id, organization_id, name, project_key)
    values ('${projectId}', '${organizationId}', 'Realtime integration project', 'RINT');
    insert into public.project_memberships (organization_id, project_id, user_id, role)
    values
      ('${organizationId}', '${projectId}', '${users[0].id}', 'member'),
      ('${organizationId}', '${projectId}', '${users[1].id}', 'member');
    insert into public.tasks (id, organization_id, project_id, title, status, assignee_id, created_by)
    values ('${taskId}', '${organizationId}', '${projectId}', 'Realtime integration task', 'backlog', '${users[1].id}', '${users[0].id}');
    commit;`);

  const authOptions = {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false,
  };
  writer = createSupabaseClient(apiUrl, anonKey, authOptions);
  recipient = createSupabaseClient(apiUrl, anonKey, authOptions);
  const writerLogin = await writer.auth.signInWithPassword({
    email: users[0].email,
    password,
  });
  const recipientLogin = await recipient.auth.signInWithPassword({
    email: users[1].email,
    password,
  });
  if (writerLogin.error || recipientLogin.error) {
    throw new Error("Could not sign in realtime integration users.");
  }
});

describe.sequential("real Supabase Realtime delivery", () => {
  it("delivers database task, history, notification, comment, and presence events", async () => {
    if (!writer || !recipient)
      throw new Error("Realtime clients were not initialized.");

    const taskUpdates: unknown[] = [];
    const notifications: unknown[] = [];
    const comments: unknown[] = [];
    const taskEvents: unknown[] = [];
    const channels = [
      recipient.channel(`realtime-integration:tasks:${randomUUID()}`).on(
        "postgres_changes",
        {
          event: "UPDATE",
          filter: `project_id=eq.${projectId}`,
          schema: "public",
          table: "tasks",
        },
        (payload) => taskUpdates.push(payload),
      ),
      recipient
        .channel(`realtime-integration:notifications:${randomUUID()}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            filter: `recipient_user_id=eq.${users[1].id}`,
            schema: "public",
            table: "notifications",
          },
          (payload) => notifications.push(payload),
        ),
      recipient.channel(`realtime-integration:comments:${randomUUID()}`).on(
        "postgres_changes",
        {
          event: "INSERT",
          filter: `task_id=eq.${taskId}`,
          schema: "public",
          table: "comments",
        },
        (payload) => comments.push(payload),
      ),
      recipient.channel(`realtime-integration:events:${randomUUID()}`).on(
        "postgres_changes",
        {
          event: "INSERT",
          filter: `task_id=eq.${taskId}`,
          schema: "public",
          table: "task_events",
        },
        (payload) => taskEvents.push(payload),
      ),
    ];
    for (const channel of channels) await subscribe(channel);

    const recipientPresence = createDeveloperPresence(
      {
        organizationId,
        projectId,
        userId: users[1].id,
      },
      { authorize: () => true, client: recipient },
    );
    const writerPresence = createDeveloperPresence(
      {
        organizationId,
        projectId,
        userId: users[0].id,
      },
      { authorize: () => true, client: writer },
    );
    await expect(
      recipientPresence.join({ activity: "testing", taskId }),
    ).resolves.toBe("joined");
    await expect(
      writerPresence.join({ activity: "reviewing", taskId }),
    ).resolves.toBe("joined");
    await waitFor(
      () =>
        writerPresence
          .getSnapshot()
          .developers.some(({ userId }) => userId === users[1].id),
      "The writer did not receive the recipient Presence state.",
    );

    const { data: current, error: currentError } = await writer
      .from("tasks")
      .select("status, updated_at")
      .eq("id", taskId)
      .single<{ status: string; updated_at: string }>();
    if (currentError || !current)
      throw currentError ?? new Error("Task was not readable.");

    const nextStatus = current.status === "backlog" ? "in_progress" : "backlog";
    const { error: taskError } = await writer.rpc("mutate_task", {
      action: "update",
      expected_updated_at: current.updated_at,
      request_id: randomUUID(),
      target_organization_id: organizationId,
      target_project_id: projectId,
      target_task_id: taskId,
      task_values: { status: nextStatus },
    });
    if (taskError) throw taskError;

    await waitFor(
      () => taskUpdates.length > 0,
      "Task UPDATE was not delivered over Realtime.",
    );
    await waitFor(
      () => notifications.length > 0,
      "Task status notification was not delivered over Realtime.",
    );

    const { error: commentError } = await writer.rpc("manage_task_comment", {
      action: "create",
      comment_body: "Realtime comment from the real database",
      mentioned_user_ids: [users[1].id],
      request_id: randomUUID(),
      target_comment_id: null,
      target_organization_id: organizationId,
      target_project_id: projectId,
      target_task_id: taskId,
    });
    if (commentError) throw commentError;

    await waitFor(
      () => comments.length > 0,
      "Comment INSERT was not delivered over Realtime.",
    );
    await waitFor(
      () => taskEvents.length >= 2,
      "Database-generated task history events were not delivered over Realtime.",
    );
    await waitFor(
      () => notifications.length >= 2,
      "Mention notification was not delivered over Realtime.",
    );

    const { data: savedNotifications, error: notificationError } =
      await recipient
        .from("notifications")
        .select("notification_type, recipient_user_id")
        .eq("organization_id", organizationId)
        .eq("project_id", projectId)
        .eq("recipient_user_id", users[1].id);
    if (notificationError) throw notificationError;

    expect(taskUpdates).toHaveLength(1);
    expect(comments).toHaveLength(1);
    expect(savedNotifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          notification_type: "task_status_changed",
          recipient_user_id: users[1].id,
        }),
        expect.objectContaining({
          notification_type: "task_comment_mention",
          recipient_user_id: users[1].id,
        }),
      ]),
    );

    await writerPresence.dispose();
    await recipientPresence.dispose();
    for (const channel of channels) await recipient.removeChannel(channel);
  });
});

afterAll(async () => {
  try {
    await writer?.auth.signOut();
    await recipient?.auth.signOut();
    if (serviceKey) {
      sql(`delete from public.organizations where id = '${organizationId}';`);
    }
  } finally {
    for (const user of users) {
      await serviceRequest(`/auth/v1/admin/users/${user.id}`, "DELETE");
    }
    vi.unstubAllEnvs();
  }
});
