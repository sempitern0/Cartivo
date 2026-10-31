import { defineConfig } from "@playwright/test";
import base from "./playwright.config.ts";
export default defineConfig({
  ...base,
  use: { ...base.use, baseURL: "http://127.0.0.1:4173" },
  webServer: {
    command: "pnpm preview",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
  },
});
