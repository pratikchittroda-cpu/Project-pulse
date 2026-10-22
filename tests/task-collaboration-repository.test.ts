import { describe, expect, it } from "vitest";

import {
  AttachmentValidationError,
  ALLOWED_ATTACHMENT_TYPES,
  MAX_ATTACHMENT_BYTES,
  sanitizeAttachmentFileName,
  validateAttachmentFile,
} from "../apps/web/src/features/tasks/task-collaboration-repository.js";

describe("task collaboration repository boundaries", () => {
  it("accepts the explicit browser upload allowlist and size limit", () => {
    expect(ALLOWED_ATTACHMENT_TYPES).toContain("application/pdf");
    expect(
      validateAttachmentFile({
        name: "notes.md",
        size: 12,
        type: "text/markdown",
      }),
    ).toEqual({ contentType: "text/markdown" });
    expect(MAX_ATTACHMENT_BYTES).toBe(10 * 1024 * 1024);
  });

  it("rejects unsafe attachment types and oversized files before storage", () => {
    expect(() =>
      validateAttachmentFile({
        name: "script.js",
        size: 10,
        type: "text/javascript",
      }),
    ).toThrow(AttachmentValidationError);
    expect(() =>
      validateAttachmentFile({
        name: "large.txt",
        size: MAX_ATTACHMENT_BYTES + 1,
        type: "text/plain",
      }),
    ).toThrow(/10 MiB/);
  });

  it("removes path separators and control characters from a browser filename", () => {
    expect(sanitizeAttachmentFileName("../private/report\u0000?.pdf")).toBe(
      "report__.pdf",
    );
  });
});
