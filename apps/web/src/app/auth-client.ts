import { createClient } from "@supabase/supabase-js";

const configuredUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const configuredAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as
  | string
  | undefined;

export const supabaseAuthConfig = {
  anonKey: configuredAnonKey ?? "local-development-anon-key",
  isConfigured:
    Boolean(configuredUrl) &&
    Boolean(configuredAnonKey) &&
    !configuredAnonKey?.startsWith("replace-with-"),
  url: configuredUrl ?? "http://127.0.0.1:54321",
} as const;

export const supabase = createClient(
  supabaseAuthConfig.url,
  supabaseAuthConfig.anonKey,
  {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true,
    },
  },
);
