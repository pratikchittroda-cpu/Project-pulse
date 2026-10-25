import { Link } from "react-router-dom";
import { StatusBadge } from "@releasearc/ui";

import { useAuth } from "../app/auth-context.js";
import { useProject } from "../app/project-context.js";
import { LiveDashboardPage } from "../features/dashboard/live-dashboard.js";

const metrics = [
  ["Active tasks", "24", "+8% this week"],
  ["In review", "7", "2 ready to merge"],
  ["Delivery health", "92%", "Healthy signal"],
] as const;

const activity = [
  ["CI checks passed on pulse-api", "8 min ago"],
  ["Roadmap review scheduled for Friday", "32 min ago"],
  ["New task linked to the PULSE project", "1 hr ago"],
] as const;

export function DashboardPage() {
  const { isDemoMode } = useAuth();
  const { project } = useProject();

  if (!isDemoMode) {
    return <LiveDashboardPage />;
  }

  return (
    <div className="dashboard-page">
      <section className="page-heading dashboard-heading">
        <div>
          <p className="eyebrow">{project.key} / overview</p>
          <h2>Good morning, team.</h2>
          <p>Here is the latest pulse across your engineering work.</p>
        </div>
        <div className="dashboard-heading-actions">
          <span className="last-updated">
            <span className="status-dot" aria-hidden="true" /> Updated just now
          </span>
          <Link
            className="button button-primary button-arrow"
            to="/app/activity"
          >
            View activity <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </section>
      <section className="metric-grid" aria-label="Workspace metrics">
        {metrics.map(([label, value, detail], index) => (
          <article
            className={`metric-card metric-card-${index + 1}`}
            key={label}
          >
            <div className="metric-card-label">
              <span>{label}</span>
              <span className="metric-card-icon" aria-hidden="true">
                {index === 0 ? "↗" : index === 1 ? "⌁" : "✦"}
              </span>
            </div>
            <strong>{value}</strong>
            <small>
              <StatusBadge
                label={detail}
                status={
                  label === "Delivery health" ? "completed" : "in_progress"
                }
              />
            </small>
          </article>
        ))}
      </section>
      <section
        className="dashboard-signal-band"
        aria-labelledby="pulse-score-title"
      >
        <div className="signal-band-copy">
          <p className="panel-kicker">Pulse score</p>
          <h3 id="pulse-score-title">Delivery health is trending up.</h3>
          <p>
            Your team is moving through review faster this week, with fewer
            blocked handoffs across the active project stream.
          </p>
          <div className="signal-band-meta">
            <span className="signal-band-change">↗ 12.4%</span>
            <span>compared with last week</span>
          </div>
        </div>
        <div
          className="signal-score-ring"
          aria-label="Delivery health score: 92 out of 100"
        >
          <div>
            <strong>92</strong>
            <span>/ 100</span>
            <small>healthy</small>
          </div>
        </div>
        <div
          className="signal-band-chart"
          aria-label="Delivery health trend over the last seven days"
          role="img"
        >
          <svg
            viewBox="0 0 420 150"
            aria-hidden="true"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="pulse-area" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#8d80ff" stopOpacity="0.42" />
                <stop offset="100%" stopColor="#8d80ff" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              className="pulse-chart-area"
              d="M0 122 C35 114 42 92 72 98 S118 116 145 83 S188 69 214 78 S258 84 282 54 S328 65 348 42 S388 35 420 14 V150 H0 Z"
              fill="url(#pulse-area)"
            />
            <path
              className="pulse-chart-line"
              d="M0 122 C35 114 42 92 72 98 S118 116 145 83 S188 69 214 78 S258 84 282 54 S328 65 348 42 S388 35 420 14"
              fill="none"
              pathLength="1"
              stroke="#8d80ff"
              strokeLinecap="round"
              strokeWidth="3"
            />
            <circle className="pulse-chart-point" cx="420" cy="14" r="5" />
          </svg>
          <div className="signal-band-axis" aria-hidden="true">
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Today</span>
          </div>
        </div>
      </section>
      <div className="dashboard-grid">
        <section
          className="activity-panel"
          aria-labelledby="recent-activity-title"
        >
          <div className="panel-heading-row">
            <div>
              <p className="panel-kicker">Signal stream</p>
              <h3 id="recent-activity-title">Recent workspace activity</h3>
            </div>
            <Link to="/app/activity">
              View all <span aria-hidden="true">↗</span>
            </Link>
          </div>
          <ul className="activity-list">
            {activity.map(([description, time], index) => (
              <li key={description}>
                <span
                  className={`activity-marker activity-marker-${index + 1}`}
                  aria-hidden="true"
                >
                  {index === 0 ? "↗" : index === 1 ? "⌁" : "✓"}
                </span>
                <p>{description}</p>
                <small>{time}</small>
              </li>
            ))}
          </ul>
        </section>
        <aside className="focus-panel" aria-labelledby="focus-title">
          <div className="focus-panel-orb" aria-hidden="true">
            ✦
          </div>
          <p className="panel-kicker">Team focus</p>
          <h3 id="focus-title">Keep the next move obvious.</h3>
          <p>
            Link a repository or create a project to turn this preview into your
            team&apos;s operating view.
          </p>
          <Link
            className="button button-secondary button-arrow"
            to="/app/projects"
          >
            Set up a project <span aria-hidden="true">↗</span>
          </Link>
        </aside>
      </div>
    </div>
  );
}
