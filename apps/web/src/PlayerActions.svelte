<script lang="ts">
  // Compact actions under the video. Every button is a player action: the
  // running game never steals its pointer or focus events.
  type Phase = "ready" | "loading" | "running" | "paused" | "error";
  let {
    phase,
    busy,
    audioReady,
    muted,
    focusMode,
    fullscreen,
    fullscreenAvailable,
    element = $bindable(),
    resumeButton = $bindable(),
    onpause,
    onresume,
    onreset,
    ontap,
    onsound,
    onmute,
    onfocus,
    onfullscreen,
  }: {
    phase: Phase;
    busy: boolean;
    audioReady: boolean;
    muted: boolean;
    focusMode: boolean;
    fullscreen: boolean;
    fullscreenAvailable: boolean;
    element?: HTMLDivElement;
    resumeButton?: HTMLButtonElement;
    onpause: () => void;
    onresume: () => void;
    onreset: () => void;
    ontap: (action: "start" | "select") => void;
    onsound: () => void;
    onmute: () => void;
    onfocus: () => void;
    onfullscreen: () => void;
  } = $props();
</script>

<div bind:this={element} class="player-actions" data-player-chrome>
  {#if phase === "running"}<button data-player-action onclick={onpause}
      >Pausar juego</button
    ><button data-player-action onclick={() => ontap("select")}
      >Select · Q</button
    ><button data-player-action onclick={() => ontap("start")}
      >Start · Enter</button
    >{/if}
  {#if phase === "paused"}<button
      bind:this={resumeButton}
      class="primary"
      onclick={onresume}
      disabled={busy}>Reanudar juego</button
    ><button data-player-action onclick={onreset} disabled={busy}
      >Reiniciar consola</button
    >{/if}
  {#if !audioReady && phase === "running"}<button
      data-player-action
      onclick={onsound}>Activar sonido</button
    >{/if}
  {#if audioReady}<button
      data-player-action
      aria-pressed={muted}
      onclick={onmute}>{muted ? "Activar sonido" : "Silenciar"}</button
    >{/if}
  <button
    data-player-action
    class:focus-selected={focusMode}
    onclick={onfocus}
    aria-pressed={focusMode}
    aria-label={focusMode ? "Desactivar Focus" : "Activar Focus"}
    >{focusMode ? "Focus activado" : "Activar Focus"}</button
  >
  {#if fullscreenAvailable}<button data-player-action onclick={onfullscreen}
      >{fullscreen ? "Salir de pantalla completa" : "Pantalla completa"}</button
    >{/if}
  <a data-player-action href="#controles">Configurar controles</a>
</div>

<style>
  .player-actions {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
  }
  button,
  a {
    min-height: 40px;
    padding: 8px 14px;
    font-size: 14px;
  }
  .focus-selected {
    border-color: var(--teal);
    color: var(--teal);
    background: #17312e;
  }
</style>
