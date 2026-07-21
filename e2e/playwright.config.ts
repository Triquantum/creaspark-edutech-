import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: process.env.WEB_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: process.env.CI
    ? undefined // CI starts the stack via docker compose
    : { command: "pnpm --filter @educore/web dev", url: "http://localhost:3000", reuseExistingServer: true },
});
