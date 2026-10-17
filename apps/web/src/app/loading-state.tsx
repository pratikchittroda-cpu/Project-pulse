interface LoadingStateProps {
  message?: string;
  title?: string;
}

export function LoadingState({
  message = "ProjectPulse is preparing your workspace.",
  title = "Loading workspace",
}: LoadingStateProps) {
  return (
    <section className="state-card" role="status" aria-live="polite">
      <span className="loading-indicator" aria-hidden="true" />
      <div>
        <p className="eyebrow">Please wait</p>
        <h1>{title}</h1>
        <p className="muted">{message}</p>
      </div>
    </section>
  );
}
