import { describe, expect, it } from "vitest";

import {
  isValidTeamKey,
  normalizeTeamKey,
} from "../apps/web/src/app/organization-keys.js";

describe("team key validation", () => {
  it("normalizes user input before checking the database format", () => {
    expect(normalizeTeamKey("  platform-1 ")).toBe("PLATFORM-1");
    expect(isValidTeamKey("  platform-1 ")).toBe(true);
  });

  it("accepts the supported team key range", () => {
    expect(isValidTeamKey("FE")).toBe(true);
    expect(isValidTeamKey("PLATFORM_1")).toBe(true);
    expect(isValidTeamKey("A")).toBe(false);
    expect(isValidTeamKey("1TEAM")).toBe(false);
    expect(isValidTeamKey("TEAM SPACE")).toBe(false);
    expect(isValidTeamKey("A12345678901234567890")).toBe(false);
  });
});
