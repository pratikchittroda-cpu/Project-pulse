import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync(
  "supabase/migrations/20261017000000_initial_schema.sql",
  "utf8",
);
const policies = readFileSync(
  "supabase/migrations/20261017010000_add_rls_policies.sql",
  "utf8",
);
const permissionTests = readFileSync("supabase/rls-tests.sql", "utf8");
const deliveryPipeline = readFileSync(
  "supabase/migrations/20261026000000_github_delivery_pipeline.sql",
  "utf8",
);
const disconnectRetention = readFileSync(
  "supabase/migrations/20261027000000_repository_disconnect_retention.sql",
  "utf8",
);

describe("project and repository contract", () => {
  it("keeps project identifiers and repository metadata database-enforced", () => {
    expect(schema).toContain(
      "project_key text not null check (project_key ~ '^[A-Z][A-Z0-9]{1,9}$')",
    );
    expect(schema).toContain("unique (organization_id, project_key)");
    expect(schema).toContain("provider text not null default 'other'");
    expect(schema).toContain("url text not null check (url ~ '^https?://')");
    expect(schema).toContain("default_branch text not null default 'main'");
  });

  it("keeps project and repository access behind project membership helpers", () => {
    expect(policies).toContain("create policy projects_select");
    expect(policies).toContain("create policy projects_update");
    expect(policies).toContain("create policy repositories_select");
    expect(policies).toContain("create policy repositories_insert");
    expect(policies).toContain(
      "can_access_project(project_id, organization_id)",
    );
    expect(policies).toContain(
      "can_write_project(project_id, organization_id)",
    );
    expect(permissionTests).toContain(
      "team assignment was not visible to project member",
    );
    expect(permissionTests).toContain(
      "client repository write unexpectedly succeeded",
    );
    expect(permissionTests).toContain(
      "invalid project key unexpectedly succeeded",
    );
    expect(permissionTests).toContain(
      "duplicate project key unexpectedly succeeded",
    );
  });

  it("preserves delivery history when a repository is disconnected", () => {
    expect(deliveryPipeline).toContain("repository_id uuid not null,");
    expect(disconnectRetention).toContain(
      "alter column repository_id drop not null",
    );
    expect(disconnectRetention).toContain("on delete set null");
    expect(disconnectRetention).toContain(
      "delivery_objects_repository_id_organization_id_fkey",
    );
  });
});
