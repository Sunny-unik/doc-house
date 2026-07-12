import { defineConfig } from "vitest/config";

// Kept small on purpose: unit tests for pure logic that doesn't need a DOM or a
// database. Integration coverage of the API + editor is out of scope for this
// milestone; adding it later would mean layering in jsdom + msw + a Neon test
// branch, none of which need to happen inside the runner config.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
