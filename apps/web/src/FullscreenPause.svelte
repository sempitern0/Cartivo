<script lang="ts">
  // In fullscreen the chrome stays hidden even in pause: only this layer.
  let {
    busy,
    onresume,
    onexit,
  }: { busy: boolean; onresume: () => void; onexit: () => void } = $props();
</script>

<div class="fullscreen-pause" role="group" aria-label="En pausa">
  <button class="primary" onclick={onresume} disabled={busy}
    >Reanudar juego</button
  ><button onclick={onexit}>Salir de pantalla completa</button>
</div>

<style>
  .fullscreen-pause {
    position: absolute;
    inset: 0;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    gap: 12px;
    background: #050507b3;
  }
</style>
