import { Component, type ErrorInfo, type ReactNode } from "react";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  error: Error | null;
}

export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ProjectPulse application error", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="standalone-state">
          <section className="state-card" role="alert">
            <p className="eyebrow">Application error</p>
            <h1>ProjectPulse needs a refresh</h1>
            <p className="muted">
              The application could not render this screen. Refresh the page to
              try again.
            </p>
            <button
              className="button button-primary"
              type="button"
              onClick={() => window.location.reload()}
            >
              Refresh ProjectPulse
            </button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
