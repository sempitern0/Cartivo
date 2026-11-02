import { defineConfig } from "@playwright/test";
import base from "./playwright.config.ts";
// The production build served under /cartivo/ (CARTIVO_BASE=/cartivo/
// pnpm build): links, manifest, service worker and cores must not assume the
// domain root. Chromium is enough for URL resolution.
export default defineConfig({
  ...base,
  testMatch: "subpath.spec.ts",
  testIgnore: [],
  projects: base.projects!.filter((p) => p.name === "chromium"),
  use: { ...base.use, baseURL: "http://127.0.0.1:4174/cartivo/" },
  webServer: {
    command:
      "pnpm exec vite preview apps/web --host 127.0.0.1 --port 4174 --strictPort",
    url: "http://127.0.0.1:4174/cartivo/",
    reuseExistingServer: false,
    env: { CARTIVO_BASE: "/cartivo/" },
  },
});
