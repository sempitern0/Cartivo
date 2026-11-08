<!--
  While a game is being prepared (Worker, core, file), the console's logo
  breathes over the stage with Cartivo's progress bar; it fades out as the
  game appears. A console without a logo shows its drawn badge.
-->
<script lang="ts">
  import { fade, scale } from "svelte/transition";
  import ConsoleIcon from "./ConsoleIcon.svelte";
  import CartivoProgress from "./CartivoProgress.svelte";
  import { consoleLogo } from "./console-art.ts";
  import { motion } from "./motion.svelte.ts";
  import type { SystemInfo } from "../../../packages/runtime/src/systems.ts";

  let { system, title }: { system: SystemInfo; title: string } = $props();
  const logo = $derived(consoleLogo(system.id));
</script>

<div
  class="splash"
  role="status"
  in:fade={{ duration: motion.ms(180) }}
  out:fade={{ duration: motion.ms(320) }}
>
  <div class="art" in:scale={{ start: 0.9, duration: motion.ms(420) }}>
    {#if logo}<img src={logo} alt="" draggable="false" />{:else}<ConsoleIcon
        system={system.id}
      />{/if}
  </div>
  <p class="title">Preparando juego…</p>
  <p class="detail">{title}</p>
  <div class="bar"><CartivoProgress label={`Preparando ${title}`} /></div>
</div>

<style>
  .splash {
    position: absolute;
    inset: 0;
    z-index: 3;
    display: grid;
    place-content: center;
    justify-items: center;
    gap: 10px;
    padding: 24px;
    border-radius: inherit;
    background:
      radial-gradient(60% 50% at 50% 40%, #619de51f, transparent 70%),
      #0a0c12;
    text-align: center;
    pointer-events: none;
  }
  .art {
    width: min(200px, 40vmin);
    margin-bottom: 10px;
    animation: breathe 2.4s ease-in-out infinite;
  }
  .art img {
    display: block;
    width: 100%;
    border-radius: 21%;
    box-shadow:
      0 0 0 1px #ffffff14,
      0 18px 50px -12px #40c2ae66;
  }
  .art :global(.badge) {
    --badge-size: 100%;
  }
  .title {
    margin: 0;
    font-size: 17px;
    font-weight: 650;
  }
  .detail {
    margin: 0;
    max-width: 36ch;
    color: var(--muted);
    font-size: 14px;
    overflow-wrap: anywhere;
  }
  .bar {
    width: min(240px, 60vw);
    margin-top: 8px;
  }
  /* Transform only: no repaint while the core is loading. */
  @keyframes breathe {
    50% {
      transform: scale(1.04);
    }
  }
</style>
