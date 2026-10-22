import { useProject } from "../app/project-context.js";

export function ActivityPage() {
  const { project } = useProject();

  return (
    <section aria-labelledby="activity-title">
      <div className="page-heading">
        <div>
          <p className="eyebrow">{project.key} workspace</p>
          <h2 id="activity-title">Activity stream</h2>
          <p>Source-control, CI, and planning signals will appear here.</p>
        </div>
      </div>
      <div className="activity-panel">
        <p className="eyebrow">Ready for events</p>
        <h3>Connect a repository to start the stream.</h3>
        <p className="muted">
          GitHub event normalization and realtime synchronization will populate
          this view in the next product milestones.
        </p>
      </div>
    </section>
  );
}
