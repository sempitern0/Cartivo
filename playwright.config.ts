import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  // `list` prints the duration of every test, also in CI (default there: dot).
  reporter: "list",
  // In CI a test that fails once is retried and reported as «flaky» (with a
  // trace in the job artefact), so a slow runner does not hide real results.
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: "http://127.0.0.1:5173", trace: "on-first-retry" },
  // Chromium is the main engine; Firefox runs the same suite (H1-QA). Tests
  // that need a Chromium-only capability skip Firefox with their reason.
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
        launchOptions: process.env.CARTIVO_CHROMIUM_PATH
          ? {
              executablePath: process.env.CARTIVO_CHROMIUM_PATH,
              args: ["--no-sandbox", "--disable-dev-shm-usage"],
            }
          : undefined,
      },
    },
    { name: "firefox", use: { browserName: "firefox" } },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: !process.env.CI,
  },
});
