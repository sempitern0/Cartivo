import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  // `list` prints the duration of every test, also in CI (default there: dot).
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:5173",
    launchOptions: process.env.CARTIVO_CHROMIUM_PATH
      ? {
          executablePath: process.env.CARTIVO_CHROMIUM_PATH,
          args: ["--no-sandbox", "--disable-dev-shm-usage"],
        }
      : undefined,
  },
  webServer: {
    command: "pnpm dev",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: !process.env.CI,
  },
});
