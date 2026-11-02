<script lang="ts">
  // One-time question under the player (ADR-012): remember games on this
  // device? It never pauses the game; the player handles the answer.
  let { onanswer }: { onanswer: (remember: boolean) => void } = $props();
</script>

<div
  class="remember-ask"
  role="group"
  aria-labelledby="remember-ask-text"
  data-player-chrome
>
  <p id="remember-ask-text">
    ¿Recordar tus juegos en este dispositivo para continuar con un clic?
  </p>
  <button data-player-action onclick={() => onanswer(true)}
    >Sí, recordar</button
  ><button data-player-action onclick={() => onanswer(false)}>No</button>
</div>

<style>
  .remember-ask {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    gap: 8px 12px;
    margin: 12px 0 0;
    font-size: 14px;
  }
  p {
    margin: 0;
  }
  button {
    min-height: 36px;
    padding: 6px 14px;
    font-size: 14px;
  }
</style>
