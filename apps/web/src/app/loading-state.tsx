import { ReleaseArcMark } from "./brand.js";

interface LoadingStateProps {
  message?: string;
  title?: string;
}

export function LoadingState({
  message = "ReleaseArc is preparing your workspace.",
  title = "Loading workspace",
}: LoadingStateProps) {
  return (
    <section className="state-card" role="status" aria-live="polite">
      <div className="loading-signal" aria-hidden="true">
        <span className="loading-signal-ring loading-signal-ring-outer" />
        <span className="loading-signal-ring loading-signal-ring-middle" />
        <span className="loading-signal-ring loading-signal-ring-inner" />
        <span className="loading-signal-sweep" />
        <span className="loading-signal-node loading-signal-node-one" />
        <span className="loading-signal-node loading-signal-node-two" />
        <span className="loading-signal-node loading-signal-node-three" />
        <span className="loading-signal-mark">
          <ReleaseArcMark size={42} />
        </span>
      </div>
      <div>
        <p className="eyebrow">Please wait</p>
        <h1>{title}</h1>
        <p className="muted">{message}</p>
      </div>
    </section>
  );
}
