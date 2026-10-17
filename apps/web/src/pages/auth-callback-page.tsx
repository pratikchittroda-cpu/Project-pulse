import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { supabase } from "../app/auth-client.js";
import { LoadingState } from "../app/loading-state.js";

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get("code");

    if (!code) {
      navigate("/app", { replace: true });
      return;
    }

    let active = true;
    void supabase.auth
      .exchangeCodeForSession(code)
      .then(({ error: authError }) => {
        if (!active) {
          return;
        }

        if (authError) {
          setError(authError.message);
          return;
        }

        navigate("/app", { replace: true });
      });

    return () => {
      active = false;
    };
  }, [navigate, searchParams]);

  if (error) {
    return (
      <section className="state-card" role="alert">
        <p className="eyebrow">Sign-in error</p>
        <h1>We could not complete sign-in</h1>
        <p className="muted">{error}</p>
        <button
          className="button button-primary"
          onClick={() => navigate("/auth/login", { replace: true })}
          type="button"
        >
          Return to sign in
        </button>
      </section>
    );
  }

  return (
    <LoadingState
      message="Completing your secure sign-in."
      title="Signing in"
    />
  );
}
