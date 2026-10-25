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

export interface LocalRealtimeTestAccount {
  email: string;
  label: string;
  password: string;
}

const DEMO_AUTH_STORAGE_KEY = "releasearc.demo-auth";
// Read the old local-demo flag once so development browsers are not reset by
// the public rebrand.
const LEGACY_DEMO_AUTH_STORAGE_KEY = "projectpulse.demo-auth";

export const demoModeEnabled = import.meta.env.DEV;

export const localRealtimeTestAccounts: readonly LocalRealtimeTestAccount[] =
  demoModeEnabled
    ? [
        {
          email:
            (import.meta.env.VITE_REALTIME_TEST_OWNER_EMAIL as
              | string
              | undefined) ?? "",
          label: "Realtime owner",
          password:
            (import.meta.env.VITE_REALTIME_TEST_OWNER_PASSWORD as
              | string
              | undefined) ?? "",
        },
        {
          email:
            (import.meta.env.VITE_REALTIME_TEST_REVIEWER_EMAIL as
              | string
              | undefined) ?? "",
          label: "Realtime reviewer",
          password:
            (import.meta.env.VITE_REALTIME_TEST_REVIEWER_PASSWORD as
              | string
              | undefined) ?? "",
        },
      ].filter(({ email, password }) => Boolean(email && password))
    : [];

interface AuthContextValue {
  clearError: () => void;
  demoModeEnabled: boolean;
  error: string | null;
  enterDemoMode: () => void;
  isConfigured: boolean;
  isDemoMode: boolean;
  localTestAccounts: readonly LocalRealtimeTestAccount[];
  requestMagicLink: (email: string) => Promise<{ error: string | null }>;
  session: Session | null;
  signInWithGithub: () => Promise<{ error: string | null }>;
  signInWithPassword: (
    email: string,
    password: string,
  ) => Promise<{ error: string | null }>;
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

function hasStoredDemoMode() {
  if (!demoModeEnabled || typeof window === "undefined") {
    return false;
  }

  try {
    return (
      window.localStorage.getItem(DEMO_AUTH_STORAGE_KEY) === "true" ||
      window.localStorage.getItem(LEGACY_DEMO_AUTH_STORAGE_KEY) === "true"
    );
  } catch {
    return false;
  }
}

function storeDemoMode(enabled: boolean) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (enabled) {
      window.localStorage.setItem(DEMO_AUTH_STORAGE_KEY, "true");
      window.localStorage.removeItem(LEGACY_DEMO_AUTH_STORAGE_KEY);
    } else {
      window.localStorage.removeItem(DEMO_AUTH_STORAGE_KEY);
      window.localStorage.removeItem(LEGACY_DEMO_AUTH_STORAGE_KEY);
    }
  } catch {
    // Demo mode is a convenience for local development. Ignore storage errors.
  }
}

export function AuthProvider({
  children,
  client = supabase,
  initialSession = null,
  initialStatus,
}: AuthProviderProps) {
  const isControlled = initialStatus !== undefined;
  const [isDemoMode, setIsDemoMode] = useState(
    () => !isControlled && hasStoredDemoMode(),
  );
  const [session, setSession] = useState<Session | null>(initialSession);
  const [status, setStatus] = useState<AuthStatus>(
    initialStatus ?? (isDemoMode ? "authenticated" : "loading"),
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isControlled || isDemoMode) {
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
  }, [client, isControlled, isDemoMode]);

  const enterDemoMode = useCallback(() => {
    if (!demoModeEnabled) {
      return;
    }

    storeDemoMode(true);
    setError(null);
    setIsDemoMode(true);
    setSession(null);
    setStatus("authenticated");
  }, []);

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

  const signInWithPassword = useCallback(
    async (email: string, password: string) => {
      setError(null);

      if (!supabaseAuthConfig.isConfigured) {
        const message =
          "Supabase Auth is not configured. Start local Supabase and run the realtime setup command.";
        setError(message);
        return { error: message };
      }

      const { data, error: authError } = await client.auth.signInWithPassword({
        email,
        password,
      });
      if (authError) {
        const message = authErrorMessage(authError);
        setError(message);
        return { error: message };
      }

      setSession(data.session);
      setStatus(data.session ? "authenticated" : "signed_out");
      return { error: null };
    },
    [client],
  );

  const signOut = useCallback(async () => {
    setError(null);

    if (isControlled || isDemoMode) {
      storeDemoMode(false);
      setIsDemoMode(false);
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
  }, [client, isControlled, isDemoMode]);

  const clearError = useCallback(() => setError(null), []);
  const value = useMemo(
    () => ({
      clearError,
      demoModeEnabled,
      error,
      enterDemoMode,
      isConfigured: supabaseAuthConfig.isConfigured,
      isDemoMode,
      localTestAccounts: localRealtimeTestAccounts,
      requestMagicLink,
      session,
      signInWithGithub,
      signInWithPassword,
      signOut,
      status,
    }),
    [
      clearError,
      enterDemoMode,
      error,
      isDemoMode,
      localRealtimeTestAccounts,
      requestMagicLink,
      session,
      signInWithGithub,
      signInWithPassword,
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
