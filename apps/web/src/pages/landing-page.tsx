import { type ReactNode, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

const signals = [
  ["Planning", "Roadmap and task flow"],
  ["Developer activity", "Privacy-aware workspace signals"],
  ["Delivery health", "CI, review, and release context"],
] as const;

const features = [
  [
    "Plan with context",
    "Keep roadmap intent, cycles, owners, and dependencies in one shared view.",
  ],
  [
    "Coordinate in real time",
    "See activity, blockers, and changes as they happen without adding more status meetings.",
  ],
  [
    "Deliver with signal",
    "Use review, release, and delivery health context to decide what deserves attention next.",
  ],
] as const;

const productLayers = [
  {
    eyebrow: "Plan",
    title: "Turn intent into a shared shape.",
    detail:
      "Map strategy to roadmaps, cycles, and tasks so the team can see what matters now and why.",
    visual: "plan",
  },
  {
    eyebrow: "Observe",
    title: "Make movement legible.",
    detail:
      "Bring activity, ownership, dependencies, and collaboration into one calm stream of context.",
    visual: "observe",
  },
  {
    eyebrow: "Deliver",
    title: "Turn signal into a next move.",
    detail:
      "Spot drift early, protect focus, and make release decisions from the same source of truth.",
    visual: "deliver",
  },
] as const;

const capabilities = [
  [
    "Roadmaps that stay connected",
    "Keep quarterly direction tied to the work actually moving through the team.",
    "↗",
  ],
  [
    "Workspaces that stay current",
    "Live activity and presence make it easier to know where a handoff or decision stands.",
    "⌁",
  ],
  [
    "Delivery health with context",
    "Read the shape of progress across review, release, and execution signals.",
    "✓",
  ],
  [
    "Focus without surveillance",
    "Use permission-aware signals about work, not invasive monitoring of people.",
    "◌",
  ],
] as const;

const tickerItems = [
  "ROADMAP / CONNECTED",
  "ACTIVITY / LIVE",
  "DELIVERY / HEALTHY",
  "PERMISSIONS / VISIBLE",
  "CYCLE 24 / IN MOTION",
] as const;

const signalLenses = [
  {
    id: "focus",
    label: "Focus",
    kicker: "Team focus",
    value: "03",
    unit: "attention spots",
    description:
      "A small set of decisions is carrying the most weight right now.",
    note: "CALM / LOW DRIFT",
    bars: [68, 44, 82],
  },
  {
    id: "flow",
    label: "Flow",
    kicker: "Work in motion",
    value: "87%",
    unit: "moving cleanly",
    description: "Handoffs are visible and the next owner is already clear.",
    note: "STEADY / IN MOTION",
    bars: [84, 72, 88],
  },
  {
    id: "release",
    label: "Release",
    kicker: "Delivery health",
    value: "92",
    unit: "healthy signal",
    description: "The release path is strong enough to move with confidence.",
    note: "READY / LOW RISK",
    bars: [92, 78, 86],
  },
] as const;

interface RevealProps {
  children: ReactNode;
  className?: string;
}

function Reveal({ children, className = "" }: RevealProps) {
  const [isVisible, setIsVisible] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = elementRef.current;

    if (!element) {
      return;
    }

    if (typeof window === "undefined" || !("IntersectionObserver" in window)) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(element);
        }
      },
      { rootMargin: "0px 0px -48px", threshold: 0.12 },
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  return (
    <div
      className={`landing-reveal${isVisible ? " landing-reveal-visible" : ""}${className ? ` ${className}` : ""}`}
      ref={elementRef}
    >
      {children}
    </div>
  );
}

function SignalLens() {
  const [activeLensId, setActiveLensId] =
    useState<(typeof signalLenses)[number]["id"]>("flow");
  const activeLens =
    signalLenses.find((lens) => lens.id === activeLensId) ?? signalLenses[0];

  return (
    <div className="signal-lens" aria-label="Interactive signal lens">
      <div className="signal-lens-toolbar">
        <span className="signal-lens-title">Signal lens</span>
        <div
          className="signal-lens-tabs"
          role="tablist"
          aria-label="Choose a signal lens"
        >
          {signalLenses.map((lens) => (
            <button
              aria-controls="signal-lens-panel"
              aria-selected={lens.id === activeLens.id}
              className={
                lens.id === activeLens.id ? "signal-lens-tab-active" : ""
              }
              key={lens.id}
              onClick={() => setActiveLensId(lens.id)}
              role="tab"
              type="button"
            >
              {lens.label}
            </button>
          ))}
        </div>
      </div>
      <div
        className={`signal-lens-panel signal-lens-panel-${activeLens.id}`}
        id="signal-lens-panel"
        role="tabpanel"
        aria-live="polite"
      >
        <div className="signal-lens-readout">
          <span>{activeLens.kicker}</span>
          <strong>{activeLens.value}</strong>
          <small>{activeLens.unit}</small>
        </div>
        <div className="signal-lens-bars" aria-hidden="true">
          {activeLens.bars.map((bar, index) => (
            <span key={`${activeLens.id}-${index}`}>
              <i style={{ height: `${bar}%` }} />
            </span>
          ))}
        </div>
        <p>{activeLens.description}</p>
        <span className="signal-lens-note">{activeLens.note}</span>
      </div>
    </div>
  );
}

function LayerVisual({
  type,
}: {
  type: (typeof productLayers)[number]["visual"];
}) {
  if (type === "plan") {
    return (
      <div className="workflow-visual workflow-visual-plan" aria-hidden="true">
        <div className="workflow-visual-heading">
          <span>Platform refresh</span>
          <strong>68%</strong>
        </div>
        <div className="workflow-progress">
          <i />
        </div>
        <div className="workflow-timeline">
          <span className="workflow-timeline-done" />
          <span className="workflow-timeline-active" />
          <span />
          <span />
        </div>
        <div className="workflow-tags">
          <span>Roadmap</span>
          <span>Cycle 24</span>
          <span>4 owners</span>
        </div>
      </div>
    );
  }

  if (type === "observe") {
    return (
      <div
        className="workflow-visual workflow-visual-observe"
        aria-hidden="true"
      >
        <div className="workflow-visual-heading">
          <span>Live activity</span>
          <strong className="workflow-live-label">
            <i /> synced
          </strong>
        </div>
        <div className="workflow-stream-row">
          <span className="workflow-stream-icon workflow-stream-icon-violet">
            ↗
          </span>
          <span>
            <b>Roadmap scope updated</b>
            <small>Product platform · 8m ago</small>
          </span>
        </div>
        <div className="workflow-stream-row">
          <span className="workflow-stream-icon workflow-stream-icon-gold">
            ⌁
          </span>
          <span>
            <b>Handoff is in motion</b>
            <small>API foundation · 32m ago</small>
          </span>
        </div>
        <div className="workflow-stream-row">
          <span className="workflow-stream-icon workflow-stream-icon-mint">
            ✓
          </span>
          <span>
            <b>Release signal improved</b>
            <small>Checkout flow · 1h ago</small>
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="workflow-visual workflow-visual-deliver" aria-hidden="true">
      <div className="workflow-visual-heading">
        <span>Delivery health</span>
        <strong>92</strong>
      </div>
      <div className="workflow-chart">
        <svg viewBox="0 0 280 88" role="presentation">
          <defs>
            <linearGradient
              id="workflow-chart-fill"
              x1="0"
              x2="0"
              y1="0"
              y2="1"
            >
              <stop offset="0" stopColor="#d4aa65" stopOpacity="0.34" />
              <stop offset="1" stopColor="#d4aa65" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            className="workflow-chart-area"
            d="M0 71C27 72 29 56 54 59s28 9 48-4 25-17 47-12 29-16 47-14 26 14 38 5 25-4 46-22v76H0Z"
            fill="url(#workflow-chart-fill)"
          />
          <path
            className="workflow-chart-line"
            d="M0 71C27 72 29 56 54 59s28 9 48-4 25-17 47-12 29-16 47-14 26 14 38 5 25-4 46-22"
            fill="none"
            pathLength="1"
            stroke="#c49a57"
            strokeLinecap="round"
            strokeWidth="3"
          />
          <circle className="workflow-chart-point" cx="280" cy="12" r="4" />
        </svg>
      </div>
      <div className="workflow-chart-axis">
        <span>Mon</span>
        <span>Wed</span>
        <span>Fri</span>
        <span>Now</span>
      </div>
    </div>
  );
}

export function LandingPage() {
  return (
    <>
      <section className="hero landing-hero" aria-labelledby="hero-title">
        <div className="hero-copy-column">
          <div className="hero-kicker">
            <span className="hero-kicker-dot" aria-hidden="true" />
            GitHub delivery intelligence
          </div>
          <h1 id="hero-title">Make delivery feel visible.</h1>
          <p className="hero-copy">
            ReleaseArc connects GitHub activity, planning, review, CI, and
            releases into one clear picture of what is moving, what is stuck,
            and what needs attention next.
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
          <a className="hero-scroll-link" href="#product">
            Explore the product <span aria-hidden="true">↓</span>
          </a>
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
              <span>LIVE RELEASE</span>
              <strong>92</strong>
              <small>delivery health</small>
            </span>
          </div>
          <aside
            className="hero-card hero-dashboard-card"
            aria-label="ReleaseArc workspace preview"
          >
            <div className="hero-card-topline">
              <span className="preview-window-dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <span className="preview-window-label">RELEASE / OVERVIEW</span>
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
      <Reveal className="landing-ticker-reveal">
        <section
          className="landing-signal-ticker"
          aria-label="ReleaseArc signal highlights"
        >
          <div className="landing-ticker-edge" aria-hidden="true" />
          <div className="landing-ticker-viewport">
            <div className="landing-ticker-track" aria-hidden="true">
              {[...tickerItems, ...tickerItems].map((item, index) => (
                <span key={`${item}-${index}`}>
                  <i />
                  {item}
                </span>
              ))}
            </div>
          </div>
          <span className="landing-ticker-caption">
            ReleaseArc / live system
          </span>
        </section>
      </Reveal>
      <Reveal>
        <section className="landing-proof" aria-label="ReleaseArc capabilities">
          <div className="landing-proof-heading">
            <span className="eyebrow">A clearer operating rhythm</span>
            <p>One system for the questions that slow delivery down.</p>
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
      </Reveal>

      <section className="landing-detail landing-product-section" id="product">
        <Reveal className="landing-section-heading">
          <div>
            <span className="eyebrow">One connected product</span>
            <h2 id="product-title">
              From planning signals to shipping decisions.
            </h2>
          </div>
          <p>
            ReleaseArc gives engineering teams a shared operating layer for
            planning, GitHub delivery signals, and release health — without
            asking them to live in another reporting ritual.
          </p>
        </Reveal>
        <div className="landing-workflow-grid" aria-labelledby="product-title">
          {productLayers.map((layer, index) => (
            <Reveal
              className={`landing-workflow-card landing-workflow-card-${layer.visual}`}
              key={layer.eyebrow}
            >
              <div className="workflow-card-topline">
                <span className="workflow-card-index">0{index + 1}</span>
                <span className="workflow-card-label">{layer.eyebrow}</span>
              </div>
              <h3>{layer.title}</h3>
              <p>{layer.detail}</p>
              <LayerVisual type={layer.visual} />
            </Reveal>
          ))}
        </div>
      </section>

      <section
        className="landing-detail landing-signal-section"
        id="principles"
      >
        <Reveal className="landing-signal-copy">
          <span className="eyebrow">The signal, not the noise</span>
          <h2>See how work moves without turning work into surveillance.</h2>
          <p>
            ReleaseArc is built around permission-aware, team-level context. It
            helps leaders spot drift and helps teams protect their focus — while
            keeping the details of how people work private.
          </p>
          <ul className="landing-principle-list">
            <li>
              <span>01</span>
              <div>
                <strong>Context over counts</strong>
                <p>
                  Understand blockers, ownership, and flow instead of chasing
                  activity metrics.
                </p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <strong>Signals with a purpose</strong>
                <p>
                  Every view points back to a decision your team can make next.
                </p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <strong>Built for shared trust</strong>
                <p>
                  Keep permissions visible and collaboration grounded in the
                  work itself.
                </p>
              </div>
            </li>
          </ul>
        </Reveal>
        <Reveal className="landing-signal-visual">
          <div
            className="signal-visual-shell"
            aria-label="Animated delivery signal graphic"
            role="img"
          >
            <div className="signal-visual-grid" aria-hidden="true" />
            <div className="signal-visual-scan" aria-hidden="true" />
            <span className="signal-visual-label signal-visual-label-top">
              team context / live
            </span>
            <span className="signal-visual-label signal-visual-label-bottom">
              permission aware
            </span>
            <div className="signal-visual-core">
              <span>delivery</span>
              <strong>92</strong>
              <small>healthy signal</small>
            </div>
            <span
              className="signal-visual-orbit signal-visual-orbit-one"
              aria-hidden="true"
            />
            <span
              className="signal-visual-orbit signal-visual-orbit-two"
              aria-hidden="true"
            />
            <span
              className="signal-visual-orbit signal-visual-orbit-three"
              aria-hidden="true"
            />
          </div>
          <SignalLens />
        </Reveal>
      </section>

      <section
        className="landing-detail landing-capability-section"
        id="how-it-works"
      >
        <Reveal className="landing-section-heading landing-section-heading-centered">
          <div>
            <span className="eyebrow">Made for the work between the tools</span>
            <h2>Less status theater. More useful movement.</h2>
          </div>
          <p>
            Keep your existing tools. ReleaseArc adds the connective tissue that
            makes the full delivery picture easier to read.
          </p>
        </Reveal>
        <div className="landing-capability-grid">
          {capabilities.map(([title, detail, icon], index) => (
            <Reveal className="landing-capability-card" key={title}>
              <div className="capability-card-topline">
                <span className="capability-icon" aria-hidden="true">
                  {icon}
                </span>
                <span>0{index + 1}</span>
              </div>
              <h3>{title}</h3>
              <p>{detail}</p>
              <span className="capability-card-arrow" aria-hidden="true">
                ↗
              </span>
            </Reveal>
          ))}
        </div>
      </section>

      <Reveal>
        <section className="landing-cta" aria-labelledby="cta-title">
          <div className="landing-cta-glow" aria-hidden="true" />
          <div className="landing-cta-copy">
            <span className="eyebrow">Your next release, in focus</span>
            <h2 id="cta-title">Make delivery feel calmer.</h2>
            <p>
              Start with a local preview, then bring your team into a clearer
              operating rhythm when you are ready.
            </p>
            <Link
              className="button button-primary button-arrow"
              to="/auth/login"
            >
              Open the workspace <span aria-hidden="true">↗</span>
            </Link>
          </div>
          <div className="landing-cta-orbit" aria-hidden="true">
            <span />
            <span />
            <span />
            <strong>RA</strong>
          </div>
        </section>
      </Reveal>
    </>
  );
}
