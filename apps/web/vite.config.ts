import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { cartivoPwa } from "../../tools/pwa-plugin.mjs";
export default defineConfig({
  plugins: [svelte(), cartivoPwa()],
  // One file for the emulator Worker: WebKit (Safari) evaluates a module
  // worker's entry again when a dynamic chunk imports from it, which reset
  // the session after the first core loaded. The cores' WebAssembly is still
  // fetched and compiled only when a game of that system starts.
  worker: {
    format: "es",
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
