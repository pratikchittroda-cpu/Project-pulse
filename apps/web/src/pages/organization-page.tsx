import { useEffect, useRef, useState } from "react";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  PageLayout,
} from "@projectpulse/ui";

import { supabase } from "../app/auth-client.js";
import { useAuth } from "../app/auth-context.js";
import {
  useOrganization,
  type OrganizationRole,
} from "../app/organization-context.js";
import {
  isValidTeamKey,
  normalizeTeamKey,
  teamKeyValidationMessage,
} from "../app/organization-keys.js";

interface OrganizationSummary {
  id: string;
  name: string;
  role: OrganizationRole;
  slug: string;
}

interface TeamSummary {
  id: string;
  name: string;
  teamKey: string;
}

interface ProjectSummary {
  id: string;
  name: string;
  projectKey: string;
  teamId: string | null;
}

interface TaskSummary {
  id: string;
  title: string;
  taskNumber: number;
  teamId: string | null;
}

interface MemberSummary {
  id: string;
  role: OrganizationSummary["role"];
  userId: string;
}

interface OrganizationOverviewPayload {
  members?: Array<{ id: string; role: string; user_id: string }>;
  projects?: Array<{
    id: string;
    name: string;
    project_key: string;
    team_id: string | null;
  }>;
  tasks?: Array<{
    id: string;
    title: string;
    task_number: number;
    team_id: string | null;
  }>;
  team_memberships?: Array<{ team_id: string; user_id: string }>;
  teams?: Array<{ id: string; name: string; team_key: string }>;
}

const emptyOrganization = { name: "", slug: "" };

function invitationErrorMessage(error: { message: string } | null) {
  if (!error) {
    return null;
  }
  if (error.message.toLowerCase().includes("invalid or expired")) {
    return "That invitation code is invalid or expired.";
  }
  return error.message || "Could not process the invitation code.";
}

function teamErrorMessage(error: { code?: string; message: string } | null) {
  if (!error) {
    return null;
  }
  if (error.code === "23505") {
    return "That team key is already used in this organization.";
  }
  if (error.code === "23514") {
    return teamKeyValidationMessage;
  }
  if (error.code === "42501") {
    return "You do not have permission to create a team.";
  }
  return error.message || "Could not create team.";
}

function toSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function OrganizationPage() {
  const { status } = useAuth();
  const {
    error: organizationContextError,
    organizations,
    refreshOrganizations,
    selectOrganization,
    selectedOrganization,
    selectedOrganizationId,
  } = useOrganization();
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [members, setMembers] = useState<MemberSummary[]>([]);
  const [teamMembers, setTeamMembers] = useState<Record<string, string[]>>({});
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [organizationForm, setOrganizationForm] = useState(emptyOrganization);
  const [teamForm, setTeamForm] = useState({ key: "", name: "" });
  const [inviteForm, setInviteForm] = useState({ role: "member" });
  const [joinCode, setJoinCode] = useState("");
  const [teamMemberForm, setTeamMemberForm] = useState({
    teamId: "",
    userId: "",
  });
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const detailsSequence = useRef(0);

  const canAdminister =
    selectedOrganization?.role === "owner" ||
    selectedOrganization?.role === "admin";

  async function loadOrganizationDetails(organizationId: string) {
    const requestId = ++detailsSequence.current;
    const { data, error: overviewError } = await supabase.rpc(
      "get_organization_overview",
      { target_organization_id: organizationId },
    );

    if (requestId !== detailsSequence.current) {
      return;
    }

    if (overviewError) {
      setError(overviewError.message || "Could not load organization details");
      return;
    }

    const overview = (data ?? {}) as OrganizationOverviewPayload;
    setTeams(
      (overview.teams ?? []).map((team) => ({
        id: team.id,
        name: team.name,
        teamKey: team.team_key,
      })),
    );
    setMembers(
      (overview.members ?? []).map((member) => ({
        id: member.id,
        role: member.role as OrganizationSummary["role"],
        userId: member.user_id,
      })),
    );
    setTeamMembers(
      (overview.team_memberships ?? []).reduce<Record<string, string[]>>(
        (result, membership) => {
          const teamId = membership.team_id;
          const userId = membership.user_id;
          result[teamId] = [...(result[teamId] ?? []), userId];
          return result;
        },
        {},
      ),
    );
    setProjects(
      (overview.projects ?? []).map((project) => ({
        id: project.id,
        name: project.name,
        projectKey: project.project_key,
        teamId: project.team_id ?? null,
      })),
    );
    setTasks(
      (overview.tasks ?? []).map((task) => ({
        id: task.id,
        title: task.title,
        taskNumber: task.task_number,
        teamId: task.team_id ?? null,
      })),
    );
  }

  useEffect(() => {
    if (selectedOrganizationId) {
      void loadOrganizationDetails(selectedOrganizationId);
    } else {
      detailsSequence.current += 1;
      setTeams([]);
      setMembers([]);
      setTeamMembers({});
      setProjects([]);
      setTasks([]);
    }
  }, [selectedOrganizationId]);

  async function createOrganization() {
    setIsBusy(true);
    setError(null);
    const { data, error: createError } = await supabase.rpc(
      "create_organization",
      {
        organization_name: organizationForm.name,
        organization_slug:
          organizationForm.slug || toSlug(organizationForm.name),
      },
    );
    setIsBusy(false);

    if (createError) {
      setError(createError.message);
      return;
    }

    const createdOrganization = Array.isArray(data) ? data[0] : data;
    setMessage(
      `Organization ${(createdOrganization as { name: string }).name} created.`,
    );
    setOrganizationForm(emptyOrganization);
    await refreshOrganizations();
  }

  async function createTeam() {
    if (!selectedOrganizationId) {
      return;
    }

    const name = teamForm.name.trim();
    const key = normalizeTeamKey(teamForm.key);
    if (!name) {
      setError("Team name is required.");
      return;
    }
    if (!isValidTeamKey(key)) {
      setError(teamKeyValidationMessage);
      return;
    }

    setIsBusy(true);
    setError(null);
    const { error: createError } = await supabase.from("teams").insert({
      organization_id: selectedOrganizationId,
      name,
      team_key: key,
    });
    setIsBusy(false);

    if (createError) {
      setError(teamErrorMessage(createError));
      return;
    }

    setTeamForm({ key: "", name: "" });
    setMessage("Team created.");
    await loadOrganizationDetails(selectedOrganizationId);
  }

  async function inviteMember() {
    if (!selectedOrganizationId) {
      return;
    }

    setIsBusy(true);
    setError(null);
    const { data, error: inviteError } = await supabase.rpc(
      "invite_organization_member",
      {
        invitee_role: inviteForm.role,
        target_organization_id: selectedOrganizationId,
      },
    );
    setIsBusy(false);

    if (inviteError) {
      setError(inviteError.message);
      return;
    }

    const invitation = Array.isArray(data) ? data[0] : data;
    setInviteCode(invitation?.invitation_code ?? null);
    setInviteForm({ role: "member" });
    setMessage("Invitation code created. Share it with the person joining.");
  }

  async function joinOrganization() {
    const code = joinCode.trim().toUpperCase();
    if (!code) {
      setError("Enter an invitation code first.");
      return;
    }

    setIsBusy(true);
    setError(null);
    const { error: acceptError } = await supabase.rpc(
      "accept_organization_invitation",
      { invitation_code: code },
    );
    setIsBusy(false);

    if (acceptError) {
      setError(invitationErrorMessage(acceptError));
      return;
    }

    setJoinCode("");
    setMessage("You joined the organization. Your workspace access is ready.");
    await refreshOrganizations();
  }

  async function changeRole(member: MemberSummary, role: string) {
    if (!selectedOrganizationId || !canAdminister) {
      return;
    }

    const { error: updateError } = await supabase
      .from("organization_memberships")
      .update({ role })
      .eq("id", member.id)
      .eq("organization_id", selectedOrganizationId);
    if (updateError) {
      setError(updateError.message);
      return;
    }

    setMessage("Member role updated.");
    await loadOrganizationDetails(selectedOrganizationId);
  }

  async function removeMember(member: MemberSummary) {
    if (!selectedOrganizationId || !canAdminister || member.role === "owner") {
      return;
    }

    const { error: removeError } = await supabase
      .from("organization_memberships")
      .delete()
      .eq("id", member.id)
      .eq("organization_id", selectedOrganizationId);
    if (removeError) {
      setError(removeError.message);
      return;
    }

    setMessage(
      "Member removed. Their organization access is revoked immediately.",
    );
    await loadOrganizationDetails(selectedOrganizationId);
  }

  async function addTeamMember() {
    if (
      !selectedOrganizationId ||
      !canAdminister ||
      !teamMemberForm.teamId ||
      !teamMemberForm.userId
    ) {
      return;
    }

    const { error: addError } = await supabase.from("team_memberships").insert({
      organization_id: selectedOrganizationId,
      team_id: teamMemberForm.teamId,
      user_id: teamMemberForm.userId,
    });
    if (addError) {
      setError(addError.message);
      return;
    }

    setTeamMemberForm({ ...teamMemberForm, userId: "" });
    setMessage("Member added to the team.");
    await loadOrganizationDetails(selectedOrganizationId);
  }

  async function removeTeamMember(teamId: string, userId: string) {
    if (!selectedOrganizationId || !canAdminister) {
      return;
    }

    const { error: removeError } = await supabase
      .from("team_memberships")
      .delete()
      .eq("organization_id", selectedOrganizationId)
      .eq("team_id", teamId)
      .eq("user_id", userId);
    if (removeError) {
      setError(removeError.message);
      return;
    }

    setMessage("Member removed from the team.");
    await loadOrganizationDetails(selectedOrganizationId);
  }

  async function assignProjectTeam(projectId: string, teamId: string) {
    if (!selectedOrganizationId || !canAdminister) {
      return;
    }

    const { error: assignError } = await supabase
      .from("projects")
      .update({ team_id: teamId || null })
      .eq("id", projectId)
      .eq("organization_id", selectedOrganizationId);
    if (assignError) {
      setError(assignError.message);
      return;
    }

    setMessage("Project team assignment updated.");
    await loadOrganizationDetails(selectedOrganizationId);
  }

  async function assignTaskTeam(taskId: string, teamId: string) {
    if (!selectedOrganizationId || !canAdminister) {
      return;
    }

    const { error: assignError } = await supabase
      .from("tasks")
      .update({ team_id: teamId || null })
      .eq("id", taskId)
      .eq("organization_id", selectedOrganizationId);
    if (assignError) {
      setError(assignError.message);
      return;
    }

    setMessage("Task team assignment updated.");
    await loadOrganizationDetails(selectedOrganizationId);
  }

  if (status === "loading") {
    return <p className="muted">Loading organizations…</p>;
  }

  return (
    <PageLayout
      description="Create organizations, manage roles, and give teams a shared delivery context."
      eyebrow="Workspace administration"
      title="Organizations and teams"
    >
      {message ? (
        <p className="auth-success" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="auth-error" role="alert">
          {error}
        </p>
      ) : null}
      {organizationContextError ? (
        <p className="auth-error" role="alert">
          {organizationContextError}
        </p>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Join an organization</CardTitle>
          <CardDescription>
            Paste an invitation code from an organization administrator to join
            their workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="organization-form compact-form">
            <Input
              hint="Invitation codes start with PP-"
              label="Invitation code"
              onChange={(event) =>
                setJoinCode(event.target.value.toUpperCase())
              }
              value={joinCode}
            />
            <Button
              disabled={isBusy || !joinCode.trim()}
              onClick={() => void joinOrganization()}
            >
              Join organization
            </Button>
          </div>
        </CardContent>
      </Card>
      {inviteCode ? (
        <Card>
          <CardHeader>
            <CardTitle>Invitation code ready</CardTitle>
            <CardDescription>
              This code is shown once so an administrator can deliver it through
              an approved channel.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <code className="invite-token">{inviteCode}</code>
          </CardContent>
        </Card>
      ) : null}
      {organizations.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Create your first organization</CardTitle>
            <CardDescription>
              Organization creation also creates your owner membership in one
              server-side transaction.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="organization-form">
              <Input
                label="Organization name"
                onChange={(event) =>
                  setOrganizationForm({
                    ...organizationForm,
                    name: event.target.value,
                  })
                }
                value={organizationForm.name}
              />
              <Input
                hint="Lowercase letters, numbers, and hyphens"
                label="Slug"
                onChange={(event) =>
                  setOrganizationForm({
                    ...organizationForm,
                    slug: event.target.value,
                  })
                }
                value={organizationForm.slug}
              />
              <Button
                disabled={isBusy || !organizationForm.name}
                onClick={() => void createOrganization()}
              >
                Create organization
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="organization-grid">
          <Card>
            <CardHeader>
              <CardTitle>Organization context</CardTitle>
              <CardDescription>
                Choose the organization you want to administer.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <label className="field">
                <span className="pp-field-label">Organization</span>
                <select
                  className="pp-input"
                  onChange={(event) => selectOrganization(event.target.value)}
                  value={selectedOrganizationId}
                >
                  {organizations.map((organization) => (
                    <option key={organization.id} value={organization.id}>
                      {organization.name} · {organization.role}
                    </option>
                  ))}
                </select>
              </label>
              {selectedOrganization ? (
                <p className="muted">
                  Your role:{" "}
                  <Badge
                    tone={
                      selectedOrganization.role === "viewer"
                        ? "neutral"
                        : "accent"
                    }
                  >
                    {selectedOrganization.role}
                  </Badge>
                </p>
              ) : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Teams</CardTitle>
              <CardDescription>
                Teams can be assigned to projects and planning work.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="organization-list">
                {teams.map((team) => (
                  <li key={team.id}>
                    <strong>{team.teamKey}</strong>
                    <span>{team.name}</span>
                  </li>
                ))}
              </ul>
              {canAdminister ? (
                <div className="organization-form compact-form">
                  <Input
                    label="Team name"
                    onChange={(event) =>
                      setTeamForm({ ...teamForm, name: event.target.value })
                    }
                    value={teamForm.name}
                  />
                  <Input
                    hint={teamKeyValidationMessage}
                    label="Team key"
                    maxLength={20}
                    onChange={(event) =>
                      setTeamForm({
                        ...teamForm,
                        key: event.target.value.toUpperCase(),
                      })
                    }
                    value={teamForm.key}
                  />
                  <Button
                    disabled={isBusy || !teamForm.name || !teamForm.key}
                    onClick={() => void createTeam()}
                    size="sm"
                  >
                    Add team
                  </Button>
                </div>
              ) : (
                <p className="muted">
                  Only organization admins can create teams.
                </p>
              )}
              {canAdminister ? (
                <div className="organization-form compact-form">
                  <label className="field">
                    <span className="pp-field-label">Team membership</span>
                    <select
                      className="pp-input"
                      onChange={(event) =>
                        setTeamMemberForm({
                          ...teamMemberForm,
                          teamId: event.target.value,
                        })
                      }
                      value={teamMemberForm.teamId}
                    >
                      <option value="">Choose a team</option>
                      {teams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.teamKey} · {team.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span className="pp-field-label">Member</span>
                    <select
                      className="pp-input"
                      onChange={(event) =>
                        setTeamMemberForm({
                          ...teamMemberForm,
                          userId: event.target.value,
                        })
                      }
                      value={teamMemberForm.userId}
                    >
                      <option value="">Choose a member</option>
                      {members.map((member) => (
                        <option key={member.userId} value={member.userId}>
                          {member.userId}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Button
                    disabled={
                      isBusy || !teamMemberForm.teamId || !teamMemberForm.userId
                    }
                    onClick={() => void addTeamMember()}
                    size="sm"
                  >
                    Add member to team
                  </Button>
                </div>
              ) : null}
              <ul className="team-members-list">
                {teams.map((team) => (
                  <li key={team.id}>
                    <span>
                      <strong>{team.teamKey}</strong> members
                    </span>
                    <span className="team-member-chips">
                      {(teamMembers[team.id] ?? []).length > 0 ? (
                        (teamMembers[team.id] ?? []).map((userId) => (
                          <span className="team-member-chip" key={userId}>
                            {userId}
                            {canAdminister ? (
                              <button
                                aria-label={`Remove ${userId} from ${team.name}`}
                                className="chip-remove"
                                onClick={() =>
                                  void removeTeamMember(team.id, userId)
                                }
                                type="button"
                              >
                                ×
                              </button>
                            ) : null}
                          </span>
                        ))
                      ) : (
                        <span className="muted">No members assigned</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Members</CardTitle>
              <CardDescription>
                Roles are enforced by PostgreSQL RLS, not only by this UI.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="organization-list">
                {members.map((member) => (
                  <li key={member.id}>
                    <span>{member.userId}</span>
                    {canAdminister ? (
                      <span className="member-actions">
                        {member.role === "owner" ? (
                          <Badge tone="accent">owner</Badge>
                        ) : (
                          <select
                            className="pp-input member-role"
                            onChange={(event) =>
                              void changeRole(member, event.target.value)
                            }
                            value={member.role}
                          >
                            <option value="admin">admin</option>
                            <option value="member">member</option>
                            <option value="viewer">viewer</option>
                          </select>
                        )}
                        {member.role !== "owner" ? (
                          <Button
                            onClick={() => void removeMember(member)}
                            size="sm"
                            variant="danger"
                          >
                            Remove
                          </Button>
                        ) : null}
                      </span>
                    ) : (
                      <Badge
                        tone={member.role === "viewer" ? "neutral" : "accent"}
                      >
                        {member.role}
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
              {canAdminister ? (
                <div className="organization-form compact-form">
                  <label className="field">
                    <span className="pp-field-label">Role</span>
                    <select
                      className="pp-input"
                      onChange={(event) =>
                        setInviteForm({
                          ...inviteForm,
                          role: event.target.value,
                        })
                      }
                      value={inviteForm.role}
                    >
                      <option value="member">member</option>
                      <option value="admin">admin</option>
                      <option value="viewer">viewer</option>
                    </select>
                  </label>
                  <Button
                    disabled={isBusy}
                    onClick={() => void inviteMember()}
                    size="sm"
                  >
                    Create invitation code
                  </Button>
                </div>
              ) : (
                <p className="muted">
                  Only organization admins can invite or change members.
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Team assignments</CardTitle>
              <CardDescription>
                Assign teams to projects and tasks without crossing organization
                boundaries.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="resource-assignment-grid">
                <div>
                  <h4>Projects</h4>
                  {projects.length > 0 ? (
                    <ul className="organization-list">
                      {projects.map((project) => (
                        <li key={project.id}>
                          <span>
                            <strong>{project.projectKey}</strong> {project.name}
                          </span>
                          {canAdminister ? (
                            <select
                              className="pp-input member-role"
                              onChange={(event) =>
                                void assignProjectTeam(
                                  project.id,
                                  event.target.value,
                                )
                              }
                              value={project.teamId ?? ""}
                            >
                              <option value="">No team</option>
                              {teams.map((team) => (
                                <option key={team.id} value={team.id}>
                                  {team.teamKey}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="muted">
                              {teams.find((team) => team.id === project.teamId)
                                ?.teamKey ?? "No team"}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">No accessible projects yet.</p>
                  )}
                </div>
                <div>
                  <h4>Tasks</h4>
                  {tasks.length > 0 ? (
                    <ul className="organization-list">
                      {tasks.map((task) => (
                        <li key={task.id}>
                          <span>
                            <strong>#{task.taskNumber}</strong> {task.title}
                          </span>
                          {canAdminister ? (
                            <select
                              className="pp-input member-role"
                              onChange={(event) =>
                                void assignTaskTeam(task.id, event.target.value)
                              }
                              value={task.teamId ?? ""}
                            >
                              <option value="">No team</option>
                              {teams.map((team) => (
                                <option key={team.id} value={team.id}>
                                  {team.teamKey}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="muted">
                              {teams.find((team) => team.id === task.teamId)
                                ?.teamKey ?? "No team"}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">No accessible tasks yet.</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </PageLayout>
  );
}
