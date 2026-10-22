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
const uploadedStoragePaths: string[] = [];

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
      `Local T028 request ${method} ${path.split("?")[0]} failed: HTTP ${response.status}`,
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
    throw new Error("Local Supabase is required for T028 API tests.");
  const configuration = JSON.parse(
    status.stdout.slice(status.stdout.indexOf("{")),
  ) as Record<string, string>;
  apiUrl = configuration.API_URL;
  if (!["127.0.0.1", "localhost", "[::1]"].includes(new URL(apiUrl).hostname))
    throw new Error("T028 API fixtures may only run against local Supabase.");
  serviceKey = configuration.SERVICE_ROLE_KEY;
  vi.stubEnv("VITE_SUPABASE_URL", apiUrl);
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", configuration.ANON_KEY);
  vi.resetModules();
  client = (await import("../apps/web/src/app/auth-client.js")).supabase;

  for (const label of ["writer", "member", "viewer", "outsider"]) {
    const email = `t028-${label}-${randomUUID()}@example.test`;
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
    values ('${organizationId}', 'T028 API organization', 't028-${organizationId}');
    insert into public.organization_memberships (organization_id, user_id, role)
    values
      ('${organizationId}', '${users[0].id}', 'member'),
      ('${organizationId}', '${users[1].id}', 'member'),
      ('${organizationId}', '${users[2].id}', 'viewer');
    insert into public.projects (id, organization_id, name, project_key)
    values ('${projectId}', '${organizationId}', 'T028 API project', 'T28A');
    insert into public.project_memberships (organization_id, project_id, user_id, role)
    values
      ('${organizationId}', '${projectId}', '${users[0].id}', 'member'),
      ('${organizationId}', '${projectId}', '${users[1].id}', 'member'),
      ('${organizationId}', '${projectId}', '${users[2].id}', 'viewer');
    insert into public.tasks (id, organization_id, project_id, title, status)
    values ('${taskId}', '${organizationId}', '${projectId}', 'T028 API task', 'in_progress');
    commit;`);
});

describe.sequential("T028 collaboration API", () => {
  it("persists comments, member-scoped mentions, and redacted delete history", async () => {
    if (!client) throw new Error("T028 API client was not initialized.");
    const login = await client.auth.signInWithPassword({
      email: users[0].email,
      password,
    });
    if (login.error) throw new Error("Could not sign in T028 writer.");
    const { createTaskCollaborationRepository } = await import(
      "../apps/web/src/features/tasks/task-collaboration-repository.js"
    );
    const { createTaskEventRepository } = await import(
      "../apps/web/src/features/events/task-events-repository.js"
    );
    const repository = createTaskCollaborationRepository(client);
    const events = createTaskEventRepository(client);
    const scope = {
      organizationId,
      projectId,
      projectKey: "T28A",
      userId: users[0].id,
    };
    const created = await repository.createComment(scope, taskId, {
      body: "Safe API comment",
      mentionedUserIds: [users[1].id],
    });
    expect(created.body).toBe("Safe API comment");
    expect(created.mentionedUserIds).toEqual([users[1].id]);
    expect(await repository.listMentionCandidates(scope)).toEqual(
      expect.arrayContaining([
        { userId: users[0].id },
        { userId: users[1].id },
        { userId: users[2].id },
      ]),
    );
    expect(
      (await events.list({ organizationId, projectId, taskId })).map(
        ({ eventType }) => eventType,
      ),
    ).toEqual(
      expect.arrayContaining([
        "task.comment_created",
        "task.comment_mentioned",
      ]),
    );

    const edited = await repository.editComment(scope, taskId, created, {
      body: "Edited API comment",
      mentionedUserIds: [],
    });
    expect(edited.editVersion).toBe(1);
    const deleted = await repository.deleteComment(scope, taskId, edited);
    expect(deleted.deletedAt).toBeTruthy();
    expect(deleted.body).toBe("Comment deleted");
    const listed = await repository.listComments(scope, taskId);
    expect(listed).toEqual([
      expect.objectContaining({
        id: created.id,
        body: "Comment deleted",
        deletedAt: expect.any(String),
      }),
    ]);
    const deletedEvent = (
      await events.list({ organizationId, projectId, taskId })
    ).find(({ eventType }) => eventType === "task.comment_deleted");
    expect(deletedEvent?.payload).toMatchObject({ contentState: "redacted" });
    expect(JSON.stringify(deletedEvent?.payload)).not.toContain(
      "Edited API comment",
    );
  });

  it("keeps checklist completion independent from task status and protects uploads", async () => {
    if (!client) throw new Error("T028 API client was not initialized.");
    const { createTaskCollaborationRepository } = await import(
      "../apps/web/src/features/tasks/task-collaboration-repository.js"
    );
    const repository = createTaskCollaborationRepository(client);
    const scope = {
      organizationId,
      projectId,
      projectKey: "T28A",
      userId: users[0].id,
    };
    const taskBefore = await client
      .from("tasks")
      .select("status")
      .eq("id", taskId)
      .single<{ status: string }>();
    expect(taskBefore.error).toBeNull();
    const item = await repository.createChecklistItem(
      scope,
      taskId,
      "Run API checks",
    );
    const completed = await repository.toggleChecklistItem(
      scope,
      taskId,
      item,
      true,
    );
    expect(completed.completedAt).toBeTruthy();
    const taskAfter = await client
      .from("tasks")
      .select("status")
      .eq("id", taskId)
      .single<{ status: string }>();
    expect(taskAfter.data?.status).toBe(taskBefore.data?.status);

    const upload = Object.assign(
      new Blob(["T028 attachment"], { type: "text/plain" }),
      {
        name: "notes.txt",
      },
    ) as File;
    const attachment = await repository.uploadAttachment(scope, taskId, upload);
    uploadedStoragePaths.push(attachment.storagePath);
    expect(attachment).toMatchObject({
      contentType: "text/plain",
      fileName: "notes.txt",
      byteSize: 15,
    });

    const viewerLogin = await client.auth.signInWithPassword({
      email: users[2].email,
      password,
    });
    if (viewerLogin.error) throw new Error("Could not sign in T028 viewer.");
    const viewerScope = { ...scope, userId: users[2].id };
    expect(await repository.listAttachments(viewerScope, taskId)).toEqual([
      expect.objectContaining({ id: attachment.id, fileName: "notes.txt" }),
    ]);
    const viewerDownload = await client.storage
      .from("projectpulse-attachments")
      .download(attachment.storagePath);
    expect(viewerDownload.error).toBeNull();
    expect(await repository.listChecklistItems(viewerScope, taskId)).toEqual([
      expect.objectContaining({ id: item.id, completedAt: expect.any(String) }),
    ]);
    await expect(
      repository.toggleChecklistItem(viewerScope, taskId, completed, false),
    ).rejects.toThrow(/permission/i);

    const outsiderLogin = await client.auth.signInWithPassword({
      email: users[3].email,
      password,
    });
    if (outsiderLogin.error)
      throw new Error("Could not sign in T028 outsider.");
    const outsiderScope = { ...scope, userId: users[3].id };
    expect(await repository.listAttachments(outsiderScope, taskId)).toEqual([]);
    expect(await repository.listChecklistItems(outsiderScope, taskId)).toEqual(
      [],
    );
    const outsiderDownload = await client.storage
      .from("projectpulse-attachments")
      .download(attachment.storagePath);
    expect(outsiderDownload.error).toBeTruthy();
  });

  it("keeps archived project details readable and mutation-free", async () => {
    if (!client) throw new Error("T028 API client was not initialized.");
    await serviceRequest(`/rest/v1/projects?id=eq.${projectId}`, "PATCH", {
      archived_at: new Date().toISOString(),
    });
    const writerLogin = await client.auth.signInWithPassword({
      email: users[0].email,
      password,
    });
    if (writerLogin.error)
      throw new Error("Could not restore T028 writer session.");
    const { createTaskCollaborationRepository } = await import(
      "../apps/web/src/features/tasks/task-collaboration-repository.js"
    );
    const repository = createTaskCollaborationRepository(client);
    const scope = {
      organizationId,
      projectId,
      projectKey: "T28A",
      userId: users[0].id,
    };
    expect(await repository.listComments(scope, taskId)).toEqual([
      expect.objectContaining({ body: "Comment deleted" }),
    ]);
    await expect(
      repository.createComment(scope, taskId, {
        body: "Archived write",
        mentionedUserIds: [],
      }),
    ).rejects.toThrow(/archived/i);
    await serviceRequest(`/rest/v1/projects?id=eq.${projectId}`, "PATCH", {
      archived_at: null,
    });
  });
});

afterAll(async () => {
  try {
    await client?.auth.signOut();
    if (serviceKey) {
      if (uploadedStoragePaths.length) {
        await serviceRequest(
          "/storage/v1/object/projectpulse-attachments",
          "DELETE",
          {
            prefixes: uploadedStoragePaths,
          },
        );
      }
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
