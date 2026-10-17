import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20261017010000_add_rls_policies.sql",
  "utf8",
);
const tests = readFileSync("supabase/rls-tests.sql", "utf8");

describe("RLS policy contract", () => {
  it("defines restricted membership and project helpers", () => {
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = public, auth");
    expect(migration).toContain("is_org_member");
    expect(migration).toContain("has_org_role");
    expect(migration).toContain("can_access_project");
    expect(migration).toContain("can_write_project");
  });

  it("keeps webhook and audit tables without client policies", () => {
    expect(migration).toContain(
      "-- Webhook deliveries and audit records are intentionally service-role-only.",
    );
    expect(migration).not.toContain("webhook_events_insert");
    expect(migration).not.toContain("audit_records_insert");
    expect(tests).toContain("viewer write unexpectedly succeeded");
    expect(tests).toContain("client webhook write unexpectedly succeeded");
    expect(tests).toContain("cross-organization member should read zero tasks");
  });
});
