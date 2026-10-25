import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@releasearc/domain": fileURLToPath(
        new URL("./packages/domain/src/index.ts", import.meta.url),
      ),
      "@releasearc/ui": fileURLToPath(
        new URL("./packages/ui/src/index.ts", import.meta.url),
      ),
      "@releasearc/integrations": fileURLToPath(
        new URL("./packages/integrations/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    env: {
      VITE_SUPABASE_URL: "http://127.0.0.1:54321",
      VITE_SUPABASE_ANON_KEY: "replace-with-test-anon-key",
    },
    environment: "node",
    include: ["tests/**/*.{test,spec}.{ts,tsx}"],
    reporters: ["verbose"],
  },
});
