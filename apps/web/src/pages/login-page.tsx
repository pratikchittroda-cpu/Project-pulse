import { type FormEvent, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../app/auth-context.js";

interface LoginLocationState {
  error?: string;
  from?: string;
}

export function LoginPage() {
  const {
    demoModeEnabled,
    enterDemoMode,
    error: authError,
    isDemoMode,
    requestMagicLink,
    signInWithGithub,
  } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LoginLocationState | null;
  const destination = state?.from ?? "/app";
  const [email, setEmail] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setMessage(null);
    const result = await requestMagicLink(email);
    setIsPending(false);

    if (!result.error) {
      setMessage("Check your email for a secure ProjectPulse sign-in link.");
    }
  }

  async function handleGithubSignIn() {
    setIsPending(true);
    setMessage(null);
    const result = await signInWithGithub();
    setIsPending(false);

    if (!result.error) {
      navigate(destination, { replace: true });
    }
  }

  function handleDemoMode() {
    enterDemoMode();
    navigate(destination, { replace: true });
  }

  return (
    <section className="auth-card auth-card-wide" aria-labelledby="login-title">
      <div className="auth-card-intro">
        <p className="eyebrow">Welcome back</p>
        <h1 id="login-title">Bring your delivery signal together.</h1>
        <p className="muted">
          Sign in to keep planning, activity, and delivery health in one calm
          workspace.
        </p>
        <div className="auth-value-list" aria-label="ProjectPulse benefits">
          <span>
            <i aria-hidden="true">01</i>Plan work with context
          </span>
          <span>
            <i aria-hidden="true">02</i>Spot delivery drift early
          </span>
          <span>
            <i aria-hidden="true">03</i>Keep teams moving together
          </span>
        </div>
      </div>
      <div className="auth-card-form">
        <div className="auth-form-heading">
          <span className="auth-form-kicker">Workspace access</span>
          <strong>Sign in to ProjectPulse</strong>
        </div>
        {state?.error || authError ? (
          <p className="auth-error" role="alert">
            {state?.error ?? authError}
          </p>
        ) : null}
        {message ? (
          <p className="auth-success" role="status">
            {message}
          </p>
        ) : null}
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="email">Work email</label>
            <input
              autoComplete="email"
              id="email"
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
              required
              type="email"
              value={email}
            />
          </div>
          <button
            className="button button-primary"
            disabled={isPending}
            type="submit"
          >
            {isPending ? "Sending secure link…" : "Send magic link"}
          </button>
        </form>
        <div className="auth-divider" aria-hidden="true">
          <span>or</span>
        </div>
        <button
          className="button button-secondary auth-provider-button"
          disabled={isPending}
          onClick={handleGithubSignIn}
          type="button"
        >
          Continue with GitHub
        </button>
        {demoModeEnabled ? (
          <div className="demo-access-panel">
            <div>
              <span className="demo-access-label">Local preview</span>
              <p>
                {isDemoMode
                  ? "Demo mode is active on this browser."
                  : "Explore the workspace without connecting an account."}
              </p>
            </div>
            <button
              className="button button-demo"
              disabled={isPending}
              onClick={handleDemoMode}
              type="button"
            >
              {isDemoMode ? "Open demo workspace" : "Continue in demo mode"}
            </button>
          </div>
        ) : null}
        <p className="muted auth-return-link">
          <Link to="/">Return to the public home page</Link>
        </p>
      </div>
    </section>
  );
}
