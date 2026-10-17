import { type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../app/auth-context.js";

interface LoginLocationState {
  from?: string;
}

export function LoginPage() {
  const { signIn } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LoginLocationState | null;
  const destination = state?.from ?? "/app";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    signIn();
    navigate(destination, { replace: true });
  }

  return (
    <section className="auth-card" aria-labelledby="login-title">
      <p className="eyebrow">Welcome back</p>
      <h1 id="login-title">Sign in to ProjectPulse</h1>
      <p className="muted">
        Authentication is represented by this local flow until the Supabase auth
        task is connected.
      </p>
      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="email">Work email</label>
          <input
            autoComplete="email"
            defaultValue="you@example.com"
            id="email"
            name="email"
            type="email"
          />
        </div>
        <button className="button button-primary" type="submit">
          Continue to workspace
        </button>
      </form>
      <p className="muted">
        <Link to="/">Return to the public home page</Link>
      </p>
    </section>
  );
}
