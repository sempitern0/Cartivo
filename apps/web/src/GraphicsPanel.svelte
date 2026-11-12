<script lang="ts">
  // Presentation options. Values and persistence belong to the player; this
  // panel only shows them and reports changes.
  import { onMount } from "svelte";
  import { icons } from "./icons.ts";
  import {
    defaultDisplay,
    type DisplayPreferences,
  } from "../../../packages/media/src/display-preferences.ts";
  import type {
    AspectMode,
    ScaleMode,
    VideoDescriptor,
  } from "../../../packages/media/src/display-scaler.ts";
  import type { RenderChoice } from "../../../packages/runtime/src/render-scale.ts";
  import DisplayOptions from "./DisplayOptions.svelte";
  let {
    video,
    scaleMode,
    aspectMode,
    smooth,
    resolution,
    autoScale,
    fallback,
    note,
    onchange,
    onclose,
  }: {
    video: VideoDescriptor;
    scaleMode: ScaleMode;
    aspectMode: AspectMode;
    smooth: boolean;
    /** A console drawn by the GPU: its resolution and what «auto» gives. */
    resolution?: RenderChoice;
    autoScale?: number;
    /** The chosen scale does not fit and «Ajustar» is used meanwhile. */
    fallback: boolean;
    note: string;
    onchange: (patch: Partial<DisplayPreferences>) => void;
    onclose: () => void;
  } = $props();
  let panel = $state.raw<HTMLElement>();
  onMount(() => {
    panel
      ?.querySelector<HTMLInputElement>("input:checked")
      ?.focus({ preventScroll: true });
  });
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<section
  id="graphics-panel"
  class="panel graphics card"
  data-player-chrome
  aria-labelledby="graphics-title"
  bind:this={panel}
  onkeydown={(e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onclose();
    }
  }}
>
  <header>
    <h2 id="graphics-title">Ajustes del juego</h2>
    <p>
      Pantalla de esta consola; los cambios se ven al momento sobre la imagen
      en pausa. <a href="#controles">Controles</a>
    </p>
    <button
      class="close icon-button"
      aria-label="Cerrar ajustes del juego"
      onclick={onclose}>{@html icons.close}</button
    >
  </header>
  <DisplayOptions
    {video}
    {scaleMode}
    {aspectMode}
    {smooth}
    {resolution}
    {autoScale}
    name="graphics"
    {onchange}
  />
  <footer>
    <p aria-live="polite">
      {fallback
        ? "Ese escalado no cabe en esta ventana: se usa Ajustar hasta que haya espacio."
        : note}
    </p>
    <button
      onclick={() => onchange({ ...defaultDisplay })}
      disabled={scaleMode === defaultDisplay.scale &&
        aspectMode === defaultDisplay.aspect &&
        smooth === defaultDisplay.smooth}>Restablecer</button
    >
    <button class="primary" onclick={onclose}>Listo</button>
  </footer>
</section>
