import { Link, NavLink, Outlet } from "react-router-dom";

import { useAuth } from "./auth-context.js";
import { useProject } from "./project-context.js";

const navigationItems = [
  { label: "Overview", to: "/app", end: true },
  { label: "Activity", to: "/app/activity", end: false },
] as const;

function Brand() {
  return (
    <Link className="brand" to="/">
      <span className="brand-mark" aria-hidden="true">
        P
      </span>
      <span>ProjectPulse</span>
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
  const { project } = useProject();
  const { signOut } = useAuth();

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <Brand />
        </div>
        <div className="project-switcher" aria-label="Current project">
          <span className="project-key">{project.key}</span>
          <strong>{project.name}</strong>
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
              <span aria-hidden="true" className="nav-link-dot" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button className="sidebar-sign-out" type="button" onClick={signOut}>
          Sign out
        </button>
      </aside>
      <div className="app-main">
        <header className="app-header">
          <div>
            <p className="eyebrow">Engineering control plane</p>
            <h1>{project.name}</h1>
          </div>
          <div className="header-status" aria-label="Workspace status">
            <span className="status-dot" aria-hidden="true" />
            Live workspace
          </div>
        </header>
        <main className="app-content" id="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
