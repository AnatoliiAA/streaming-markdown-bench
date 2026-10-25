import { defineConfig } from "@playwright/test";

const STORYBOOK_URL = "http://localhost:6007";

export default defineConfig({
  testDir: "tests/browser",
  testMatch: "**/*.pw.ts",
  snapshotPathTemplate: "{testDir}/__screenshots__/{arg}{ext}",
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: STORYBOOK_URL,
    viewport: { width: 1280, height: 800 },
    reducedMotion: "reduce",
  },
  projects: [{ name: "chromium" }],
  // Static Storybook build served for the shared story spec (tests/browser/stories.pw.ts).
  webServer: {
    command:
      "bun run build:storybook && bunx sirv-cli packages/ui/storybook-static --port 6007 --quiet",
    url: STORYBOOK_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
