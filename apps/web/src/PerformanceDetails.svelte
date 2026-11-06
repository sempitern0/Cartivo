<script lang="ts">
  import type { FrameMetrics } from "../../../packages/media/src/frame-metrics.ts";
  // Paused only: what the last advance requests measured (ADR-001, revision).
  let { diagnostics, loadMs }: { diagnostics: ReturnType<FrameMetrics["snapshot"]>; loadMs?: number } =
    $props();
</script>

{#if diagnostics.samples > 0}
  <details data-player-chrome>
    <summary>Rendimiento de la sesión</summary>
    {#if loadMs !== undefined}<p data-testid="load-duration">Preparación del juego: {loadMs.toFixed(0)} ms (Worker, ROM, núcleo y almacenamiento; no incluye la espera del jugador).</p>{/if}
    <p>
      Últimas {diagnostics.samples} solicitudes: {diagnostics.fps.toFixed(1)} fotogramas
      emulados/s. Worker, ida y vuelta: media {diagnostics.meanMs.toFixed(1)} ms;
      percentil 95 {diagnostics.p95Ms.toFixed(1)} ms.
    </p>
    <p>
      Medición local desde la última reanudación. No mide latencia del mando ni
      FPS de pantalla.
    </p>
  </details>
{/if}
