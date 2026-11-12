<script lang="ts">
  // Player header: title and the four game actions, in the pause's order
  // (Partidas · Ajustes del juego · … · Guardar y salir). Presentation only: it
  // never starts workers or writes saves; the player decides what happens.
  import { icons } from "./icons.ts";
  import DiscMenu from "./DiscMenu.svelte";
  import type { DiscTrayState } from "../../../packages/runtime/src/protocol.ts";
  type Phase = "ready" | "loading" | "running" | "paused" | "error";
  let {
    systemName,
    title,
    phase,
    busy,
    graphicsOpen,
    savesOpen,
    savesAvailable = true,
    exitLabel = "Guardar y salir",
    graphicsButton = $bindable(),
    savesButton = $bindable(),
    ongraphics,
    onsaves,
    onrom,
    onexit,
    discs,
    ondisc,
    speed,
  }: {
    systemName: string;
    title: string;
    phase: Phase;
    busy: boolean;
    graphicsOpen: boolean;
    savesOpen: boolean;
    /** False when this browser cannot save (Partidas would only fail). */
    savesAvailable?: boolean;
    /** «Guardar y salir», or «Salir» when nothing can be saved. */
    exitLabel?: string;
    graphicsButton?: HTMLButtonElement;
    savesButton?: HTMLButtonElement;
    ongraphics: () => void;
    onsaves: () => void;
    onrom: () => void;
    onexit: () => void;
    /** A game on several discs: its tray (ADR-015). */
    discs?: DiscTrayState;
    ondisc?: (index: number) => void;
    /** Percent of full speed, when the game runs below it (slow motion). */
    speed?: number;
  } = $props();
</script>

<div class="heading" data-player-chrome>
  <div class="title">
    <p class="kicker">
      {systemName}{#if speed !== undefined}<span
          class="speed"
          data-testid="game-speed"
          title="Este dispositivo no alcanza la velocidad del juego: va a cámara lenta en vez de pausarse."
          > · Velocidad {speed} %</span
        >{/if}
    </p>
    <h1>{title}</h1>
  </div>
  <div class="toolbar" role="toolbar" aria-label="Partida">
    <button
      class="tool icon-button"
      bind:this={savesButton}
      onclick={onsaves}
      aria-expanded={savesOpen}
      aria-controls="saves-panel"
      disabled={phase === "loading" || phase === "error" || !savesAvailable}
      >{@html icons.save}<span>Partidas</span></button
    >
    <button
      class="tool icon-button"
      bind:this={graphicsButton}
      onclick={ongraphics}
      aria-expanded={graphicsOpen}
      aria-controls="graphics-panel"
      >{@html icons.monitor}<span>Ajustes del juego</span></button
    >
    {#if discs && ondisc}<DiscMenu
        {discs}
        disabled={busy || phase === "loading"}
        onchange={ondisc}
      />{/if}
    <button
      class="tool icon-button"
      onclick={onrom}
      disabled={busy}>{@html icons.folder}<span>Cargar ROM</span></button
    >
    <span class="divider" aria-hidden="true"></span>
    <button
      class="tool icon-button"
      onclick={onexit}
      disabled={busy}
      >{@html icons.close}<span
        >{phase === "loading" ? "Cancelar carga" : exitLabel}</span
      ></button
    >
  </div>
</div>

<style>
  .heading {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px 24px;
    flex-wrap: wrap;
  }
  .title {
    min-width: 0;
  }
  h1 {
    font-size: 28px;
    margin: 6px 0 0;
    overflow-wrap: anywhere;
  }
  :global(.player:fullscreen) h1 {
    font-size: 20px;
    margin: 8px 0;
    max-width: 70vw;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  :global(.player:fullscreen) .kicker {
    margin: 4px 0;
    font-size: 12px;
  }
  .speed {
    color: var(--gold);
  }
  .toolbar {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
  }
  /* Global inside the toolbar: DiscMenu's trigger is a .tool too. */
  .toolbar :global(.tool) {
    background: transparent;
    border-color: transparent;
    color: var(--text);
    padding: 10px 14px;
  }
  .toolbar :global(.tool:hover:not(:disabled)) {
    background: #ffffff0d;
  }
  .divider {
    width: 1px;
    height: 26px;
    background: var(--border);
    margin: 0 6px;
  }
  @media (max-width: 640px) {
    /* Icon-only on phones; the text stays as the accessible name. */
    .toolbar :global(.tool span) {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
    }
  }
</style>
