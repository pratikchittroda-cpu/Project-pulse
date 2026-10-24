export const teamKeyPattern = /^[A-Z][A-Z0-9_-]{1,19}$/;

export const teamKeyValidationMessage =
  "Team keys must start with a letter and be 2–20 characters using letters, numbers, hyphens, or underscores.";

export function normalizeTeamKey(value: string) {
  return value.trim().toUpperCase();
}

export function isValidTeamKey(value: string) {
  return teamKeyPattern.test(normalizeTeamKey(value));
}
