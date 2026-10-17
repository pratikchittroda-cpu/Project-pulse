import type {
  AuthChangeEvent,
  Session,
  SupabaseClient,
} from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { supabase, supabaseAuthConfig } from "./auth-client.js";

export type AuthStatus = "authenticated" | "error" | "loading" | "signed_out";

interface AuthContextValue {
  clearError: () => void;
  error: string | null;
  isConfigured: boolean;
  requestMagicLink: (email: string) => Promise<{ error: string | null }>;
  session: Session | null;
  signInWithGithub: () => Promise<{ error: string | null }>;
  signOut: () => Promise<{ error: string | null }>;
  status: AuthStatus;
}

interface AuthProviderProps {
  children: ReactNode;
  client?: SupabaseClient;
  initialSession?: Session | null;
  initialStatus?: AuthStatus;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function authErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Authentication failed";
}

function callbackUrl() {
  if (typeof window === "undefined") {
    return "http://127.0.0.1:5173/auth/callback";
  }

  return `${window.location.origin}/auth/callback`;
}

function nextStatus(
  event: AuthChangeEvent,
  session: Session | null,
): AuthStatus {
  if (event === "SIGNED_OUT" || !session) {
    return "signed_out";
  }

  return "authenticated";
}

export function AuthProvider({
  children,
  client = supabase,
  initialSession = null,
  initialStatus,
}: AuthProviderProps) {
  const isControlled = initialStatus !== undefined;
  const [session, setSession] = useState<Session | null>(initialSession);
  const [status, setStatus] = useState<AuthStatus>(initialStatus ?? "loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isControlled) {
      return undefined;
    }

    let active = true;
    void client.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) {
        return;
      }

      if (sessionError) {
        setError(sessionError.message);
        setStatus("error");
        return;
      }

      setSession(data.session);
      setStatus(data.session ? "authenticated" : "signed_out");
    });

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, nextSession) => {
      if (!active) {
        return;
      }

      setSession(nextSession);
      setStatus(nextStatus(event, nextSession));
      if (event === "SIGNED_OUT") {
        setError(null);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [client, isControlled]);

  const requestMagicLink = useCallback(
    async (email: string) => {
      setError(null);

      if (!supabaseAuthConfig.isConfigured) {
        const message =
          "Supabase Auth is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.";
        setError(message);
        return { error: message };
      }

      const { error: authError } = await client.auth.signInWithOtp({
        options: { emailRedirectTo: callbackUrl() },
        email,
      });

      if (authError) {
        const message = authErrorMessage(authError);
        setError(message);
        return { error: message };
      }

      return { error: null };
    },
    [client],
  );

  const signInWithGithub = useCallback(async () => {
    setError(null);

    if (!supabaseAuthConfig.isConfigured) {
      const message =
        "Supabase Auth is not configured. Set the local project variables first.";
      setError(message);
      return { error: message };
    }

    const { error: authError } = await client.auth.signInWithOAuth({
      options: { redirectTo: callbackUrl() },
      provider: "github",
    });

    if (authError) {
      const message = authErrorMessage(authError);
      setError(message);
      return { error: message };
    }

    return { error: null };
  }, [client]);

  const signOut = useCallback(async () => {
    setError(null);

    if (isControlled) {
      setSession(null);
      setStatus("signed_out");
      return { error: null };
    }

    const { error: authError } = await client.auth.signOut();

    if (authError) {
      const message = authErrorMessage(authError);
      setError(message);
      return { error: message };
    }

    setSession(null);
    setStatus("signed_out");
    return { error: null };
  }, [client, isControlled]);

  const clearError = useCallback(() => setError(null), []);
  const value = useMemo(
    () => ({
      clearError,
      error,
      isConfigured: supabaseAuthConfig.isConfigured,
      requestMagicLink,
      session,
      signInWithGithub,
      signOut,
      status,
    }),
    [
      clearError,
      error,
      requestMagicLink,
      session,
      signInWithGithub,
      signOut,
      status,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside an AuthProvider");
  }

  return context;
}
