import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";

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
} from "@releasearc/ui";

import { supabase, supabaseAuthConfig } from "../app/auth-client.js";
import { useAuth } from "../app/auth-context.js";
import { useOrganization } from "../app/organization-context.js";
import { useProject } from "../app/project-context.js";

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

interface DeliverySummary {
  failedCheckCount: number;
  failedDeploymentCount: number;
  githubDeliveryCount: number;
  lastGithubDeliveryAt: string | null;
  openPullRequestCount: number;
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

function githubProviderToken(session: Session | null) {
  return (session as (Session & { provider_token?: string }) | null)
    ?.provider_token;
}

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

async function edgeFunctionErrorMessage(
  error: { context?: unknown; message?: string },
  fallback: string,
) {
  const context = error.context;
  if (context instanceof Response) {
    try {
      const body = (await context.clone().json()) as unknown;
      if (
        typeof body === "object" &&
        body !== null &&
        "error" in body &&
        typeof body.error === "string"
      ) {
        return body.error;
      }
    } catch {
      // Fall back to the SDK error message when the response is not JSON.
    }
  }
  return error.message || fallback;
}

export function ProjectsPage() {
  const { linkGithubIdentity, session, status } = useAuth();
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
  const [deliverySummary, setDeliverySummary] =
    useState<DeliverySummary | null>(null);
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
  const [githubConnectionState, setGithubConnectionState] = useState<
    "idle" | "connecting" | "connected"
  >("idle");
  const detailsSequence = useRef(0);

  const canAdministerOrganization =
    selectedOrganization?.role === "owner" ||
    selectedOrganization?.role === "admin";
  const hasRealProject = Boolean(selectedOrganizationId) && Boolean(project.id);
  const selectedProject = useMemo(
    () => projects.find(({ id }) => id === project.id),
    [project.id, projects],
  );
  const githubRepository = repositories.find(
    (repository) => repository.provider === "github",
  );
  const githubWebhookEndpoint = `${supabaseAuthConfig.url}/functions/v1/github-webhook`;

  async function loadProjectDetails(projectId: string) {
    const requestId = ++detailsSequence.current;
    if (!selectedOrganizationId) {
      setTeams([]);
      setRepositories([]);
      setDeliverySummary(null);
      setMembers([]);
      setOrganizationMembers([]);
      return;
    }

    const { data: teamData, error: teamError } = await supabase
      .from("teams")
      .select("id, name, team_key")
      .eq("organization_id", selectedOrganizationId)
      .order("name");
    if (requestId !== detailsSequence.current) {
      return;
    }
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
      setDeliverySummary(null);
      setMembers([]);
      setOrganizationMembers([]);
      return;
    }

    const [
      { data: repositoryData, error: repositoryError },
      { data: memberData, error: memberError },
      { data: organizationMemberData, error: organizationMemberError },
      { data: deliverySummaryData },
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
      supabase.rpc("get_project_delivery_summary", {
        target_organization_id: selectedOrganizationId,
        target_project_id: projectId,
      }),
    ]);

    if (requestId !== detailsSequence.current) {
      return;
    }

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
    const deliveryRow = (
      Array.isArray(deliverySummaryData)
        ? deliverySummaryData[0]
        : deliverySummaryData
    ) as {
      failed_check_count?: number;
      failed_deployment_count?: number;
      github_delivery_count?: number;
      last_github_delivery_at?: string | null;
      open_pull_request_count?: number;
    } | null;
    setDeliverySummary(
      deliveryRow
        ? {
            failedCheckCount: Number(deliveryRow.failed_check_count ?? 0),
            failedDeploymentCount: Number(
              deliveryRow.failed_deployment_count ?? 0,
            ),
            githubDeliveryCount: Number(deliveryRow.github_delivery_count ?? 0),
            lastGithubDeliveryAt: deliveryRow.last_github_delivery_at ?? null,
            openPullRequestCount: Number(
              deliveryRow.open_pull_request_count ?? 0,
            ),
          }
        : null,
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
    setGithubConnectionState("idle");
  }, [project.id]);

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

  async function connectGithubRepository(repositoryUrl: string) {
    if (!selectedOrganizationId || !hasRealProject) {
      return;
    }
    if (!repositoryUrl.trim()) {
      setError("Enter a GitHub repository URL first.");
      return;
    }

    setIsBusy(true);
    setGithubConnectionState("connecting");
    setError(null);

    const {
      data: { session: currentSession },
    } = await supabase.auth.getSession();
    const providerToken = githubProviderToken(currentSession ?? session);
    if (!providerToken) {
      const result = await linkGithubIdentity();
      setIsBusy(false);
      setGithubConnectionState("idle");
      if (result.error) {
        setError(result.error);
      } else {
        setMessage(
          "Connect GitHub in the browser, then return to Projects to finish the automatic setup.",
        );
      }
      return;
    }

    const { data, error: connectionError } = await supabase.functions.invoke(
      "github-connect",
      {
        body: {
          github_access_token: providerToken,
          project_id: project.id,
          repository_url: repositoryUrl.trim(),
        },
      },
    );
    setIsBusy(false);

    if (connectionError) {
      setGithubConnectionState("idle");
      setError(
        await edgeFunctionErrorMessage(
          connectionError,
          "GitHub could not be connected automatically. Use the manual setup below.",
        ),
      );
      return;
    }

    setGithubConnectionState("connected");
    setRepositoryForm(emptyRepository);
    setMessage(
      data?.webhook?.created
        ? "GitHub connected and webhook created automatically."
        : "GitHub connected and webhook configuration refreshed.",
    );
    await loadProjectDetails(project.id);
  }

  async function removeRepository(repositoryId: string) {
    if (
      !selectedOrganizationId ||
      !hasRealProject ||
      !canAdministerOrganization
    ) {
      return;
    }

    setIsBusy(true);
    setError(null);
    const { error: removeError } = await supabase
      .from("repositories")
      .delete()
      .eq("id", repositoryId)
      .eq("organization_id", selectedOrganizationId)
      .eq("project_id", project.id);
    setIsBusy(false);
    if (removeError) {
      setError(errorMessage(removeError, "Could not disconnect repository."));
      return;
    }

    setMessage("Repository disconnected. Delivery history was preserved.");
    await loadProjectDetails(project.id);
  }

  async function copyWebhookEndpoint() {
    const endpoint = `${supabaseAuthConfig.url}/functions/v1/github-webhook`;
    if (!navigator.clipboard) {
      setError("Clipboard access is unavailable. Copy the endpoint manually.");
      return;
    }
    await navigator.clipboard.writeText(endpoint);
    setMessage("GitHub webhook endpoint copied.");
  }

  function formatDeliveryTime(timestamp: string | null) {
    if (!timestamp) return "No delivery received yet";
    const date = new Date(timestamp);
    return Number.isNaN(date.getTime())
      ? "Delivery time unavailable"
      : `Last delivery ${date.toLocaleString()}`;
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
                  <div className="integration-card-heading">
                    <div>
                      <CardTitle>GitHub delivery signals</CardTitle>
                      <CardDescription>
                        Connect repository webhooks to turn pull requests, CI,
                        reviews, deployments, and releases into delivery
                        context.
                      </CardDescription>
                    </div>
                    <Badge tone={githubRepository ? "success" : "warning"}>
                      {githubRepository
                        ? "Repository ready"
                        : "Needs repository"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {githubRepository ? (
                    <div className="github-setup-panel">
                      <div className="github-setup-copy">
                        <strong>{githubRepository.name}</strong>
                        <span>
                          ReleaseArc can register this repository and create or
                          repair its GitHub webhook automatically.
                        </span>
                      </div>
                      <div className="github-auto-connect">
                        <div className="github-auto-connect-copy">
                          <strong>
                            {githubConnectionState === "connected"
                              ? "Webhook connected"
                              : "Automatic setup"}
                          </strong>
                          <span>
                            {githubConnectionState === "connected"
                              ? "Future pull requests, reviews, checks, deployments, and releases will be delivered here."
                              : "Use your connected GitHub account to finish this setup without copying secrets or opening repository settings."}
                          </span>
                        </div>
                        <Button
                          disabled={isBusy}
                          onClick={() =>
                            void connectGithubRepository(githubRepository.url)
                          }
                          size="sm"
                        >
                          {githubConnectionState === "connecting"
                            ? "Connecting…"
                            : githubConnectionState === "connected"
                              ? "Refresh connection"
                              : "Connect automatically"}
                        </Button>
                      </div>
                      <details className="github-manual-fallback">
                        <summary>Show manual webhook setup</summary>
                        <div className="github-webhook-row">
                          <Input
                            label="Webhook endpoint"
                            readOnly
                            value={githubWebhookEndpoint}
                          />
                          <Button
                            onClick={() => void copyWebhookEndpoint()}
                            size="sm"
                            variant="secondary"
                          >
                            Copy endpoint
                          </Button>
                        </div>
                        <ol className="github-setup-steps">
                          <li>
                            In GitHub, open{" "}
                            <strong>Settings → Webhooks → Add webhook</strong>.
                          </li>
                          <li>
                            Use <strong>application/json</strong> and configure
                            the same secret as{" "}
                            <code>GITHUB_WEBHOOK_SECRET</code> in the webhook
                            function environment.
                          </li>
                          <li>
                            Enable pull requests, reviews, pushes, check runs,
                            deployment statuses, and releases.
                          </li>
                        </ol>
                      </details>
                      <div
                        className="github-delivery-metrics"
                        aria-label="GitHub delivery health"
                      >
                        <div>
                          <span>Deliveries</span>
                          <strong>
                            {deliverySummary?.githubDeliveryCount ?? 0}
                          </strong>
                        </div>
                        <div>
                          <span>Open PRs</span>
                          <strong>
                            {deliverySummary?.openPullRequestCount ?? 0}
                          </strong>
                        </div>
                        <div>
                          <span>Failed checks</span>
                          <strong>
                            {deliverySummary?.failedCheckCount ?? 0}
                          </strong>
                        </div>
                        <div>
                          <span>Deploy failures</span>
                          <strong>
                            {deliverySummary?.failedDeploymentCount ?? 0}
                          </strong>
                        </div>
                      </div>
                      <p className="muted github-last-delivery">
                        {formatDeliveryTime(
                          deliverySummary?.lastGithubDeliveryAt ?? null,
                        )}
                      </p>
                    </div>
                  ) : (
                    <p className="muted">
                      Register a GitHub repository in the Repositories card to
                      receive the webhook endpoint and delivery health checks.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Repositories</CardTitle>
                  <CardDescription>
                    Register the repository that supplies delivery signals to
                    this project, then connect its GitHub webhook below.
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
                          {canAdministerOrganization ? (
                            <Button
                              disabled={isBusy}
                              onClick={() =>
                                void removeRepository(repository.id)
                              }
                              size="sm"
                              variant="danger"
                            >
                              Disconnect
                            </Button>
                          ) : null}
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
                    <div className="project-actions">
                      <Button
                        disabled={isBusy}
                        onClick={() => void addRepository()}
                        size="sm"
                      >
                        Register repository
                      </Button>
                      {repositoryForm.provider === "github" ? (
                        <Button
                          disabled={isBusy || !repositoryForm.url.trim()}
                          onClick={() =>
                            void connectGithubRepository(repositoryForm.url)
                          }
                          size="sm"
                          variant="secondary"
                        >
                          Connect GitHub + webhook
                        </Button>
                      ) : null}
                    </div>
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
