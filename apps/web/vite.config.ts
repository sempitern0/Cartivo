import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { cartivoPwa, securityHeaders } from "../../tools/pwa-plugin.mjs";
export default defineConfig({
  // securityHeaders: COOP/COEP in dev and preview (ADR-020) plus the Content
  // Security Policy in preview (ADR-021), as the production host must send.
  plugins: [svelte(), securityHeaders(), cartivoPwa()],
  // One file for the emulator Worker: WebKit (Safari) evaluates a module
  // worker's entry again when a dynamic chunk imports from it, which reset
  // the session after the first core loaded. The cores' WebAssembly is still
  // fetched and compiled only when a game of that system starts.
  worker: {
    format: "es",
    rollupOptions: { output: { codeSplitting: false } },
  },
});
