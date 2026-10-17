import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

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
import { useOrganization } from "../app/organization-context.js";
import { DEFAULT_PROJECT, useProject } from "../app/project-context.js";

interface TeamSummary {
  id: string;
  name: string;
  teamKey: string;
}

interface RepositorySummary {
  defaultBranch: string;
  id: string;
  name: string;
  provider: "github" | "gitlab" | "other";
  url: string;
}

interface ProjectMemberSummary {
  id: string;
  role: "admin" | "member" | "viewer";
  userId: string;
}

interface OrganizationMemberSummary {
  role: string;
  userId: string;
}

const emptyProject = {
  description: "",
  key: "",
  name: "",
  teamId: "",
};

const emptyRepository = {
  defaultBranch: "main",
  name: "",
  provider: "other" as RepositorySummary["provider"],
  url: "",
};

const projectKeyPattern = /^[A-Z][A-Z0-9]{1,9}$/;

function errorMessage(
  error: { code?: string; message: string } | null,
  fallback: string,
) {
  if (!error) {
    return null;
  }
  if (error.code === "23505") {
    return "That project key is already used in this organization.";
  }
  if (error.code === "23514") {
    return "Project keys must start with a letter and contain only 2–10 uppercase letters or numbers.";
  }
  if (error.code === "42501") {
    return "You do not have permission to change this project.";
  }
  return error.message || fallback;
}

export function ProjectsPage() {
  const { status } = useAuth();
  const { selectedOrganization, selectedOrganizationId } = useOrganization();
  const {
    error: projectContextError,
    isLoading: isLoadingProjects,
    project,
    projects,
    refreshProjects,
    selectProject,
  } = useProject();
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [repositories, setRepositories] = useState<RepositorySummary[]>([]);
  const [members, setMembers] = useState<ProjectMemberSummary[]>([]);
  const [organizationMembers, setOrganizationMembers] = useState<
    OrganizationMemberSummary[]
  >([]);
  const [newProjectForm, setNewProjectForm] = useState(emptyProject);
  const [projectForm, setProjectForm] = useState(emptyProject);
  const [repositoryForm, setRepositoryForm] = useState(emptyRepository);
  const [memberForm, setMemberForm] = useState({ role: "member", userId: "" });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const canAdministerOrganization =
    selectedOrganization?.role === "owner" ||
    selectedOrganization?.role === "admin";
  const hasRealProject =
    Boolean(selectedOrganizationId) && project.id !== DEFAULT_PROJECT.id;
  const selectedProject = useMemo(
    () => projects.find(({ id }) => id === project.id),
    [project.id, projects],
  );

  async function loadProjectDetails(projectId: string) {
    if (!selectedOrganizationId) {
      setTeams([]);
      setRepositories([]);
      setMembers([]);
      setOrganizationMembers([]);
      return;
    }

    const { data: teamData, error: teamError } = await supabase
      .from("teams")
      .select("id, name, team_key")
      .eq("organization_id", selectedOrganizationId)
      .order("name");
    if (teamError) {
      setError(teamError.message);
      return;
    }
    setTeams(
      (teamData ?? []).map((team) => ({
        id: team.id as string,
        name: team.name as string,
        teamKey: team.team_key as string,
      })),
    );

    if (!hasRealProject) {
      setRepositories([]);
      setMembers([]);
      setOrganizationMembers([]);
      return;
    }

    const [
      { data: repositoryData, error: repositoryError },
      { data: memberData, error: memberError },
      { data: organizationMemberData, error: organizationMemberError },
    ] = await Promise.all([
      supabase
        .from("repositories")
        .select("id, name, provider, url, default_branch")
        .eq("organization_id", selectedOrganizationId)
        .eq("project_id", projectId)
        .order("name"),
      supabase
        .from("project_memberships")
        .select("id, user_id, role")
        .eq("organization_id", selectedOrganizationId)
        .eq("project_id", projectId)
        .order("created_at"),
      supabase
        .from("organization_memberships")
        .select("user_id, role")
        .eq("organization_id", selectedOrganizationId)
        .order("created_at"),
    ]);

    const firstError =
      repositoryError ?? memberError ?? organizationMemberError;
    if (firstError) {
      setError(firstError.message);
      return;
    }

    setRepositories(
      (repositoryData ?? []).map((repository) => ({
        defaultBranch: repository.default_branch as string,
        id: repository.id as string,
        name: repository.name as string,
        provider: repository.provider as RepositorySummary["provider"],
        url: repository.url as string,
      })),
    );
    setMembers(
      (memberData ?? []).map((member) => ({
        id: member.id as string,
        role: member.role as ProjectMemberSummary["role"],
        userId: member.user_id as string,
      })),
    );
    setOrganizationMembers(
      (organizationMemberData ?? []).map((member) => ({
        role: member.role as string,
        userId: member.user_id as string,
      })),
    );
  }

  useEffect(() => {
    if (hasRealProject) {
      setProjectForm({
        description: project.description ?? "",
        key: project.key,
        name: project.name,
        teamId: project.teamId ?? "",
      });
    } else {
      setProjectForm(emptyProject);
    }
  }, [hasRealProject, project]);

  useEffect(() => {
    void loadProjectDetails(project.id);
  }, [project.id, selectedOrganizationId]);

  async function createProject() {
    if (!selectedOrganizationId || !canAdministerOrganization) {
      setError("Select an organization where you are an owner or admin first.");
      return;
    }

    const key = newProjectForm.key.trim().toUpperCase();
    if (!newProjectForm.name.trim()) {
      setError("Project name is required.");
      return;
    }
    if (!projectKeyPattern.test(key)) {
      setError(
        "Project keys must start with a letter and contain only 2–10 uppercase letters or numbers.",
      );
      return;
    }

    setIsBusy(true);
    setError(null);
    const { data, error: createError } = await supabase
      .from("projects")
      .insert({
        description: newProjectForm.description.trim() || null,
        name: newProjectForm.name.trim(),
        organization_id: selectedOrganizationId,
        project_key: key,
        team_id: newProjectForm.teamId || null,
      })
      .select("id")
      .single();
    setIsBusy(false);

    if (createError) {
      setError(errorMessage(createError, "Could not create project."));
      return;
    }

    setMessage(`Project ${key} created.`);
    setNewProjectForm(emptyProject);
    await refreshProjects(data?.id as string | undefined);
  }

  async function updateProject() {
    if (!selectedOrganizationId || !hasRealProject) {
      return;
    }

    const key = projectForm.key.trim().toUpperCase();
    if (!projectForm.name.trim() || !projectKeyPattern.test(key)) {
      setError("Enter a project name and a valid uppercase project key.");
      return;
    }

    setIsBusy(true);
    setError(null);
    const { error: updateError } = await supabase
      .from("projects")
      .update({
        description: projectForm.description.trim() || null,
        name: projectForm.name.trim(),
        project_key: key,
        team_id: projectForm.teamId || null,
      })
      .eq("id", project.id)
      .eq("organization_id", selectedOrganizationId);
    setIsBusy(false);

    if (updateError) {
      setError(errorMessage(updateError, "Could not update project."));
      return;
    }

    setMessage("Project settings updated.");
    await refreshProjects(project.id);
  }

  async function archiveProject() {
    if (!selectedOrganizationId || !hasRealProject) {
      return;
    }

    setIsBusy(true);
    const { error: archiveError } = await supabase
      .from("projects")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", project.id)
      .eq("organization_id", selectedOrganizationId);
    setIsBusy(false);

    if (archiveError) {
      setError(errorMessage(archiveError, "Could not archive project."));
      return;
    }

    setMessage(
      "Project archived. It remains available to administrators for audit history.",
    );
    await refreshProjects("");
  }

  async function addRepository() {
    if (!selectedOrganizationId || !hasRealProject) {
      return;
    }
    if (!repositoryForm.name.trim()) {
      setError("Repository name is required.");
      return;
    }
    if (!/^https?:\/\//i.test(repositoryForm.url.trim())) {
      setError("Repository URL must start with http:// or https://.");
      return;
    }
    if (!repositoryForm.defaultBranch.trim()) {
      setError("Default branch is required.");
      return;
    }

    setIsBusy(true);
    setError(null);
    const { error: createError } = await supabase.from("repositories").insert({
      default_branch: repositoryForm.defaultBranch.trim(),
      name: repositoryForm.name.trim(),
      organization_id: selectedOrganizationId,
      project_id: project.id,
      provider: repositoryForm.provider,
      url: repositoryForm.url.trim(),
    });
    setIsBusy(false);

    if (createError) {
      setError(errorMessage(createError, "Could not register repository."));
      return;
    }

    setRepositoryForm(emptyRepository);
    setMessage("Repository record registered.");
    await loadProjectDetails(project.id);
  }

  async function removeRepository(repositoryId: string) {
    if (!selectedOrganizationId || !hasRealProject) {
      return;
    }

    const { error: removeError } = await supabase
      .from("repositories")
      .delete()
      .eq("id", repositoryId)
      .eq("organization_id", selectedOrganizationId)
      .eq("project_id", project.id);
    if (removeError) {
      setError(errorMessage(removeError, "Could not remove repository."));
      return;
    }

    setMessage("Repository record removed.");
    await loadProjectDetails(project.id);
  }

  async function addProjectMember() {
    if (
      !selectedOrganizationId ||
      !hasRealProject ||
      !canAdministerOrganization
    ) {
      return;
    }
    if (!memberForm.userId) {
      setError("Choose an organization member first.");
      return;
    }

    const { error: memberError } = await supabase
      .from("project_memberships")
      .insert({
        organization_id: selectedOrganizationId,
        project_id: project.id,
        role: memberForm.role,
        user_id: memberForm.userId,
      });
    if (memberError) {
      setError(errorMessage(memberError, "Could not add project member."));
      return;
    }

    setMemberForm({ role: "member", userId: "" });
    setMessage("Project member added.");
    await loadProjectDetails(project.id);
  }

  async function updateProjectMember(memberId: string, role: string) {
    if (
      !selectedOrganizationId ||
      !hasRealProject ||
      !canAdministerOrganization
    ) {
      return;
    }

    const { error: updateError } = await supabase
      .from("project_memberships")
      .update({ role })
      .eq("id", memberId)
      .eq("organization_id", selectedOrganizationId)
      .eq("project_id", project.id);
    if (updateError) {
      setError(errorMessage(updateError, "Could not update project member."));
      return;
    }

    setMessage("Project member role updated.");
    await loadProjectDetails(project.id);
  }

  async function removeProjectMember(memberId: string) {
    if (
      !selectedOrganizationId ||
      !hasRealProject ||
      !canAdministerOrganization
    ) {
      return;
    }

    const { error: removeError } = await supabase
      .from("project_memberships")
      .delete()
      .eq("id", memberId)
      .eq("organization_id", selectedOrganizationId)
      .eq("project_id", project.id);
    if (removeError) {
      setError(errorMessage(removeError, "Could not remove project member."));
      return;
    }

    setMessage("Project member removed.");
    await loadProjectDetails(project.id);
  }

  if (status === "loading") {
    return <p className="muted">Loading projects…</p>;
  }

  return (
    <PageLayout
      description="Create project spaces, register repositories, and manage project-level access."
      eyebrow="Project administration"
      title="Projects and repositories"
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
      {projectContextError ? (
        <p className="auth-error" role="alert">
          {projectContextError}
        </p>
      ) : null}
      {!selectedOrganizationId ? (
        <Card>
          <CardHeader>
            <CardTitle>Select an organization first</CardTitle>
            <CardDescription>
              Projects belong to an organization and inherit its access
              boundary.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link className="button button-primary" to="/app/organization">
              Open organizations
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="project-page-grid">
          <Card>
            <CardHeader>
              <CardTitle>Project spaces</CardTitle>
              <CardDescription>
                {isLoadingProjects
                  ? "Loading projects…"
                  : `${projects.filter(({ archivedAt }) => !archivedAt).length} active project${projects.filter(({ archivedAt }) => !archivedAt).length === 1 ? "" : "s"} in this organization.`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {projects.length > 0 ? (
                <ul className="project-list">
                  {projects.map((availableProject) => (
                    <li
                      className={
                        availableProject.id === project.id
                          ? "project-list-item project-list-item-active"
                          : "project-list-item"
                      }
                      key={availableProject.id}
                    >
                      <button
                        className="project-list-button"
                        onClick={() => selectProject(availableProject.id)}
                        type="button"
                      >
                        <span className="project-key">
                          {availableProject.key}
                        </span>
                        <strong>{availableProject.name}</strong>
                        {availableProject.archivedAt ? (
                          <Badge tone="neutral">Archived</Badge>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">
                  No projects yet. Create the first project below.
                </p>
              )}
              {canAdministerOrganization ? (
                <div className="project-form compact-form">
                  <h4>Create project</h4>
                  <Input
                    label="Project name"
                    onChange={(event) =>
                      setNewProjectForm({
                        ...newProjectForm,
                        name: event.target.value,
                      })
                    }
                    value={newProjectForm.name}
                  />
                  <Input
                    hint="2–10 uppercase letters or numbers, starting with a letter"
                    label="Project key"
                    onChange={(event) =>
                      setNewProjectForm({
                        ...newProjectForm,
                        key: event.target.value.toUpperCase(),
                      })
                    }
                    value={newProjectForm.key}
                  />
                  <Button
                    disabled={isBusy}
                    onClick={() => void createProject()}
                    size="sm"
                  >
                    Create project
                  </Button>
                </div>
              ) : (
                <p className="muted">
                  Only organization owners and admins can create projects.
                </p>
              )}
            </CardContent>
          </Card>

          {hasRealProject && selectedProject ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>{selectedProject.name} settings</CardTitle>
                  <CardDescription>
                    Project keys are stable identifiers used by future task and
                    repository integrations.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="project-form">
                    <Input
                      label="Project name"
                      onChange={(event) =>
                        setProjectForm({
                          ...projectForm,
                          name: event.target.value,
                        })
                      }
                      value={projectForm.name}
                    />
                    <Input
                      hint="2–10 uppercase letters or numbers, starting with a letter"
                      label="Project key"
                      onChange={(event) =>
                        setProjectForm({
                          ...projectForm,
                          key: event.target.value.toUpperCase(),
                        })
                      }
                      value={projectForm.key}
                    />
                    <label className="field">
                      <span className="pp-field-label">Description</span>
                      <textarea
                        className="pp-input project-description"
                        onChange={(event) =>
                          setProjectForm({
                            ...projectForm,
                            description: event.target.value,
                          })
                        }
                        value={projectForm.description}
                      />
                    </label>
                    <label className="field">
                      <span className="pp-field-label">Team</span>
                      <select
                        className="pp-input"
                        onChange={(event) =>
                          setProjectForm({
                            ...projectForm,
                            teamId: event.target.value,
                          })
                        }
                        value={projectForm.teamId}
                      >
                        <option value="">No team assigned</option>
                        {teams.map((team) => (
                          <option key={team.id} value={team.id}>
                            {team.teamKey} · {team.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="project-actions">
                      <Button
                        disabled={isBusy}
                        onClick={() => void updateProject()}
                      >
                        Save settings
                      </Button>
                      {!selectedProject.archivedAt ? (
                        <Button
                          disabled={isBusy}
                          onClick={() => void archiveProject()}
                          variant="danger"
                        >
                          Archive project
                        </Button>
                      ) : (
                        <Badge tone="neutral">Archived</Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Repositories</CardTitle>
                  <CardDescription>
                    Store repository metadata now; provider OAuth and
                    synchronization can connect later.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {repositories.length > 0 ? (
                    <ul className="repository-list">
                      {repositories.map((repository) => (
                        <li key={repository.id}>
                          <div>
                            <strong>{repository.name}</strong>
                            <a
                              href={repository.url}
                              rel="noreferrer"
                              target="_blank"
                            >
                              {repository.url}
                            </a>
                            <small>
                              {repository.provider} · {repository.defaultBranch}
                            </small>
                          </div>
                          <Button
                            onClick={() => void removeRepository(repository.id)}
                            size="sm"
                            variant="danger"
                          >
                            Remove
                          </Button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">No repository records registered.</p>
                  )}
                  <div className="project-form compact-form">
                    <h4>Register repository</h4>
                    <Input
                      label="Repository name"
                      onChange={(event) =>
                        setRepositoryForm({
                          ...repositoryForm,
                          name: event.target.value,
                        })
                      }
                      value={repositoryForm.name}
                    />
                    <Input
                      label="Repository URL"
                      onChange={(event) =>
                        setRepositoryForm({
                          ...repositoryForm,
                          url: event.target.value,
                        })
                      }
                      placeholder="https://github.com/example/repository"
                      type="url"
                      value={repositoryForm.url}
                    />
                    <div className="form-row">
                      <label className="field">
                        <span className="pp-field-label">Provider</span>
                        <select
                          className="pp-input"
                          onChange={(event) =>
                            setRepositoryForm({
                              ...repositoryForm,
                              provider: event.target
                                .value as RepositorySummary["provider"],
                            })
                          }
                          value={repositoryForm.provider}
                        >
                          <option value="other">Other</option>
                          <option value="github">GitHub</option>
                          <option value="gitlab">GitLab</option>
                        </select>
                      </label>
                      <Input
                        label="Default branch"
                        onChange={(event) =>
                          setRepositoryForm({
                            ...repositoryForm,
                            defaultBranch: event.target.value,
                          })
                        }
                        value={repositoryForm.defaultBranch}
                      />
                    </div>
                    <Button
                      disabled={isBusy}
                      onClick={() => void addRepository()}
                      size="sm"
                    >
                      Register repository
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Project members</CardTitle>
                  <CardDescription>
                    Project memberships narrow access inside the selected
                    organization.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="project-member-list">
                    {members.map((member) => (
                      <li key={member.id}>
                        <span>{member.userId}</span>
                        {canAdministerOrganization ? (
                          <span className="member-actions">
                            <select
                              className="pp-input member-role"
                              onChange={(event) =>
                                void updateProjectMember(
                                  member.id,
                                  event.target.value,
                                )
                              }
                              value={member.role}
                            >
                              <option value="admin">admin</option>
                              <option value="member">member</option>
                              <option value="viewer">viewer</option>
                            </select>
                            <Button
                              onClick={() =>
                                void removeProjectMember(member.id)
                              }
                              size="sm"
                              variant="danger"
                            >
                              Remove
                            </Button>
                          </span>
                        ) : (
                          <Badge
                            tone={
                              member.role === "viewer" ? "neutral" : "accent"
                            }
                          >
                            {member.role}
                          </Badge>
                        )}
                      </li>
                    ))}
                  </ul>
                  {canAdministerOrganization ? (
                    <div className="project-form compact-form">
                      <h4>Add project member</h4>
                      <label className="field">
                        <span className="pp-field-label">
                          Organization member
                        </span>
                        <select
                          className="pp-input"
                          onChange={(event) =>
                            setMemberForm({
                              ...memberForm,
                              userId: event.target.value,
                            })
                          }
                          value={memberForm.userId}
                        >
                          <option value="">Choose a member</option>
                          {organizationMembers
                            .filter(
                              (organizationMember) =>
                                !members.some(
                                  (member) =>
                                    member.userId === organizationMember.userId,
                                ),
                            )
                            .map((organizationMember) => (
                              <option
                                key={organizationMember.userId}
                                value={organizationMember.userId}
                              >
                                {organizationMember.userId} ·{" "}
                                {organizationMember.role}
                              </option>
                            ))}
                        </select>
                      </label>
                      <label className="field">
                        <span className="pp-field-label">Project role</span>
                        <select
                          className="pp-input"
                          onChange={(event) =>
                            setMemberForm({
                              ...memberForm,
                              role: event.target.value,
                            })
                          }
                          value={memberForm.role}
                        >
                          <option value="member">member</option>
                          <option value="admin">admin</option>
                          <option value="viewer">viewer</option>
                        </select>
                      </label>
                      <Button
                        disabled={isBusy || !memberForm.userId}
                        onClick={() => void addProjectMember()}
                        size="sm"
                      >
                        Add member
                      </Button>
                    </div>
                  ) : (
                    <p className="muted">
                      Only organization owners and admins can manage project
                      memberships.
                    </p>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Project settings</CardTitle>
                <CardDescription>
                  Create a project to register repositories and manage
                  project-level members.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="muted">
                  {canAdministerOrganization
                    ? "Use the form in the project list to create your first project."
                    : "An organization owner or admin must create a project before it can be used."}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </PageLayout>
  );
}
