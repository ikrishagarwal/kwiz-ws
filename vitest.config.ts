import { resolve } from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: "#root",
        replacement: resolve("src"),
      },
    ],
  },
  test: {
    coverage: {
      include: ["src"],
      // exclude un-testable files
      exclude: ["src/structures.ts"],
    },
  },
});
