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
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">{project.key} workspace</p>
          <h2>Good morning, team.</h2>
          <p>Here is the latest pulse across your engineering work.</p>
        </div>
        <Link className="button button-primary" to="/app/activity">
          View activity
        </Link>
      </section>
      <section className="metric-grid" aria-label="Workspace metrics">
        {metrics.map(([label, value, detail]) => (
          <article className="metric-card" key={label}>
            <span>{label}</span>
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
        className="activity-panel"
        aria-labelledby="recent-activity-title"
      >
        <h3 id="recent-activity-title">Recent workspace activity</h3>
        <ul className="activity-list">
          {activity.map(([description, time]) => (
            <li key={description}>
              <span className="signal-dot" aria-hidden="true" />
              <p>{description}</p>
              <small>{time}</small>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
