<script lang="ts">
  // Before and after for the display options: the default next to the
  // player's choice, each laid out by displayLayout for this window (so
  // borders and fallbacks are real) and with a zoom at the true scale, where
  // uneven pixels and smoothing show. The picture is Cartivo's own.
  import {
    displayLayout,
    type AspectMode,
    type ScaleMode,
    type VideoDescriptor,
  } from "../../../packages/media/src/display-scaler.ts";
  import {
    defaultDisplay,
    type DisplayPreferences,
  } from "../../../packages/media/src/display-preferences.ts";
  import { samplePixels, spriteCentre } from "./display-sample.ts";

  let {
    video,
    scaleMode,
    aspectMode,
    smooth,
  }: {
    video: VideoDescriptor;
    scaleMode: ScaleMode;
    aspectMode: AspectMode;
    smooth: boolean;
  } = $props();

  let windowWidth = $state(1280);
  let windowHeight = $state(720);
  const modeLabel = { fit: "Ajustar", integer: "Píxel entero", "corrected-integer": "Entero corregido" };

  const panes = $derived(
    (
      [
        ["Predeterminado", defaultDisplay],
        ["Tu elección", { scale: scaleMode, aspect: aspectMode, smooth }],
      ] as [string, DisplayPreferences][]
    ).map(([label, prefs]) => {
      const layout = displayLayout(windowWidth, windowHeight, video, prefs.scale, prefs.aspect);
      const factorX = layout.width / video.sourceWidth;
      const factorY = layout.height / video.sourceHeight;
      const times = (f: number) => `×${f.toLocaleString("es", { maximumFractionDigits: 2 })}`;
      return {
        label,
        smooth: prefs.smooth,
        layout,
        detail:
          `${modeLabel[layout.actualMode]} ${times(factorX)}` +
          (Math.abs(factorX - factorY) > 1e-6 ? ` · ${times(factorY)} en vertical` : "") +
          (prefs.smooth ? " · suavizado" : ""),
        factorX,
        factorY,
      };
    }),
  );
  const same = $derived(
    scaleMode === defaultDisplay.scale &&
      aspectMode === defaultDisplay.aspect &&
      smooth === defaultDisplay.smooth,
  );
  const centre = $derived(spriteCentre(video.sourceWidth, video.sourceHeight));
  const percent = (part: number, whole: number) => `${(part / whole) * 100}%`;

  /**
   * The sample at the console's source resolution, as an image: the page
   * keeps a single <canvas>, the game's.
   */
  const sample = $derived.by(() => {
    const { sourceWidth: w, sourceHeight: h } = video;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")?.putImageData(new ImageData(samplePixels(w, h), w, h), 0, 0);
    return canvas.toDataURL();
  });
</script>

<svelte:window bind:innerWidth={windowWidth} bind:innerHeight={windowHeight} />

<div class="preview" data-testid="display-preview">
  {#each panes as pane, index (index)}
    <figure class:chosen={index === 1} hidden={index === 1 && same}>
      <figcaption>
        <span class="name">{index === 0 && same ? "Predeterminado (tu elección)" : pane.label}</span>
        <span class="hint">{pane.detail}</span>
      </figcaption>
      <div class="screen" style:aspect-ratio={`${windowWidth} / ${windowHeight}`}>
        <img
          src={sample}
          alt=""
          class:smooth={pane.smooth}
          style:left={percent(pane.layout.offsetX, windowWidth)}
          style:top={percent(pane.layout.offsetY, windowHeight)}
          style:width={percent(pane.layout.width, windowWidth)}
          style:height={percent(pane.layout.height, windowHeight)}
        />
      </div>
      <!-- At the real size on screen: what one source pixel becomes. -->
      <div class="zoom" aria-hidden="true">
        <img
          src={sample}
          alt=""
          class:smooth={pane.smooth}
          style:width={`${pane.layout.width}px`}
          style:height={`${pane.layout.height}px`}
          style:left={`calc(50% - ${(centre.x + 0.5) * pane.factorX}px)`}
          style:top={`calc(50% - ${(centre.y + 0.5) * pane.factorY}px)`}
        />
      </div>
    </figure>
  {/each}
</div>

<style>
  .preview {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr));
    gap: 12px;
    margin-bottom: 20px;
  }
  figure {
    margin: 0;
    display: grid;
    gap: 8px;
    padding: 12px;
    border-radius: 14px;
    border: 1px solid var(--border);
    background: var(--surface-2);
  }
  figure[hidden] {
    display: none;
  }
  figure.chosen {
    border-color: var(--blue);
  }
  figcaption {
    display: grid;
    gap: 2px;
  }
  .name {
    font-weight: 650;
    font-size: 14px;
  }
  .hint {
    font-size: 13px;
    color: var(--muted);
  }
  .screen,
  .zoom {
    position: relative;
    overflow: hidden;
    border-radius: 8px;
    background: #000;
  }
  .screen {
    width: 100%;
  }
  .zoom {
    height: 120px;
  }
  img {
    position: absolute;
    display: block;
    max-width: none;
    image-rendering: pixelated;
  }
  img.smooth {
    image-rendering: auto;
  }
</style>
