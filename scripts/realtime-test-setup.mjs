import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const credentialsPath = resolve(root, ".realtime-test-credentials.json");
const envPath = resolve(root, ".env.local");

const ids = {
  organization: "11111111-1111-4111-8111-111111111111",
  project: "22222222-2222-4222-8222-222222222222",
  taskStatus: "33333333-3333-4333-8333-333333333333",
  taskPresence: "44444444-4444-4444-8444-444444444444",
  taskCollaboration: "55555555-5555-4555-8555-555555555555",
};

function readStatusEnv() {
  const statusPath = resolve(root, ".realtime-status.env");
  if (!existsSync(statusPath)) {
    throw new Error(
      "Could not read local Supabase status. Run the realtime:setup package command so it can query local Supabase first.",
    );
  }
  const values = {};
  for (const line of readFileSync(statusPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)="(.*)"$/);
    if (match) values[match[1]] = match[2];
  }
  if (!values.API_URL || !values.ANON_KEY || !values.SERVICE_ROLE_KEY) {
    throw new Error(
      "Local Supabase did not return API, anon, and service keys.",
    );
  }
  return values;
}

function loadCredentials() {
  if (!existsSync(credentialsPath)) return {};
  try {
    return JSON.parse(readFileSync(credentialsPath, "utf8"));
  } catch {
    return {};
  }
}

function passwordFor(existing, key) {
  return (
    existing[key]?.password ?? `${randomBytes(18).toString("base64url")}Aa1!`
  );
}

function createAdminApi(apiUrl, serviceRoleKey) {
  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };

  async function request(path, options = {}) {
    const response = await fetch(`${apiUrl}${path}`, {
      ...options,
      headers: { ...headers, ...(options.headers ?? {}) },
    });
    const text = await response.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    if (!response.ok) {
      const message =
        typeof body === "object" && body
          ? (body.msg ??
            body.message ??
            body.error_description ??
            JSON.stringify(body))
          : String(body);
      throw new Error(`${response.status}: ${message}`);
    }
    return body;
  }

  return {
    auth: {
      async listUsers() {
        return request("/auth/v1/admin/users?page=1&per_page=1000");
      },
      async createUser(values) {
        return request("/auth/v1/admin/users", {
          body: JSON.stringify(values),
          method: "POST",
        });
      },
      async updateUser(id, values) {
        return request(`/auth/v1/admin/users/${encodeURIComponent(id)}`, {
          body: JSON.stringify(values),
          method: "PUT",
        });
      },
    },
    from(table) {
      return {
        upsert(values, options = {}) {
          return request(
            `/rest/v1/${encodeURIComponent(table)}?on_conflict=${encodeURIComponent(options.onConflict ?? "id")}`,
            {
              body: JSON.stringify(values),
              headers: {
                Prefer: "resolution=merge-duplicates,return=minimal",
              },
              method: "POST",
            },
          )
            .then(() => ({ error: null }))
            .catch((error) => ({
              error: {
                message: error instanceof Error ? error.message : String(error),
              },
            }));
        },
      };
    },
  };
}

async function ensureUser(admin, account, existing) {
  const users = await admin.auth.listUsers();
  const password = passwordFor(existing, account.key);
  let user = users.users.find(
    ({ email }) => email?.toLowerCase() === account.email,
  );
  if (!user) {
    const created = await admin.auth.createUser({
      email: account.email,
      email_confirm: true,
      password,
      user_metadata: { display_name: account.name },
    });
    user = created.user ?? created;
  } else {
    const updated = await admin.auth.updateUser(user.id, {
      email_confirm: true,
      password,
      user_metadata: {
        ...(user.user_metadata ?? {}),
        display_name: account.name,
      },
    });
    user = updated.user ?? updated;
  }
  if (!user) throw new Error(`Could not create ${account.email}.`);
  return { ...account, id: user.id, password };
}

async function upsertOrThrow(query, label) {
  const { error } = await query;
  if (error) throw new Error(`${label}: ${error.message}`);
}

function envLine(key, value) {
  return `${key}=${value}\n`;
}

async function main() {
  const status = readStatusEnv();
  const existing = loadCredentials();
  const admin = createAdminApi(status.API_URL, status.SERVICE_ROLE_KEY);

  const owner = await ensureUser(
    admin,
    {
      key: "owner",
      email: "realtime.owner@example.test",
      label: "Realtime owner",
      name: "Realtime Owner",
      role: "owner",
    },
    existing,
  );
  const reviewer = await ensureUser(
    admin,
    {
      key: "reviewer",
      email: "realtime.reviewer@example.test",
      label: "Realtime reviewer",
      name: "Realtime Reviewer",
      role: "member",
    },
    existing,
  );

  await upsertOrThrow(
    admin.from("organizations").upsert(
      {
        id: ids.organization,
        name: "Realtime Test Workspace",
        slug: "realtime-test-workspace",
      },
      { onConflict: "id" },
    ),
    "organization",
  );
  await upsertOrThrow(
    admin.from("organization_memberships").upsert(
      [
        { organization_id: ids.organization, role: "owner", user_id: owner.id },
        {
          organization_id: ids.organization,
          role: "member",
          user_id: reviewer.id,
        },
      ],
      { onConflict: "organization_id,user_id" },
    ),
    "organization memberships",
  );
  await upsertOrThrow(
    admin.from("projects").upsert(
      {
        id: ids.project,
        name: "Realtime Verification Lab",
        organization_id: ids.organization,
        project_key: "LIVE",
        description:
          "A local project for testing task sync, presence, notifications, and collaboration.",
      },
      { onConflict: "id" },
    ),
    "project",
  );
  await upsertOrThrow(
    admin.from("project_memberships").upsert(
      [
        {
          organization_id: ids.organization,
          project_id: ids.project,
          role: "admin",
          user_id: owner.id,
        },
        {
          organization_id: ids.organization,
          project_id: ids.project,
          role: "member",
          user_id: reviewer.id,
        },
      ],
      { onConflict: "project_id,user_id" },
    ),
    "project memberships",
  );
  await upsertOrThrow(
    admin.from("tasks").upsert(
      [
        {
          id: ids.taskStatus,
          organization_id: ids.organization,
          project_id: ids.project,
          task_number: 1,
          title: "Move this task to test live board sync",
          description:
            "Move this task in one browser and watch the other browser update.",
          status: "backlog",
          priority: "high",
          assignee_id: reviewer.id,
          created_by: owner.id,
          labels: ["realtime", "notifications"],
        },
        {
          id: ids.taskPresence,
          organization_id: ids.organization,
          project_id: ids.project,
          task_number: 2,
          title: "Watch the active developer presence card",
          description:
            "Open the board in two authenticated browser profiles to see both users.",
          status: "in_progress",
          priority: "medium",
          assignee_id: owner.id,
          created_by: owner.id,
          labels: ["presence"],
        },
        {
          id: ids.taskCollaboration,
          organization_id: ids.organization,
          project_id: ids.project,
          task_number: 3,
          title: "Add a comment and mention the other tester",
          description:
            "Use the task detail page to test comments, mentions, checklist, and live history.",
          status: "in_review",
          priority: "medium",
          assignee_id: reviewer.id,
          created_by: owner.id,
          labels: ["collaboration", "history"],
        },
      ],
      { onConflict: "id" },
    ),
    "test tasks",
  );

  writeFileSync(
    credentialsPath,
    `${JSON.stringify({ owner, reviewer }, null, 2)}\n`,
    "utf8",
  );
  writeFileSync(
    envPath,
    [
      "# Generated by corepack pnpm run realtime:setup. Do not commit.",
      envLine("VITE_SUPABASE_URL", status.API_URL).trimEnd(),
      envLine("VITE_SUPABASE_ANON_KEY", status.ANON_KEY).trimEnd(),
      envLine("VITE_REALTIME_TEST_OWNER_EMAIL", owner.email).trimEnd(),
      envLine("VITE_REALTIME_TEST_OWNER_PASSWORD", owner.password).trimEnd(),
      envLine("VITE_REALTIME_TEST_REVIEWER_EMAIL", reviewer.email).trimEnd(),
      envLine(
        "VITE_REALTIME_TEST_REVIEWER_PASSWORD",
        reviewer.password,
      ).trimEnd(),
      "",
    ].join("\n"),
    "utf8",
  );

  console.log("Realtime test workspace is ready.");
  console.log(`Workspace: ${ids.organization}`);
  console.log(`Project:   ${ids.project} (LIVE · Realtime Verification Lab)`);
  console.log(`Owner:     ${owner.email} / ${owner.password}`);
  console.log(`Reviewer:  ${reviewer.email} / ${reviewer.password}`);
  console.log("Credentials were written to the ignored .env.local file.");
  console.log("Restart Vite after setup, then open /auth/login.");
}

main().catch((cause) => {
  console.error(cause instanceof Error ? cause.message : cause);
  process.exitCode = 1;
});
