import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const config = readFileSync("supabase/config.toml", "utf8");
const seed = readFileSync("supabase/seed.sql", "utf8");
const environment = readFileSync(".env.example", "utf8");

describe("local Supabase setup", () => {
  it("pins the local services and enables deterministic seeding", () => {
    expect(config).toContain('project_id = "projectpulse"');
    expect(config).toContain("port = 54321");
    expect(config).toContain("port = 54322");
    expect(config).toContain('sql_paths = ["./seed.sql"]');
    expect(config).toContain('site_url = "http://127.0.0.1:5173"');
    expect(seed).toContain("projectpulse_seed_metadata");
    expect(seed).toContain("on conflict (seed_key) do update");
  });

  it("keeps browser and server configuration variables distinct", () => {
    expect(environment).toContain("VITE_SUPABASE_URL=");
    expect(environment).toContain("VITE_SUPABASE_ANON_KEY=");
    expect(environment).toContain("SUPABASE_SERVICE_ROLE_KEY=");
    expect(environment).not.toContain("sb_secret_");
    expect(environment).not.toContain("sb_publishable_");
  });
});
