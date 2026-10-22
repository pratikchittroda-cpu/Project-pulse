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

export function createSupabaseClient(
  url = supabaseAuthConfig.url,
  anonKey = supabaseAuthConfig.anonKey,
  authOverrides: Partial<{
    autoRefreshToken: boolean;
    detectSessionInUrl: boolean;
    persistSession: boolean;
  }> = {},
) {
  return createClient(url, anonKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true,
      ...authOverrides,
    },
  });
}

export const supabase = createSupabaseClient();
