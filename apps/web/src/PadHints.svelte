<script lang="ts">
  // Modo consola: what the pad's buttons do, always at the bottom. Hidden
  // while a game runs (the picture is the game's).
</script>

<p class="pad-hints" aria-hidden="true">
  <span><b class="button a">A</b> Aceptar</span>
  <span><b class="button b">B</b> Volver</span>
  <span><b class="button">Select + Start</b> Pausa</span>
</p>

<style>
  .pad-hints {
    position: fixed;
    inset: auto 0 0;
    z-index: 5;
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: 8px 28px;
    margin: 0;
    padding: 10px 16px calc(10px + env(safe-area-inset-bottom));
    background: #111218e6;
    border-top: 1px solid var(--border);
    font-size: 15px;
    color: var(--muted);
  }
  span {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
  .button {
    display: inline-grid;
    place-items: center;
    min-width: 26px;
    height: 26px;
    padding: 0 8px;
    border-radius: 999px;
    border: 1px solid var(--border);
    color: var(--text);
    font-size: 13px;
  }
  .a {
    border-color: var(--teal);
    color: var(--teal);
  }
  .b {
    border-color: var(--coral);
    color: var(--coral);
  }
  :global(:root:has(.player.playing)) .pad-hints {
    display: none;
  }
</style>
