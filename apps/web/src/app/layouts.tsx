import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Activity,
  Bell,
  Building2,
  Columns3,
  ExternalLink,
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  ListTodo,
  LogOut,
  Menu,
  Map,
  X,
} from "lucide-react";

import { ReleaseArcMark } from "./brand.js";
import { useAuth } from "./auth-context.js";
import { useOrganization } from "./organization-context.js";
import { useProject } from "./project-context.js";
import { useNotifications } from "../features/notifications/use-notifications.js";
import { NotificationHeaderLink } from "../pages/notifications-page.js";

const navigationItems = [
  { icon: LayoutDashboard, label: "Overview", to: "/app", end: true },
  { icon: Activity, label: "Activity", to: "/app/activity", end: false },
  { icon: Bell, label: "Notifications", to: "/app/notifications", end: false },
  { icon: ListTodo, label: "Tasks", to: "/app/tasks", end: false },
  { icon: Columns3, label: "Board", to: "/app/board", end: false },
  { icon: ListChecks, label: "Backlog", to: "/app/backlog", end: false },
  { icon: Map, label: "Roadmap", to: "/app/roadmap", end: false },
  { icon: FolderKanban, label: "Projects", to: "/app/projects", end: false },
  {
    icon: Building2,
    label: "Organization",
    to: "/app/organization",
    end: false,
  },
] as const;

function Brand() {
  return (
    <Link className="brand" to="/">
      <ReleaseArcMark size={36} />
      <span className="brand-copy">
        <span className="brand-name">ReleaseArc</span>
        <span className="brand-tagline">Delivery intelligence</span>
      </span>
    </Link>
  );
}

export function PublicLayout() {
  const { status } = useAuth();

  if (status === "authenticated") {
    return <Navigate replace to="/app" />;
  }

  return (
    <div className="public-layout">
      <header className="public-header">
        <Brand />
        <nav className="public-nav" aria-label="Public page navigation">
          <a href="#product">Product</a>
          <a href="#how-it-works">How it works</a>
          <a href="#principles">Principles</a>
        </nav>
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
  const { status } = useAuth();

  if (status === "authenticated") {
    return <Navigate replace to="/app" />;
  }

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
  const location = useLocation();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
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
  const notificationScope = useMemo(
    () =>
      session && selectedOrganizationId
        ? {
            organizationId: selectedOrganizationId,
            userId: session.user.id,
          }
        : null,
    [selectedOrganizationId, session],
  );
  const { unreadCount } = useNotifications(notificationScope);
  const hasSelectedProject = Boolean(project.id);
  const accountLabel = isDemoMode
    ? "Demo workspace"
    : (session?.user.email ?? "Signed-in user");

  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [location.pathname]);

  function closeMobileNavigation() {
    setIsMobileNavOpen(false);
  }

  return (
    <div className="app-shell">
      <aside
        className={`app-sidebar${
          isMobileNavOpen ? " app-sidebar-mobile-open" : ""
        }`}
        id="app-sidebar"
      >
        <div className="sidebar-brand-row">
          <Brand />
          <div className="sidebar-brand-actions">
            <span className="sidebar-version">BETA</span>
            <button
              aria-label="Close navigation"
              className="mobile-nav-close"
              onClick={closeMobileNavigation}
              type="button"
            >
              <X aria-hidden="true" size={18} strokeWidth={2} />
            </button>
          </div>
        </div>
        <div className="sidebar-workspace-label">Workspace</div>
        <div className="project-switcher" aria-label="Current project">
          <span className="project-switcher-mark" aria-hidden="true">
            {hasSelectedProject ? project.key.slice(0, 1) : "—"}
          </span>
          <div className="project-switcher-copy">
            <span className="project-key">
              {hasSelectedProject ? project.key : "Workspace"}
            </span>
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
            <Link
              className="context-link"
              to={
                organizations.length > 0 ? "/app/projects" : "/app/organization"
              }
            >
              {organizations.length > 0
                ? "Create a project"
                : "Set up an organization"}
              <ExternalLink aria-hidden="true" size={14} strokeWidth={2} />
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
              onClick={closeMobileNavigation}
              to={item.to}
            >
              <span aria-hidden="true" className="nav-link-icon">
                <item.icon size={17} strokeWidth={1.8} />
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
              <strong>{accountLabel}</strong>
              <small>{session?.user.email ?? "Preview account"}</small>
            </span>
          </div>
          <button
            className="sidebar-sign-out"
            type="button"
            onClick={() => void signOut()}
          >
            <LogOut aria-hidden="true" size={15} strokeWidth={1.9} /> Sign out
          </button>
        </div>
      </aside>
      <button
        aria-label="Close navigation"
        className={`app-sidebar-backdrop${
          isMobileNavOpen ? " app-sidebar-backdrop-visible" : ""
        }`}
        onClick={closeMobileNavigation}
        type="button"
      />
      <div className="app-main">
        <header className="app-header">
          <button
            aria-controls="app-sidebar"
            aria-expanded={isMobileNavOpen}
            aria-label="Open navigation"
            className="mobile-nav-toggle"
            onClick={() => setIsMobileNavOpen(true)}
            type="button"
          >
            <Menu aria-hidden="true" size={18} strokeWidth={2} />
          </button>
          <div className="app-breadcrumbs">
            <span>ReleaseArc</span>
            <span aria-hidden="true">/</span>
            <strong>{project.name}</strong>
          </div>
          <div className="app-header-actions">
            <Link className="header-quick-link" to="/app/activity">
              <Activity aria-hidden="true" size={16} strokeWidth={1.9} />{" "}
              Activity
            </Link>
            <NotificationHeaderLink unreadCount={unreadCount} />
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
