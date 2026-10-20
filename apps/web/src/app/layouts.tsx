import { Link, NavLink, Outlet } from "react-router-dom";

import { ProjectPulseMark } from "./brand.js";
import { useAuth } from "./auth-context.js";
import { useOrganization } from "./organization-context.js";
import { useProject } from "./project-context.js";

const navigationItems = [
  { icon: "◌", label: "Overview", to: "/app", end: true },
  { icon: "⌁", label: "Activity", to: "/app/activity", end: false },
  { icon: "✓", label: "Tasks", to: "/app/tasks", end: false },
  { icon: "▦", label: "Projects", to: "/app/projects", end: false },
  { icon: "◎", label: "Organization", to: "/app/organization", end: false },
] as const;

function Brand() {
  return (
    <Link className="brand" to="/">
      <ProjectPulseMark size={36} />
      <span className="brand-copy">
        <span className="brand-name">ProjectPulse</span>
        <span className="brand-tagline">Engineering intelligence</span>
      </span>
    </Link>
  );
}

export function PublicLayout() {
  return (
    <div className="public-layout">
      <header className="public-header">
        <Brand />
        <Link className="button button-secondary button-small" to="/auth/login">
          Sign in
        </Link>
      </header>
      <main className="public-content">
        <Outlet />
      </main>
    </div>
  );
}

export function AuthLayout() {
  return (
    <div className="auth-layout">
      <header className="auth-header">
        <Brand />
      </header>
      <main className="auth-content">
        <Outlet />
      </main>
    </div>
  );
}

export function AppLayout() {
  const {
    isLoading: isLoadingProjects,
    project,
    projects,
    selectProject,
  } = useProject();
  const { isDemoMode, session, signOut } = useAuth();
  const {
    isLoading: isLoadingOrganizations,
    organizations,
    selectOrganization,
    selectedOrganization,
    selectedOrganizationId,
  } = useOrganization();

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="sidebar-brand-row">
          <Brand />
          <span className="sidebar-version">BETA</span>
        </div>
        <div className="sidebar-workspace-label">Workspace</div>
        <div className="project-switcher" aria-label="Current project">
          <span className="project-switcher-mark" aria-hidden="true">
            {project.key.slice(0, 1)}
          </span>
          <div className="project-switcher-copy">
            <span className="project-key">{project.key}</span>
            <strong>{project.name}</strong>
          </div>
          {projects.length > 0 ? (
            <select
              aria-label="Current project"
              className="sidebar-select"
              disabled={isLoadingProjects}
              onChange={(event) => selectProject(event.target.value)}
              value={project.id}
            >
              {projects.map((availableProject) => (
                <option key={availableProject.id} value={availableProject.id}>
                  {availableProject.key} · {availableProject.name}
                </option>
              ))}
            </select>
          ) : (
            <Link className="context-link" to="/app/projects">
              Create a project <span aria-hidden="true">↗</span>
            </Link>
          )}
        </div>
        <div className="organization-switcher">
          <span className="context-label">Organization context</span>
          {organizations.length > 0 ? (
            <select
              aria-label="Current organization"
              className="sidebar-select"
              disabled={isLoadingOrganizations}
              onChange={(event) => selectOrganization(event.target.value)}
              value={selectedOrganizationId}
            >
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name} · {organization.role}
                </option>
              ))}
            </select>
          ) : (
            <Link className="context-link" to="/app/organization">
              Set up an organization
            </Link>
          )}
          {selectedOrganization ? (
            <small>
              {selectedOrganization.slug} · {selectedOrganization.role}
            </small>
          ) : null}
        </div>
        <nav className="sidebar-nav" aria-label="Primary navigation">
          <p className="nav-heading">Workspace</p>
          {navigationItems.map((item) => (
            <NavLink
              className={({ isActive }) =>
                `nav-link${isActive ? " nav-link-active" : ""}`
              }
              end={item.end}
              key={item.to}
              to={item.to}
            >
              <span aria-hidden="true" className="nav-link-icon">
                {item.icon}
              </span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-sync-status">
            <span className="status-dot" aria-hidden="true" />
            <span>
              <strong>{isDemoMode ? "Demo mode" : "Live workspace"}</strong>
              <small>
                {isDemoMode
                  ? "Local preview enabled"
                  : "Signals are up to date"}
              </small>
            </span>
          </div>
          <div className="sidebar-account">
            <span className="account-avatar" aria-hidden="true">
              {isDemoMode
                ? "D"
                : (session?.user.email?.slice(0, 1).toUpperCase() ?? "P")}
            </span>
            <span>
              <strong>
                {isDemoMode ? "Demo workspace" : "ProjectPulse user"}
              </strong>
              <small>{session?.user.email ?? "Preview account"}</small>
            </span>
          </div>
          <button
            className="sidebar-sign-out"
            type="button"
            onClick={() => void signOut()}
          >
            <span aria-hidden="true">↪</span> Sign out
          </button>
        </div>
      </aside>
      <div className="app-main">
        <header className="app-header">
          <div className="app-breadcrumbs">
            <span>ProjectPulse</span>
            <span aria-hidden="true">/</span>
            <strong>{project.name}</strong>
          </div>
          <div className="app-header-actions">
            <Link className="header-quick-link" to="/app/activity">
              <span aria-hidden="true">⌁</span> Activity
            </Link>
            <div className="header-status" aria-label="Workspace status">
              <span className="status-dot" aria-hidden="true" />
              {isDemoMode ? "Demo preview" : "Live workspace"}
            </div>
            <span className="header-avatar" aria-hidden="true">
              {isDemoMode ? "D" : "P"}
            </span>
          </div>
        </header>
        <div className="app-header-title">
          <p className="eyebrow">Engineering control plane</p>
          <h1>{project.name}</h1>
        </div>
        <main className="app-content" id="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
