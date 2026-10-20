import { Link } from "react-router-dom";

const signals = [
  ["Planning", "Roadmap and task flow"],
  ["Developer activity", "Privacy-aware workspace signals"],
  ["Delivery health", "CI, review, and release context"],
] as const;

const features = [
  [
    "Connect the plan",
    "Keep roadmap intent and delivery context in one place.",
  ],
  [
    "See the signal",
    "Understand flow without collecting source code or keystrokes.",
  ],
  [
    "Move with confidence",
    "Make decisions from reliable, permission-aware events.",
  ],
] as const;

export function LandingPage() {
  return (
    <>
      <section className="hero landing-hero" aria-labelledby="hero-title">
        <div className="hero-copy-column">
          <div className="hero-kicker">
            <span className="hero-kicker-dot" aria-hidden="true" />
            Engineering control plane
          </div>
          <h1 id="hero-title">Make delivery feel visible.</h1>
          <p className="hero-copy">
            ProjectPulse turns scattered engineering signals into one clear
            picture of what is moving, what is stuck, and what needs attention.
          </p>
          <div className="hero-actions">
            <Link
              className="button button-primary button-arrow"
              to="/auth/login"
            >
              Open the workspace <span aria-hidden="true">↗</span>
            </Link>
            <Link className="button button-secondary" to="/auth/login">
              View demo dashboard
            </Link>
          </div>
          <p className="hero-note">
            <span aria-hidden="true">✦</span> Start with a local demo. No
            account needed for the preview.
          </p>
        </div>
        <div className="hero-visual-stage">
          <div className="signal-field" aria-hidden="true">
            <span className="signal-field-grid" />
            <span className="signal-ring signal-ring-outer" />
            <span className="signal-ring signal-ring-middle" />
            <span className="signal-ring signal-ring-inner" />
            <span className="signal-arc signal-arc-one" />
            <span className="signal-arc signal-arc-two" />
            <span className="signal-orbit-dot signal-orbit-dot-one" />
            <span className="signal-orbit-dot signal-orbit-dot-two" />
            <span className="signal-orbit-dot signal-orbit-dot-three" />
            <span className="signal-node signal-node-planning">
              <i />
              <b>Planning</b>
            </span>
            <span className="signal-node signal-node-activity">
              <i />
              <b>Activity</b>
            </span>
            <span className="signal-node signal-node-delivery">
              <i />
              <b>Delivery</b>
            </span>
            <span className="signal-core">
              <span>LIVE PULSE</span>
              <strong>92</strong>
              <small>delivery health</small>
            </span>
          </div>
          <aside
            className="hero-card hero-dashboard-card"
            aria-label="ProjectPulse workspace preview"
          >
            <div className="hero-card-topline">
              <span className="preview-window-dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <span className="preview-window-label">PULSE / OVERVIEW</span>
              <span className="preview-live-label">
                <span className="signal-dot" aria-hidden="true" /> Live
              </span>
            </div>
            <div className="preview-heading">
              <div>
                <span className="preview-eyebrow">Tuesday, October 20</span>
                <strong>Good morning, team.</strong>
              </div>
              <span className="preview-avatar" aria-hidden="true">
                PP
              </span>
            </div>
            <div className="preview-metrics">
              <div>
                <span>Active tasks</span>
                <strong>24</strong>
                <small>+8% this week</small>
              </div>
              <div>
                <span>In review</span>
                <strong>07</strong>
                <small>2 ready to merge</small>
              </div>
              <div className="preview-health">
                <span>Delivery health</span>
                <strong>92%</strong>
                <small>
                  <i aria-hidden="true" /> Healthy signal
                </small>
              </div>
            </div>
            <div className="preview-activity">
              <div className="preview-section-heading">
                <strong>Recent activity</strong>
                <span>View all</span>
              </div>
              {signals.map(([title, detail], index) => (
                <div className="preview-activity-row" key={title}>
                  <span
                    className={`preview-activity-icon preview-activity-icon-${index + 1}`}
                    aria-hidden="true"
                  >
                    {index === 0 ? "↗" : index === 1 ? "⌁" : "✓"}
                  </span>
                  <div>
                    <strong>{title}</strong>
                    <span>{detail}</span>
                  </div>
                  <small>
                    {index === 0 ? "8m" : index === 1 ? "32m" : "1h"}
                  </small>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </section>
      <section className="landing-proof" aria-label="ProjectPulse capabilities">
        <div className="landing-proof-heading">
          <span className="eyebrow">A clearer operating rhythm</span>
          <p>Everything your team needs to turn movement into momentum.</p>
        </div>
        <div className="feature-grid">
          {features.map(([title, detail], index) => (
            <article className="feature-card" key={title}>
              <span className="feature-index">0{index + 1}</span>
              <span className="signal-dot" aria-hidden="true" />
              <h2>{title}</h2>
              <p>{detail}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
