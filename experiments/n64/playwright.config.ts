import { defineConfig } from "@playwright/test";
const preview = process.env.N64_PREVIEW === "1";
export default defineConfig({
  testDir: ".",
  testMatch: "browser.spec.ts",
  reporter: "list",
  retries: 0,
  outputDir: "../../test-results/n64",
  use: { baseURL: "http://127.0.0.1:5184" },
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
  ],
  webServer: {
    command: `pnpm exec vite ${preview ? "preview " : ""}experiments/n64 --host 127.0.0.1 --port 5184 --strictPort`,
    cwd: "../..",
    url: "http://127.0.0.1:5184",
    reuseExistingServer: false,
  },
});
