import { spawnSync } from "node:child_process";

const action = process.argv[2] ?? "status";
const commands = {
  start: ["start"],
  stop: ["stop"],
  status: ["status"],
  reset: ["db", "reset", "--local", "--yes"],
  seed: ["db", "reset", "--local", "--yes"],
};

const args = commands[action];

if (!args) {
  console.error(
    `Unknown Supabase action: ${action}. Use start, stop, status, reset, or seed.`,
  );
  process.exit(1);
}

if (action === "seed") {
  console.log(
    "Resetting the local Supabase database and applying supabase/seed.sql.",
  );
}

const result = spawnSync("corepack", ["pnpm", "exec", "supabase", ...args], {
  stdio: "inherit",
});

if (result.error) {
  console.error(
    `Could not run the pinned Supabase CLI: ${result.error.message}`,
  );
  process.exit(1);
}

process.exit(result.status ?? 1);
