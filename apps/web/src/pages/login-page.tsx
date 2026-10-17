import { type FormEvent, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../app/auth-context.js";

interface LoginLocationState {
  error?: string;
  from?: string;
}

export function LoginPage() {
  const { error: authError, requestMagicLink, signInWithGithub } = useAuth();
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

  return (
    <section className="auth-card" aria-labelledby="login-title">
      <p className="eyebrow">Welcome back</p>
      <h1 id="login-title">Sign in to ProjectPulse</h1>
      <p className="muted">
        Use a magic link or your connected GitHub identity. Sessions are managed
        by Supabase Auth and persist securely in this browser.
      </p>
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
      <button
        className="button button-secondary auth-provider-button"
        disabled={isPending}
        onClick={handleGithubSignIn}
        type="button"
      >
        Continue with GitHub
      </button>
      <p className="muted">
        <Link to="/">Return to the public home page</Link>
      </p>
    </section>
  );
}
