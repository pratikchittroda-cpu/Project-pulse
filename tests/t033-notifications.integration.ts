import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const container =
  process.env.SUPABASE_DB_CONTAINER ?? "supabase_db_projectpulse";
const organizationId = randomUUID();
const projectId = randomUUID();
const taskId = randomUUID();
const password = randomUUID();
const users: { id: string; email: string }[] = [];
let apiUrl = "";
let serviceKey = "";
let client:
  | typeof import("../apps/web/src/app/auth-client.js").supabase
  | undefined;

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
  if (result.error || result.status !== 0)
    throw new Error(result.error?.message ?? result.stderr);
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
  if (!response.ok)
    throw new Error(
      `Local T033 request ${method} ${path.split("?")[0]} failed: HTTP ${response.status}`,
    );
  return response;
}

beforeAll(async () => {
  const status = spawnSync(
    "corepack",
    ["pnpm", "exec", "supabase", "status", "--output", "json"],
    { encoding: "utf8", timeout: 15_000 },
  );
  if (status.error || status.status !== 0)
    throw new Error("Local Supabase is required for T033 API tests.");
  const configuration = JSON.parse(
    status.stdout.slice(status.stdout.indexOf("{")),
  ) as Record<string, string>;
  apiUrl = configuration.API_URL;
  if (!["127.0.0.1", "localhost", "[::1]"].includes(new URL(apiUrl).hostname))
    throw new Error("T033 API fixtures may only run against local Supabase.");
  serviceKey = configuration.SERVICE_ROLE_KEY;
  vi.stubEnv("VITE_SUPABASE_URL", apiUrl);
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", configuration.ANON_KEY);
  vi.resetModules();
  client = (await import("../apps/web/src/app/auth-client.js")).supabase;

  for (const label of ["writer", "recipient", "viewer", "outsider"]) {
    const email = `t033-${label}-${randomUUID()}@example.test`;
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
    values ('${organizationId}', 'T033 API organization', 't033-${organizationId}');
    insert into public.organization_memberships (organization_id, user_id, role)
    values
      ('${organizationId}', '${users[0].id}', 'member'),
      ('${organizationId}', '${users[1].id}', 'member'),
      ('${organizationId}', '${users[2].id}', 'viewer');
    insert into public.projects (id, organization_id, name, project_key)
    values ('${projectId}', '${organizationId}', 'T033 API project', 'T33A');
    insert into public.project_memberships (organization_id, project_id, user_id, role)
    values
      ('${organizationId}', '${projectId}', '${users[0].id}', 'member'),
      ('${organizationId}', '${projectId}', '${users[1].id}', 'member'),
      ('${organizationId}', '${projectId}', '${users[2].id}', 'viewer');
    insert into public.tasks (id, organization_id, project_id, title)
    values ('${taskId}', '${organizationId}', '${projectId}', 'T033 API task');
    commit;`);
});

describe.sequential("T033 notification API", () => {
  it("delivers member mentions, preserves deep links, and persists read state", async () => {
    if (!client) throw new Error("T033 API client was not initialized.");
    const writerLogin = await client.auth.signInWithPassword({
      email: users[0].email,
      password,
    });
    if (writerLogin.error) throw new Error("Could not sign in T033 writer.");
    const { createTaskCollaborationRepository } = await import(
      "../apps/web/src/features/tasks/task-collaboration-repository.js"
    );
    const { createTaskEventRepository } = await import(
      "../apps/web/src/features/events/task-events-repository.js"
    );
    const { createNotificationRepository } = await import(
      "../apps/web/src/features/notifications/notification-repository.js"
    );
    const collaboration = createTaskCollaborationRepository(client);
    const events = createTaskEventRepository(client);
    const scope = {
      organizationId,
      projectId,
      projectKey: "T33A",
      userId: users[0].id,
    };
    await collaboration.createComment(scope, taskId, {
      body: "T033 API mention",
      mentionedUserIds: [users[1].id, users[2].id],
    });
    const mentionEvent = (
      await events.list({ organizationId, projectId, taskId })
    ).find(({ eventType }) => eventType === "task.comment_mentioned");
    expect(mentionEvent).toBeTruthy();

    const recipientLogin = await client.auth.signInWithPassword({
      email: users[1].email,
      password,
    });
    if (recipientLogin.error)
      throw new Error("Could not sign in T033 recipient.");
    const repository = createNotificationRepository(client);
    const recipientScope = {
      organizationId,
      projectId,
      userId: users[1].id,
    };
    const unread = await repository.listUnread(recipientScope);
    if (!unread[0])
      throw new Error("T033 mention notification was not returned.");
    expect(unread).toEqual([
      expect.objectContaining({
        deepLink: `/app/organizations/${organizationId}/projects/${projectId}/tasks/${taskId}?event=${mentionEvent?.eventId}`,
        notificationType: "task_comment_mention",
        recipientUserId: users[1].id,
      }),
    ]);
    const marked = await repository.markRead(recipientScope, unread[0].id);
    expect(marked.readAt).toBeTruthy();
    expect(await repository.listUnread(recipientScope)).toEqual([]);

    await serviceRequest(
      "/rest/v1/rpc/enqueue_notification_for_event",
      "POST",
      {
        target_event_id: mentionEvent?.eventId,
        target_recipient_user_id: users[1].id,
        target_notification_type: "task_comment_mention",
      },
    );
    expect(
      (await repository.list(recipientScope)).filter(
        ({ sourceEventId }) => sourceEventId === mentionEvent?.eventId,
      ),
    ).toHaveLength(1);

    const viewerLogin = await client.auth.signInWithPassword({
      email: users[2].email,
      password,
    });
    if (viewerLogin.error) throw new Error("Could not sign in T033 viewer.");
    const viewerNotifications = await repository.list({
      ...recipientScope,
      userId: users[2].id,
    });
    expect(viewerNotifications).toHaveLength(1);
    const outsiderLogin = await client.auth.signInWithPassword({
      email: users[3].email,
      password,
    });
    if (outsiderLogin.error)
      throw new Error("Could not sign in T033 outsider.");
    expect(
      await repository.list({ ...recipientScope, userId: users[3].id }),
    ).toEqual([]);
  });
});

afterAll(async () => {
  try {
    await client?.auth.signOut();
    if (serviceKey) {
      sql(
        `begin; delete from public.organizations where id = '${organizationId}'; commit;`,
      );
    }
  } finally {
    for (const user of users) {
      await serviceRequest(`/auth/v1/admin/users/${user.id}`, "DELETE");
    }
    vi.unstubAllEnvs();
  }
});
