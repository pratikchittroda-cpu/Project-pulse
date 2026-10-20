import { Link } from "react-router-dom";
import { StatusBadge } from "@projectpulse/ui";

import { useProject } from "../app/project-context.js";

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
  const { project } = useProject();

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
