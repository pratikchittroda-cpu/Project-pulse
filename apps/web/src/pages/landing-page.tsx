import { Link } from "react-router-dom";

const signals = [
  ["Planning", "Roadmap and task flow"],
  ["Developer activity", "Privacy-aware workspace signals"],
  ["Delivery health", "CI, review, and release context"],
] as const;

const features = [
  [
    "Connect the plan",
    "Keep the work queue and delivery context in one place.",
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
      <section className="hero" aria-labelledby="hero-title">
        <div>
          <p className="eyebrow">Engineering control plane</p>
          <h1 id="hero-title">Make delivery feel visible.</h1>
          <p className="hero-copy">
            ProjectPulse connects planned work with developer activity,
            source-control events, CI/CD results, and delivery analytics.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" to="/auth/login">
              Open the workspace
            </Link>
            <Link className="button button-secondary" to="/app">
              View demo dashboard
            </Link>
          </div>
        </div>
        <aside className="hero-card" aria-label="ProjectPulse signals">
          <p className="eyebrow">One connected view</p>
          <div className="signal-list">
            {signals.map(([title, detail]) => (
              <div className="signal-item" key={title}>
                <span className="signal-dot" aria-hidden="true" />
                <div>
                  <strong>{title}</strong>
                  <span>{detail}</span>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </section>
      <section className="feature-grid" aria-label="ProjectPulse capabilities">
        {features.map(([title, detail]) => (
          <article className="feature-card" key={title}>
            <span className="signal-dot" aria-hidden="true" />
            <h2>{title}</h2>
            <p>{detail}</p>
          </article>
        ))}
      </section>
    </>
  );
}
