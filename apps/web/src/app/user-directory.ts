import { supabase } from "./auth-client.js";

export interface UserProfile {
  displayName: string;
  userId: string;
}

export type UserDirectory = ReadonlyMap<string, UserProfile>;

export async function loadUserDirectory(userIds: readonly string[]) {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  if (!uniqueIds.length) return new Map<string, UserProfile>();

  const { data, error } = await supabase
    .from("user_profiles")
    .select("user_id, display_name")
    .in("user_id", uniqueIds);
  if (error) throw error;

  return new Map(
    (data ?? []).map((profile) => [
      profile.user_id as string,
      {
        displayName: profile.display_name as string,
        userId: profile.user_id as string,
      },
    ]),
  );
}

export function displayNameFor(
  userId: string | null | undefined,
  directory: UserDirectory | undefined,
  fallback = "ReleaseArc member",
) {
  if (!userId) return fallback;
  return directory?.get(userId)?.displayName ?? fallback;
}

export function currentUserDisplayName(user: {
  email?: string;
  id: string;
  user_metadata?: Record<string, unknown>;
}) {
  const metadata = user.user_metadata ?? {};
  for (const key of ["full_name", "name", "user_name"]) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return user.email?.split("@")[0] || "ReleaseArc member";
}
