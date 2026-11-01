<script lang="ts">
  import {
    PREVIEW_HEIGHT,
    PREVIEW_WIDTH,
  } from "../../../packages/storage/src/states.ts";
  // Preview of a saved snapshot (RGBA 128×120); empty when absent.
  let { pixels, fill = false }: { pixels?: Uint8ClampedArray; fill?: boolean } =
    $props();
  let canvas = $state.raw<HTMLCanvasElement>();
  $effect(() => {
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    if (pixels && pixels.length === PREVIEW_WIDTH * PREVIEW_HEIGHT * 4)
      ctx.putImageData(
        new ImageData(
          new Uint8ClampedArray(pixels),
          PREVIEW_WIDTH,
          PREVIEW_HEIGHT,
        ),
        0,
        0,
      );
    else ctx.clearRect(0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT);
  });
</script>

<canvas
  bind:this={canvas}
  width={PREVIEW_WIDTH}
  height={PREVIEW_HEIGHT}
  class="thumb"
  class:empty={!pixels}
  class:fill
  aria-hidden="true"
></canvas>

<style>
  .thumb {
    width: 128px;
    height: 120px;
    border-radius: 8px;
    background: #050507;
    border: 1px solid var(--border);
    image-rendering: pixelated;
  }
  .thumb.fill {
    width: 100%;
    height: auto;
    aspect-ratio: 16 / 15;
  }
  .thumb.empty {
    opacity: 0.4;
  }
</style>
