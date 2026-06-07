import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    alias: {
      "@": resolve(import.meta.dirname, "."),
      "server-only": resolve(import.meta.dirname, "test/server-only.ts"),
    },
  },
});
