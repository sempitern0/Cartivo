<script lang="ts">
  import PerformanceDetails from "./PerformanceDetails.svelte";
  import type { FrameMetrics } from "../../../packages/media/src/frame-metrics.ts";
  import { onMount } from "svelte";
  // Modo consola (ADR-006): the pause as a vertical menu over the game. A
  // modal dialog, so the pad and Tab stay in it; B or Escape resumes.
  let {
    diagnostics,
    loadMs,
    busy,
    savesAvailable,
    onresume,
    onsave,
    onsaves,
    ongraphics,
    oncontrols,
    onreset,
    onexit,
    discs,
    ondisc,
  }: {
    diagnostics: ReturnType<FrameMetrics["snapshot"]>;
    loadMs?: number;
    busy: boolean;
    savesAvailable: boolean;
    onresume: () => void;
    onsave: () => void;
    onsaves: () => void;
    ongraphics: () => void;
    oncontrols: () => void;
    onreset: () => void;
    onexit: () => void;
    /** A game on several discs: one button per disc not in the tray. */
    discs?: { names: string[]; current: number };
    ondisc?: (index: number) => void;
  } = $props();
  let dialog: HTMLDialogElement;
  let resumeButton: HTMLButtonElement;
  onMount(() => {
    dialog.showModal();
    return () => dialog.close();
  });
  // The pause is still being confirmed when the menu opens (Reanudar is
  // disabled): focus Reanudar as soon as it can be pressed, once.
  let focused = false;
  $effect(() => {
    if (busy || focused) return;
    focused = true;
    resumeButton.focus();
  });
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<dialog
  bind:this={dialog}
  class="pause-menu"
  aria-label="En pausa"
  oncancel={(e) => e.preventDefault()}
  onkeydown={(e) => {
    // Escape, or B (which arrives as a synthetic Escape): back to the game.
    if (e.key !== "Escape") return;
    e.preventDefault();
    e.stopPropagation();
    onresume();
  }}
>
  <p class="kicker">En pausa</p>
  <button
    class="primary"
    bind:this={resumeButton}
    disabled={busy}
    onclick={onresume}
    >Reanudar juego</button
  >
  <!-- Same actions, same order as the keyboard and mouse pause. -->
  <button disabled={busy || !savesAvailable} onclick={onsave}
    >Guardar ahora</button
  >
  <button disabled={!savesAvailable} onclick={onsaves}>Partidas</button>
  <button onclick={ongraphics}>Ajustes del juego</button>
  <button onclick={oncontrols}>Controles</button>
  {#if discs && ondisc}{#each discs.names as _, index (index)}{#if index !== discs.current}<button
          disabled={busy}
          onclick={() => ondisc(index)}>Poner el disco {index + 1}</button
        >{/if}{/each}{/if}
  <button disabled={busy} onclick={onreset}>Reiniciar consola</button>
  <button class="exit" onclick={onexit}
    >{savesAvailable ? "Guardar y salir" : "Salir"}</button
  >
  <PerformanceDetails {diagnostics} {loadMs} />
</dialog>

<style>
  .pause-menu {
    display: grid;
    gap: 10px;
    width: min(340px, calc(100vw - 32px));
    padding: 22px;
    border: 1px solid var(--border);
    border-radius: var(--card-radius);
    background: linear-gradient(180deg, #1c1f2b, #161822);
    color: var(--text);
    box-shadow: var(--glow);
  }
  .pause-menu::backdrop {
    background: #050507b3;
  }
  .kicker {
    margin: 0 0 6px;
    text-align: center;
  }
  button {
    width: 100%;
    min-height: 52px;
    font-size: 17px;
    text-align: left;
    padding: 12px 20px;
  }
  .exit {
    border-color: var(--coral);
    color: var(--coral);
  }
</style>
