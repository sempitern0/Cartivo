import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { cartivoPwa } from "../../tools/pwa-plugin.mjs";
export default defineConfig({ plugins: [svelte(), cartivoPwa()] });
