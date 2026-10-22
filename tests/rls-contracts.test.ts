import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20261017010000_add_rls_policies.sql",
  "utf8",
);
const organizationManagementMigration = readFileSync(
  "supabase/migrations/20261017020000_organization_management.sql",
  "utf8",
);
const taskCrudMigration = readFileSync(
  "supabase/migrations/20261018000000_task_crud_validation.sql",
  "utf8",
);
const taskEventsMigration = readFileSync(
  "supabase/migrations/20261018010000_event_envelope_and_task_events.sql",
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

  it("keeps organization administration transactional and tenant-safe", () => {
    expect(organizationManagementMigration).toContain(
      "create or replace function public.create_organization",
    );
    expect(organizationManagementMigration).toContain(
      "create or replace function public.invite_organization_member",
    );
    expect(organizationManagementMigration).toContain(
      "create or replace function public.accept_organization_invitation",
    );
    expect(organizationManagementMigration).toContain(
      "create or replace function public.revoke_organization_invitation",
    );
    expect(organizationManagementMigration).not.toContain(
      "create policy organization_invitations_insert",
    );
    expect(organizationManagementMigration).toContain(
      "on delete set null (team_id)",
    );
    expect(organizationManagementMigration).toContain(
      "team_memberships_organization_member_fkey",
    );
    expect(organizationManagementMigration).toContain("role <> 'owner'");
    expect(tests).toContain("removed member should read zero tasks");
    expect(tests).toContain("member invitation unexpectedly succeeded");
  });

  it("keeps task mutations constrained to valid project members", () => {
    expect(taskCrudMigration).toContain("tasks_labels_check");
    expect(taskCrudMigration).toContain("tasks_assignee_project_access");
    expect(taskCrudMigration).toContain("tasks_finite_estimate_check");
    expect(taskCrudMigration).toContain("Archived projects are read-only");
    expect(taskCrudMigration).toContain("created_by set default auth.uid()");
    expect(tests).toContain("member task edit did not persist");
    expect(tests).toContain("viewer task update unexpectedly succeeded");
    expect(tests).toContain(
      "cross-organization assignee unexpectedly succeeded",
    );
    expect(tests).toContain(
      "archived project task write unexpectedly succeeded",
    );
  });

  it("keeps task event history idempotent and provider-neutral", () => {
    expect(taskEventsMigration).toContain(
      "task_events_organization_idempotency_key_unique",
    );
    expect(taskEventsMigration).toContain("create policy task_events_insert");
    expect(taskEventsMigration).toContain("record_task_event");
    expect(tests).toContain(
      "duplicate task event created a second history row",
    );
    expect(tests).toContain("viewer task event unexpectedly succeeded");
    expect(tests).toContain("provider source spoof unexpectedly succeeded");
  });
});
