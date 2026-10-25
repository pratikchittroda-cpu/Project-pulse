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
const codeInvitationMigration = readFileSync(
  "supabase/migrations/20261023000000_code_based_organization_invitations.sql",
  "utf8",
);
const workspaceReadModelsMigration = readFileSync(
  "supabase/migrations/20261023010000_workspace_read_models.sql",
  "utf8",
);
const legacyInvitationMigration = readFileSync(
  "supabase/migrations/20261023020000_revoke_legacy_email_invitations.sql",
  "utf8",
);
const workspaceBootstrapMigration = readFileSync(
  "supabase/migrations/20261023030000_workspace_bootstrap.sql",
  "utf8",
);
const deliveryRiskMigration = readFileSync(
  "supabase/migrations/20261025000000_delivery_risk_read_model.sql",
  "utf8",
);
const githubDeliveryMigration = readFileSync(
  "supabase/migrations/20261026000000_github_delivery_pipeline.sql",
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

  it("keeps organization invitations code-based and one-use", () => {
    expect(codeInvitationMigration).toContain(
      "invite_organization_member(uuid, text)",
    );
    expect(codeInvitationMigration).toContain("invitation_code text");
    expect(codeInvitationMigration).toContain(
      "Invitation code is invalid or expired",
    );
    expect(codeInvitationMigration).toContain("status = 'pending'");
    expect(codeInvitationMigration).toContain("status = 'accepted'");
    expect(codeInvitationMigration).toContain("email drop not null");
  });

  it("keeps workspace reads scoped and aggregate-friendly", () => {
    expect(workspaceReadModelsMigration).toContain(
      "create or replace function public.get_organization_overview",
    );
    expect(workspaceReadModelsMigration).toContain(
      "create or replace function public.get_project_dashboard_snapshot",
    );
    expect(workspaceReadModelsMigration).toContain("security invoker");
    expect(workspaceReadModelsMigration).toContain(
      "tasks_project_active_updated_idx",
    );
  });

  it("does not keep legacy email-bound invitations active", () => {
    expect(legacyInvitationMigration).toContain("where status = 'pending'");
    expect(legacyInvitationMigration).toContain("and email is not null");
    expect(legacyInvitationMigration).toContain("status = 'revoked'");
  });

  it("bootstraps the workspace in one scoped read", () => {
    expect(workspaceBootstrapMigration).toContain(
      "create or replace function public.get_workspace_bootstrap",
    );
    expect(workspaceBootstrapMigration).toContain(
      "preferred_organization_id uuid default null",
    );
    expect(workspaceBootstrapMigration).toContain(
      "preferred_project_id uuid default null",
    );
    expect(workspaceBootstrapMigration).toContain(
      "get_project_dashboard_snapshot",
    );
    expect(workspaceBootstrapMigration).toContain(
      "task_events_project_occurred_scope_idx",
    );
    expect(workspaceBootstrapMigration).toContain("security invoker");
  });

  it("keeps delivery risks scoped and explainable", () => {
    expect(deliveryRiskMigration).toContain(
      "create or replace function public.get_project_delivery_risks",
    );
    expect(deliveryRiskMigration).toContain("can_access_project");
    expect(deliveryRiskMigration).toContain("task.status = 'blocked'");
    expect(deliveryRiskMigration).toContain("task.assignee_id is null");
    expect(deliveryRiskMigration).toContain("interval '48 hours'");
    expect(deliveryRiskMigration).toContain("'next_move'");
    expect(deliveryRiskMigration).toContain("security invoker");
  });

  it("keeps GitHub delivery ingestion service-only and task-linked", () => {
    expect(githubDeliveryMigration).toContain(
      "create table public.delivery_objects",
    );
    expect(githubDeliveryMigration).toContain(
      "create table public.delivery_task_links",
    );
    expect(githubDeliveryMigration).toContain(
      "create or replace function public.ingest_github_delivery",
    );
    expect(githubDeliveryMigration).toContain(
      "grant execute on function public.ingest_github_delivery",
    );
    expect(githubDeliveryMigration).toContain("to service_role");
    expect(githubDeliveryMigration).not.toContain(
      "create policy delivery_objects_insert",
    );
    expect(githubDeliveryMigration).toContain("record_task_event");
    expect(githubDeliveryMigration).toContain("provider_event_id");
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
