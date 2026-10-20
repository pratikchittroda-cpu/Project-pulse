import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { afterAll, beforeAll, expect, it, vi } from "vitest";

const container =
  process.env.SUPABASE_DB_CONTAINER ?? "supabase_db_projectpulse";
const organizationId = randomUUID();
const otherOrganizationId = randomUUID();
const projectId = randomUUID();
const planningProjectId = randomUUID();
const privateProjectId = randomUUID();
const otherProjectId = randomUUID();
const cycleId = randomUUID();
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
    throw new Error(
      "Local API fixture SQL failed. Check the running Supabase database and migrations.",
    );
}

async function serviceRequest(path: string, method: string, body?: object) {
  const response = await fetch(`${apiUrl}${path}`, {
    method,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok)
    throw new Error(
      `Local fixture request ${method} ${path.split("?")[0]} failed: HTTP ${response.status}`,
    );
  return response;
}

beforeAll(async () => {
  // Capture local credentials in memory; never print or write them to disk.
  const status = spawnSync(
    "corepack",
    ["pnpm", "exec", "supabase", "status", "--output", "json"],
    { encoding: "utf8", timeout: 15_000 },
  );
  if (status.error || status.status !== 0)
    throw new Error(
      "Local Supabase is required for test:api. Start it and apply pending migrations first.",
    );
  const configuration = JSON.parse(
    status.stdout.slice(status.stdout.indexOf("{")),
  ) as Record<string, string>;
  apiUrl = configuration.API_URL;
  if (!["127.0.0.1", "localhost", "[::1]"].includes(new URL(apiUrl).hostname))
    throw new Error("API fixtures may only run against local Supabase.");
  serviceKey = configuration.SERVICE_ROLE_KEY;
  if (!serviceKey || !configuration.ANON_KEY)
    throw new Error("Local Supabase did not provide test credentials.");
  vi.stubEnv("VITE_SUPABASE_URL", apiUrl);
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", configuration.ANON_KEY);
  vi.resetModules();
  client = (await import("../apps/web/src/app/auth-client.js")).supabase;

  for (let index = 0; index < 2; index += 1) {
    const email = `${randomUUID()}@example.test`;
    const response = await serviceRequest("/auth/v1/admin/users", "POST", {
      email,
      password,
      email_confirm: true,
    });
    const user = (await response.json()) as { id: string };
    users.push({ id: user.id, email });
  }
  sql(`begin;
    insert into public.organizations (id, name, slug) values
      ('${organizationId}', 'Task detail API test', 'api-${organizationId}'),
      ('${otherOrganizationId}', 'Other API organization', 'api-${otherOrganizationId}');
    insert into public.organization_memberships (organization_id, user_id, role) values
      ('${organizationId}', '${users[0].id}', 'owner'), ('${organizationId}', '${users[1].id}', 'viewer'),
      ('${otherOrganizationId}', '${users[0].id}', 'owner');
    insert into public.projects (id, organization_id, name, project_key) values
      ('${projectId}', '${organizationId}', 'API project', 'APIT'),
      ('${planningProjectId}', '${organizationId}', 'Planning API project', 'PLAN'),
      ('${privateProjectId}', '${organizationId}', 'Private API project', 'PRIV'),
      ('${otherProjectId}', '${otherOrganizationId}', 'Other API project', 'OTHER');
    insert into public.project_memberships (organization_id, project_id, user_id, role) values
      ('${organizationId}', '${projectId}', '${users[1].id}', 'viewer');
    insert into public.cycles (id, organization_id, project_id, name) values ('${cycleId}', '${organizationId}', '${projectId}', 'API sprint');
    update public.project_task_sequences set next_task_number = 9007199254740993 where project_id = '${projectId}';
    commit;`);
});

it("reads sprint lifecycle, commitment, scope changes and carryover back through the application repositories", async () => {
  if (!client) throw new Error("Local API fixture was not initialized.");
  const login = await client.auth.signInWithPassword({
    email: users[0].email,
    password,
  });
  if (login.error) throw new Error("Could not sign in the fixture owner.");
  const { createCycleRepository } = await import(
    "../apps/web/src/features/planning/cycle-repository.js"
  );
  const { createTaskRepository, emptyTaskDraft, taskToDraft } = await import(
    "../apps/web/src/features/tasks/task-repository.js"
  );
  const cycles = createCycleRepository(client);
  const tasks = createTaskRepository(client);
  const scope = {
    organizationId,
    projectId: planningProjectId,
    projectKey: "PLAN",
    userId: users[0].id,
  };
  const readCycle = async (id: string) => {
    const cycle = (await cycles.list(scope)).find((item) => item.id === id);
    if (!cycle) throw new Error("Sprint readback missing");
    return cycle;
  };
  let sprint = await cycles.create(scope, {
    name: "Sprint API",
    startsAt: "2026-10-21",
    endsAt: "2026-11-04",
  });
  sprint = await cycles.edit(scope, sprint, {
    name: "Sprint API edited",
    startsAt: "2026-10-22",
    endsAt: "2026-11-05",
  });
  const next = await cycles.create(scope, {
    name: "Next API sprint",
    startsAt: "",
    endsAt: "",
  });
  let planned = await tasks.save(scope, {
    ...emptyTaskDraft,
    title: "Plan through UI repository",
  });
  planned = await tasks.updatePlanning(scope, planned, {
    cycleId: sprint.id,
    estimate: 3.5,
  });
  sprint = await readCycle(sprint.id);
  expect(sprint).toMatchObject({
    name: "Sprint API edited",
    taskCount: 1,
    committedPoints: 3.5,
  });
  sprint = await cycles.manage(scope, "start", sprint);
  expect(sprint.initialTasks).toMatchObject([
    { id: planned.id, estimate: 3.5, number: planned.number },
  ]);
  await expect(cycles.manage(scope, "start", next)).rejects.toThrow(
    /active sprint/,
  );
  planned = await tasks.updatePlanning(scope, planned, {
    cycleId: sprint.id,
    estimate: 5,
  });
  sprint = await cycles.manage(scope, "pause", await readCycle(sprint.id));
  planned = await tasks.updatePlanning(scope, planned, {
    cycleId: null,
    estimate: 5,
  });
  planned = await tasks.updatePlanning(scope, planned, {
    cycleId: sprint.id,
    estimate: 5,
  });
  sprint = await cycles.manage(scope, "start", await readCycle(sprint.id));
  expect(sprint).toMatchObject({
    initialCommitment: 3.5,
    committedPoints: 5,
    addedPoints: 6.5,
    removedPoints: 5,
  });
  sprint = await cycles.manage(scope, "complete", sprint);
  expect(sprint).toMatchObject({
    status: "completed",
    carriedOverPoints: 5,
    carriedOverTaskCount: 1,
  });
  const frozen = structuredClone(sprint);
  await expect(
    tasks.updatePlanning(scope, planned, { cycleId: sprint.id, estimate: 8 }),
  ).rejects.toThrow(/carried over/);
  planned = await tasks.updatePlanning(scope, planned, {
    cycleId: next.id,
    estimate: planned.estimate,
  });
  planned = await tasks.updatePlanning(scope, planned, {
    cycleId: next.id,
    estimate: 8,
  });
  expect(await readCycle(sprint.id)).toEqual(frozen);
  expect(await tasks.get(scope, planned.id)).toMatchObject({
    cycleId: next.id,
    estimate: 8,
  });
  expect(await readCycle(next.id)).toMatchObject({
    committedPoints: 8,
    taskCount: 1,
  });
  const ledger = await client
    .from("cycle_events")
    .select("event_type, payload")
    .eq("cycle_id", sprint.id)
    .order("occurred_at");
  expect(ledger.error).toBeNull();
  expect(ledger.data?.map(({ event_type }) => event_type)).toEqual(
    expect.arrayContaining([
      "cycle.created",
      "cycle.updated",
      "cycle.started",
      "cycle.paused",
      "cycle.resumed",
      "cycle.completed",
      "cycle.task_carried_over",
    ]),
  );
  const canceled = await cycles.manage(
    scope,
    "cancel",
    await readCycle(next.id),
  );
  expect(canceled.status).toBe("canceled");
  await expect(
    cycles.edit(scope, canceled, {
      name: "Rewrite history",
      startsAt: "",
      endsAt: "",
    }),
  ).rejects.toThrow(/immutable/);

  // Test browser-level viewer permissions independently of the SQL role tests.
  sql(`insert into public.organization_memberships (organization_id, user_id, role) values ('${organizationId}', '${users[1].id}', 'viewer') on conflict do nothing;
    insert into public.project_memberships (organization_id, project_id, user_id, role) values ('${organizationId}', '${planningProjectId}', '${users[1].id}', 'viewer') on conflict do nothing;`);
  const viewerLogin = await client.auth.signInWithPassword({
    email: users[1].email,
    password,
  });
  if (viewerLogin.error) throw new Error("Could not sign in fixture viewer.");
  expect((await readCycle(sprint.id)).completionTasks).toEqual(
    frozen.completionTasks,
  );
  await expect(
    cycles.create(
      { ...scope, userId: users[1].id },
      { name: "Not allowed", startsAt: "", endsAt: "" },
    ),
  ).rejects.toThrow(/write access/);
  await expect(
    tasks.save(
      { ...scope, userId: users[1].id },
      taskToDraft(planned),
      planned,
    ),
  ).rejects.toThrow(/permission/);
  expect(await cycles.list({ ...scope, projectId: privateProjectId })).toEqual(
    [],
  );
  const denied = await client
    .from("cycles")
    .update({ initial_commitment: 99 })
    .eq("id", sprint.id);
  expect(denied.error?.code).toBe("42501");
});

it("loads planning tasks and sprints across repository page boundaries", async () => {
  if (!client) throw new Error("Local API fixture was not initialized.");
  const login = await client.auth.signInWithPassword({
    email: users[0].email,
    password,
  });
  if (login.error) throw new Error("Could not sign in fixture owner.");
  const { createTaskRepository } = await import(
    "../apps/web/src/features/tasks/task-repository.js"
  );
  const { createCycleRepository } = await import(
    "../apps/web/src/features/planning/cycle-repository.js"
  );
  const scope = {
    organizationId,
    projectId: planningProjectId,
    projectKey: "PLAN",
    userId: users[0].id,
  };
  const tasks = createTaskRepository(client);
  const cycles = createCycleRepository(client);
  const beforeTasks = (await tasks.list(scope, false)).length;
  const beforeCycles = (await cycles.list(scope)).length;
  sql(`insert into public.tasks (organization_id, project_id, title)
    select '${organizationId}', '${planningProjectId}', 'Paged planning task ' || n from generate_series(1, 205) n;
    insert into public.cycles (organization_id, project_id, name)
    select '${organizationId}', '${planningProjectId}', 'Paged sprint ' || n from generate_series(1, 105) n;`);
  expect(await tasks.list(scope, false)).toHaveLength(beforeTasks + 205);
  expect(await cycles.list(scope)).toHaveLength(beforeCycles + 105);
});

it("reads roadmap hierarchy, links tasks, and enforces project permissions through PostgREST", async () => {
  if (!client) throw new Error("Local API fixture was not initialized.");
  const login = await client.auth.signInWithPassword({
    email: users[0].email,
    password,
  });
  if (login.error) throw new Error("Could not sign in fixture owner.");
  sql(`insert into public.project_memberships (organization_id, project_id, user_id, role)
    values ('${organizationId}', '${planningProjectId}', '${users[1].id}', 'viewer')
    on conflict do nothing;`);
  const { createRoadmapRepository } = await import(
    "../apps/web/src/features/roadmap/roadmap-repository.js"
  );
  const { createTaskRepository, emptyTaskDraft } = await import(
    "../apps/web/src/features/tasks/task-repository.js"
  );
  const roadmap = createRoadmapRepository(client);
  const tasks = createTaskRepository(client);
  const scope = {
    organizationId,
    projectId: planningProjectId,
    projectKey: "PLAN",
    userId: users[0].id,
  };
  const initiative = await roadmap.createInitiative(scope, {
    name: "API roadmap initiative",
    description: "Hierarchy readback",
    status: "active",
  });
  const epic = await roadmap.createEpic(scope, {
    title: "API roadmap epic",
    description: "Task links",
    initiativeId: initiative.id,
    status: "active",
  });
  const milestone = await roadmap.createMilestone(scope, {
    name: "API roadmap milestone",
    targetDate: "2026-11-30",
    status: "planned",
  });
  let task = await tasks.save(scope, {
    ...emptyTaskDraft,
    title: "API roadmap task",
  });
  task = await tasks.updatePlanning(scope, task, {
    cycleId: null,
    estimate: 2.5,
    epicId: epic.id,
    milestoneId: milestone.id,
  });
  const data = await roadmap.list(scope);
  expect(data.initiatives).toEqual(
    expect.arrayContaining([expect.objectContaining({ id: initiative.id })]),
  );
  expect(data.epics).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: epic.id, initiativeId: initiative.id }),
    ]),
  );
  expect(data.milestones).toEqual(
    expect.arrayContaining([expect.objectContaining({ id: milestone.id })]),
  );
  expect(await tasks.get(scope, task.id)).toMatchObject({
    epicId: epic.id,
    milestoneId: milestone.id,
    estimate: 2.5,
  });

  const viewerLogin = await client.auth.signInWithPassword({
    email: users[1].email,
    password,
  });
  if (viewerLogin.error) throw new Error("Could not sign in fixture viewer.");
  const viewerScope = { ...scope, userId: users[1].id };
  expect((await roadmap.list(viewerScope)).epics).toEqual(
    expect.arrayContaining([expect.objectContaining({ id: epic.id })]),
  );
  await expect(
    roadmap.createMilestone(viewerScope, {
      name: "Viewer cannot create",
      targetDate: "",
      status: "planned",
    }),
  ).rejects.toThrow(/permission/);
  await expect(
    tasks.updatePlanning(viewerScope, task, {
      cycleId: null,
      estimate: 3,
      epicId: epic.id,
      milestoneId: milestone.id,
    }),
  ).rejects.toThrow(/permission/);
});

afterAll(async () => {
  try {
    await client?.auth.signOut();
    if (serviceKey)
      sql(
        `begin; delete from public.organizations where id in ('${organizationId}', '${otherOrganizationId}'); commit;`,
      );
  } finally {
    for (const user of users)
      await serviceRequest(`/auth/v1/admin/users/${user.id}`, "DELETE");
    vi.unstubAllEnvs();
  }
});

it("persists task detail/history through PostgREST and enforces real viewer and tenant boundaries", async () => {
  if (!client) throw new Error("Local API fixture was not initialized.");
  const { createTaskRepository, emptyTaskDraft, taskToDraft } = await import(
    "../apps/web/src/features/tasks/task-repository.js"
  );
  const { createTaskDetailRepository } = await import(
    "../apps/web/src/features/tasks/task-detail-repository.js"
  );
  const { createTaskEventRepository } = await import(
    "../apps/web/src/features/events/task-events-repository.js"
  );
  const tasks = createTaskRepository(client);
  const details = createTaskDetailRepository(client);
  const events = createTaskEventRepository(client);
  const login = await client.auth.signInWithPassword({
    email: users[0].email,
    password,
  });
  if (login.error)
    throw new Error("Could not sign in the local fixture owner.");
  const scope = {
    organizationId,
    projectId,
    projectKey: "APIT",
    userId: users[0].id,
  };
  const draft = {
    ...emptyTaskDraft,
    title: "API detail task",
    description: "Read back from the database",
    labels: "api, history",
    estimate: "3.5",
  };
  const created = await tasks.save(scope, draft);
  expect(created.key).toBe("APIT-9007199254740993");
  expect(created.number).toBe("9007199254740993");
  expect(await tasks.get(scope, created.id)).toEqual(created);
  const address = { ...scope, taskId: created.id };
  expect(await details.load(address)).toMatchObject({
    task: created,
    options: { canWrite: true },
    projectName: "API project",
  });
  expect(await events.list(address)).toMatchObject([
    { eventType: "task.created", actorId: users[0].id, source: "internal" },
  ]);

  const updated = await tasks.save(
    scope,
    { ...draft, title: "Updated through API", status: "in_progress" },
    created,
  );
  await expect(
    tasks.save(scope, { ...draft, title: "Stale edit" }, created),
  ).rejects.toThrow(/changed/);
  const archived = await tasks.setArchived(scope, updated, true);
  const restored = await tasks.setArchived(scope, archived, false);
  expect(archived.archivedAt).toBeTruthy();
  expect(restored.archivedAt).toBeNull();
  expect(
    (await events.list(address)).map(({ eventType }) => eventType),
  ).toEqual([
    "task.created",
    "task.status_changed",
    "task.archived",
    "task.restored",
  ]);

  await serviceRequest("/rest/v1/rpc/mutate_task", "POST", {
    target_organization_id: organizationId,
    target_project_id: projectId,
    request_id: randomUUID(),
    action: "update",
    target_task_id: created.id,
    expected_updated_at: restored.updatedAt,
    task_values: { status: "completed" },
    change_source: "github",
    change_reason: "Pull request merged",
    change_correlation_id: "fixture-pr-42",
  });
  const history = await events.list(address);
  expect(history.at(-1)).toMatchObject({
    source: "github",
    eventType: "task.status_changed",
    correlationId: "fixture-pr-42",
    payload: {
      mode: "automated",
      reason: "Pull request merged",
      changes: { status: { from: "in_progress", to: "completed" } },
    },
  });
  sql(
    `update public.tasks set cycle_id = '${cycleId}' where id = '${created.id}';`,
  );
  expect(await details.load(address)).toMatchObject({
    cycleName: "API sprint",
    task: { status: "completed" },
  });

  // More than one repository page, inserted in reverse ID order with identical
  // timestamps, proves pagination and the final deterministic sort key.
  const prefix = randomUUID().slice(0, 24);
  const tiedTime = new Date(Date.now() + 60_000).toISOString();
  sql(`insert into public.task_events (id, organization_id, project_id, task_id, event_type, source, entity_type, entity_id, idempotency_key, payload, occurred_at, created_at)
    select ('${prefix}' || lpad(n::text, 12, '0'))::uuid, '${organizationId}', '${projectId}', '${created.id}', 'github.check.completed', 'github', 'task', '${created.id}',
      'api-tie-${projectId}-' || n, jsonb_build_object('ordinal', n), '${tiedTime}', '${tiedTime}'
    from generate_series(1, 105) n order by n desc;`);
  const paginated = await events.list(address);
  expect(paginated).toHaveLength(111);
  expect(
    paginated
      .filter(({ eventType }) => eventType === "github.check.completed")
      .map(({ eventId }) => eventId),
  ).toEqual(
    Array.from(
      { length: 105 },
      (_, index) => `${prefix}${String(index + 1).padStart(12, "0")}`,
    ),
  );

  const privateScope = {
    ...scope,
    projectId: privateProjectId,
    projectKey: "PRIV",
  };
  const privateTask = await tasks.save(privateScope, draft);
  const otherScope = {
    ...scope,
    organizationId: otherOrganizationId,
    projectId: otherProjectId,
    projectKey: "OTHER",
  };
  const otherTask = await tasks.save(otherScope, draft);
  const viewerLogin = await client.auth.signInWithPassword({
    email: users[1].email,
    password,
  });
  if (viewerLogin.error)
    throw new Error("Could not sign in the local fixture viewer.");
  const viewerScope = { ...scope, userId: users[1].id };
  const visible = await details.load({ ...address, userId: users[1].id });
  expect(visible).toMatchObject({
    options: { canWrite: false },
    task: { id: created.id },
  });
  await expect(
    tasks.save(viewerScope, taskToDraft(visible!.task), visible!.task),
  ).rejects.toThrow(/permission/);
  for (const [hiddenScope, hiddenTask] of [
    [privateScope, privateTask],
    [otherScope, otherTask],
  ] as const) {
    const hidden = {
      ...hiddenScope,
      taskId: hiddenTask.id,
      userId: users[1].id,
    };
    expect(await details.load(hidden)).toBeNull();
    expect(await tasks.get(hidden, hiddenTask.id)).toBeNull();
    expect(await events.list(hidden)).toEqual([]);
  }
  sql(
    `delete from public.organization_memberships where organization_id = '${organizationId}' and user_id = '${users[1].id}';`,
  );
  expect(await details.load({ ...address, userId: users[1].id })).toBeNull();
  expect(await events.list(address)).toEqual([]);
});
