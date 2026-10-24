import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/browser",
  testMatch: "**/*.pw.ts",
  reporter: process.env.CI ? "github" : "list",
  use: { viewport: { width: 1280, height: 800 } },
  projects: [{ name: "chromium" }],
});
