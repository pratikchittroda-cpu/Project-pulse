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
sql(
  readFileSync(new URL("../supabase/cycle-tests.sql", import.meta.url), "utf8"),
);
sql(
  readFileSync(
    new URL("../supabase/dependency-tests.sql", import.meta.url),
    "utf8",
  ),
);
sql(
  readFileSync(
    new URL("../supabase/roadmap-tests.sql", import.meta.url),
    "utf8",
  ),
);
sql(
  readFileSync(
    new URL("../supabase/saved-view-tests.sql", import.meta.url),
    "utf8",
  ),
);
sql(
  readFileSync(
    new URL("../supabase/t028-collaboration-tests.sql", import.meta.url),
    "utf8",
  ),
);
console.log(
  "Database RLS, history, cycle lifecycle, roadmap hierarchy, dependency graph, saved-view ownership, collaboration, replay, and rollback assertions passed.",
);

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

  const claims = `set local role authenticated;
    set local request.jwt.claims = '{"sub":"${user}","role":"authenticated"}';
    set local statement_timeout = '10s';`;
  const createCycle = (name) =>
    sql(`begin; ${claims}
    select id from public.manage_cycle('${organization}', '${project}', 'create', cycle_name => '${name}', request_id => '${randomUUID()}'); commit;`);
  const firstCycle = createCycle("Concurrent A");
  const secondCycle = createCycle("Concurrent B");
  const starts = await Promise.allSettled(
    [firstCycle, secondCycle].map((cycle) =>
      concurrentSql(`begin; ${claims}
    select id from public.manage_cycle('${organization}', '${project}', 'start', '${cycle}',
      request_id => '${randomUUID()}', expected_updated_at => (select updated_at from public.cycles where id = '${cycle}'));
    select pg_sleep(0.1); commit;`),
    ),
  );
  assert.equal(
    starts.filter(({ status }) => status === "fulfilled").length,
    1,
    "only one simultaneous start may succeed",
  );
  const rejectedStart = starts.find(({ status }) => status === "rejected");
  assert.match(
    rejectedStart.reason.message,
    /cycles_one_active_per_project_idx/,
  );
  const active = sql(
    `select id from public.cycles where project_id = '${project}' and status = 'active';`,
  );
  const assignments = await Promise.allSettled(
    Array.from({ length: 4 }, () =>
      concurrentSql(`begin; ${claims}
    select id from public.mutate_task('${organization}', '${project}', '${randomUUID()}', 'create',
      task_values => '{"title":"Parallel planning","estimate":2.5,"cycle_id":"${active}"}');
    select pg_sleep(0.05); commit;`),
    ),
  );
  for (const outcome of assignments)
    if (outcome.status === "rejected") throw outcome.reason;
  assert.equal(
    sql(
      `select task_count || ':' || committed_points || ':' || added_task_count from public.cycles where id = '${active}';`,
    ),
    "4:10.00:4",
  );
  assert.equal(
    sql(
      `select count(*) from public.cycle_events where cycle_id = '${active}' and event_type = 'cycle.task_added';`,
    ),
    "4",
  );

  const taskId = sql(
    `select id from public.tasks where cycle_id = '${active}' order by id limit 1;`,
  );
  const closedVersion = sql(
    `select updated_at from public.cycles where id = '${active}';`,
  );
  // The completion owns the cycle lock before a competing assignment begins.
  // A late insert must fail instead of silently entering a frozen snapshot.
  const close = concurrentSql(`begin; ${claims}
    select id from public.manage_cycle('${organization}', '${project}', 'complete', '${active}',
      request_id => '${randomUUID()}', expected_updated_at => '${closedVersion}');
    select pg_sleep(0.25); commit;`);
  const lateAdd = concurrentSql(`begin; ${claims} select pg_sleep(0.1);
    select id from public.mutate_task('${organization}', '${project}', '${randomUUID()}', 'create',
      task_values => '{"title":"Late assignment","cycle_id":"${active}"}'); commit;`);
  const finishing = await Promise.allSettled([close, lateAdd]);
  if (finishing[0].status === "rejected") throw finishing[0].reason;
  assert.equal(finishing[1].status, "rejected");
  assert.match(finishing[1].reason.message, /closed sprint/);
  const beforeCarry = sql(
    `select completion_tasks::text from public.cycles where id = '${active}';`,
  );
  sql(`begin; ${claims}
    select id from public.mutate_task('${organization}', '${project}', '${randomUUID()}', 'update', '${taskId}',
      '{"cycle_id":null}', (select updated_at from public.tasks where id = '${taskId}')); commit;`);
  assert.equal(
    sql(
      `select completion_tasks::text from public.cycles where id = '${active}';`,
    ),
    beforeCarry,
  );
  console.log(
    "Concurrent sprint starts, four parallel assignments, completion isolation, and frozen carryover passed.",
  );
} finally {
  sql(
    `begin; delete from public.organizations where id = '${organization}'; delete from auth.users where id = '${user}'; commit;`,
  );
}
