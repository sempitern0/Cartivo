import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { cartivoPwa, ISOLATION_HEADERS } from "../../tools/pwa-plugin.mjs";
export default defineConfig({
  plugins: [svelte(), cartivoPwa()],
  // Cross-origin isolation (ADR-020) in development and preview, as the
  // production host must also send it.
  server: { headers: ISOLATION_HEADERS },
  preview: { headers: ISOLATION_HEADERS },
  // One file for the emulator Worker: WebKit (Safari) evaluates a module
  // worker's entry again when a dynamic chunk imports from it, which reset
  // the session after the first core loaded. The cores' WebAssembly is still
  // fetched and compiled only when a game of that system starts.
  worker: {
    format: "es",
    rollupOptions: { output: { codeSplitting: false } },
  },
});
