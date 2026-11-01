<script lang="ts">
  import { onMount } from "svelte";
  import { displayLayout, type ScaleMode, type AspectMode, type VideoDescriptor } from "../../../packages/media/src/display-scaler.ts";
  let { video, label, scaleMode = "fit", aspectMode = "corrected", smooth = false, frames = 0, screen = $bindable(), fallback = $bindable(false) }: {
    /** Framebuffer and display aspect of the running system. */
    video: VideoDescriptor; label: string;
    scaleMode?: ScaleMode; aspectMode?: AspectMode; smooth?: boolean; frames?: number; screen: HTMLCanvasElement | undefined;
    /** True when the chosen scale does not fit and "fit" is used instead. */
    fallback?: boolean;
  } = $props();
  let container: HTMLDivElement;
  let width = $state(0);
  let height = $state(0);
  let calculated = $derived(displayLayout(width, height, video, scaleMode, aspectMode));
  $effect(() => {
    fallback = width > 0 && calculated.fallback;
  });
  onMount(() => {
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) { width = rect.width; height = rect.height; }
    });
    observer.observe(container);
    return () => observer.disconnect();
  });
</script>

<div class="stage" bind:this={container} data-testid="game-stage">
  <!-- svelte-ignore a11y_no_noninteractive_tabindex a11y_no_noninteractive_element_interactions -->
  <canvas bind:this={screen} width={video.sourceWidth} height={video.sourceHeight} tabindex="0"
    aria-label={`Pantalla del juego ${label}. Escape para pausar.`}
    data-frames={frames}
    style:width={calculated.width + "px"}
    style:height={calculated.height + "px"}
    data-actual-scale={calculated.actualMode}
    data-scale-fallback={String(calculated.fallback)}
    class:smooth
  ></canvas>
</div>

<style>
.stage { position: relative; width: 100%; height: 100%; min-height: 0; min-width: 0; display: flex; align-items: center; justify-content: center; overflow: hidden; background: #050507; }
canvas { display: block; max-width: 100%; max-height: 100%; flex: none; background: #000; image-rendering: pixelated; border: 0; }
canvas.smooth { image-rendering: auto; }
canvas:focus-visible { outline: 3px solid var(--gold); outline-offset: -3px; }
</style>
