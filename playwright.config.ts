import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  // Runs only against a sub-path build (playwright.subpath.config.ts).
  testIgnore: "subpath.spec.ts",
  // `list` prints the duration of every test, also in CI (default there: dot).
  reporter: "list",
  // In CI a test that fails once is retried and reported as «flaky» (with a
  // trace in the job artefact), so a slow runner does not hide real results.
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: "http://127.0.0.1:5173", trace: "on-first-retry" },
  // Chromium is the main engine; Firefox and WebKit run the same suite
  // (H1-QA). A test that needs an engine-specific capability skips the
  // others with its reason.
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
    // Safari's engine as Playwright builds it for Linux: close to Safari,
    // not a substitute for it (H1-QA).
    { name: "webkit", use: { browserName: "webkit" } },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: !process.env.CI,
  },
});
