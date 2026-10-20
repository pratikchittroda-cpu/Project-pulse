import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";

const container =
  process.env.SUPABASE_DB_CONTAINER ?? "supabase_db_projectpulse";
const args = [
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
];
function sql(text) {
  const result = spawnSync("docker", args, { input: text, encoding: "utf8" });
  if (result.error || result.status !== 0)
    throw new Error(result.error?.message ?? result.stderr);
  return result.stdout.trim();
}
function concurrentSql(text) {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", args);
    let output = "";
    let error = "";
    child.stdout.on("data", (chunk) => {
      output += chunk;
    });
    child.stderr.on("data", (chunk) => {
      error += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve(output.trim()) : reject(new Error(error)),
    );
    child.stdin.end(text);
  });
}

sql(
  readFileSync(new URL("../supabase/rls-tests.sql", import.meta.url), "utf8"),
);
sql(
  readFileSync(
    new URL("../supabase/task-history-tests.sql", import.meta.url),
    "utf8",
  ),
);
console.log("Database RLS, history, replay, and rollback assertions passed.");

const user = randomUUID();
const organization = randomUUID();
const project = randomUUID();
const request = randomUUID();
try {
  sql(`begin;
    insert into auth.users (id, email) values ('${user}', '${user}@example.test');
    insert into public.organizations (id, name, slug) values ('${organization}', 'Concurrent history test', 'history-${organization}');
    insert into public.organization_memberships (organization_id, user_id, role) values ('${organization}', '${user}', 'owner');
    insert into public.projects (id, organization_id, name, project_key) values ('${project}', '${organization}', 'History', 'HIST');
    commit;`);
  const mutation = `begin;
    set local role authenticated;
    set local request.jwt.claims = '{"sub":"${user}","role":"authenticated"}';
    select id from public.mutate_task('${organization}', '${project}', '${request}', 'create', task_values => '{"title":"Concurrent retry"}');
    select pg_sleep(0.1);
    commit;`;
  const outcomes = await Promise.allSettled(
    Array.from({ length: 4 }, () => concurrentSql(mutation)),
  );
  // Wait for every client before cleanup even if one connection failed.
  for (const outcome of outcomes)
    if (outcome.status === "rejected") throw outcome.reason;
  const ids = outcomes.map((outcome) => outcome.value);
  assert.equal(
    new Set(ids).size,
    1,
    "concurrent retries must return one task ID",
  );
  assert.equal(
    sql(`select count(*) from public.tasks where project_id = '${project}';`),
    "1",
  );
  assert.equal(
    sql(
      `select count(*) from public.task_events where project_id = '${project}';`,
    ),
    "1",
  );
  console.log(
    "Four concurrent retries returned one task and one history event.",
  );
} finally {
  sql(
    `begin; delete from public.organizations where id = '${organization}'; delete from auth.users where id = '${user}'; commit;`,
  );
}
