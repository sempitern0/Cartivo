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
  import { aspectLabel } from "../../../packages/media/src/display-scaler.ts";
  let {
    video,
    scaleMode,
    aspectMode,
    smooth,
    fallback,
    note,
    onchange,
    onclose,
  }: {
    video: VideoDescriptor;
    scaleMode: ScaleMode;
    aspectMode: AspectMode;
    smooth: boolean;
    /** The chosen scale does not fit and «Ajustar» is used meanwhile. */
    fallback: boolean;
    note: string;
    onchange: (patch: Partial<DisplayPreferences>) => void;
    onclose: () => void;
  } = $props();
  let panel = $state.raw<HTMLElement>();
  const ratio = $derived(aspectLabel(video.displayAspect));
  /** Square-pixel systems (Game Boy): corrected and native look the same. */
  const squarePixels = $derived(
    Math.abs(video.displayAspect - video.sourceWidth / video.sourceHeight) < 1e-6,
  );
  const scaleOptions = $derived<{ value: ScaleMode; label: string; hint: string }[]>([
    { value: "fit", label: "Ajustar", hint: "Ocupa todo el espacio disponible" },
    { value: "integer", label: "Píxel entero", hint: "Píxeles idénticos; puede dejar bordes" },
    ...(squarePixels
      ? []
      : [{ value: "corrected-integer" as const, label: `${ratio} entero`, hint: "Proporción original con píxel entero" }]),
  ]);
  const aspectOptions = $derived<{ value: AspectMode; label: string; hint: string }[]>([
    { value: "corrected", label: `${ratio} original`, hint: "Como se veía en su pantalla" },
    { value: "native", label: "Píxeles cuadrados", hint: `Imagen original de ${video.sourceWidth} × ${video.sourceHeight}` },
  ]);
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
    <h2 id="graphics-title">Gráficos</h2>
    <p>Los cambios se ven al momento sobre la imagen en pausa.</p>
    <button
      class="close icon-button"
      aria-label="Cerrar gráficos"
      onclick={onclose}>{@html icons.close}</button
    >
  </header>
  <fieldset>
    <legend>Escalado</legend>
    <div class="options" class:two={scaleOptions.length === 2}>
      {#each scaleOptions as option}<label
          class="option"
          class:checked={scaleMode === option.value}
        >
          <input
            type="radio"
            name="scale"
            value={option.value}
            checked={scaleMode === option.value}
            onchange={() => onchange({ scale: option.value })}
          />
          <svg class="diagram" viewBox="0 0 80 50" aria-hidden="true">
            <rect class="screen" x="1" y="1" width="78" height="48" rx="5" />
            {#if option.value === "fit"}<rect class="image" x="13" y="4" width="54" height="42" rx="2" />
            {:else if option.value === "integer"}<rect class="image" x="22" y="9" width="36" height="32" rx="2" /><path class="px" d="M22 17h36M22 25h36M22 33h36M31 9v32M40 9v32M49 9v32" />
            {:else}<rect class="image" x="19" y="9" width="42" height="32" rx="2" /><path class="px" d="M19 17h42M19 25h42M19 33h42M29.5 9v32M40 9v32M50.5 9v32" />{/if}
          </svg>
          <span class="name">{option.label}</span>
          <span class="hint">{option.hint}</span>
        </label>{/each}
    </div>
  </fieldset>
  {#if !squarePixels}<fieldset>
    <legend>Proporción</legend>
    <div class="options two">
      {#each aspectOptions as option}<label
          class="option"
          class:checked={aspectMode === option.value}
        >
          <input
            type="radio"
            name="aspect"
            value={option.value}
            checked={aspectMode === option.value}
            onchange={() => onchange({ aspect: option.value })}
          />
          <svg class="diagram" viewBox="0 0 80 50" aria-hidden="true">
            <rect class="screen" x="1" y="1" width="78" height="48" rx="5" />
            {#if option.value === "corrected"}<rect class="image" x="12" y="5" width="56" height="40" rx="2" />
            {:else}<rect class="image" x="17" y="5" width="46" height="40" rx="2" />{/if}
          </svg>
          <span class="name">{option.label}</span>
          <span class="hint">{option.hint}</span>
        </label>{/each}
    </div>
  </fieldset>{/if}
  <label class="switch">
    <input
      type="checkbox"
      role="switch"
      checked={smooth}
      onchange={(e) => onchange({ smooth: e.currentTarget.checked })}
    />
    <span class="track" aria-hidden="true"></span>
    <span>
      <span class="name">Suavizado</span>
      <span class="hint"
        >Difumina los bordes de los píxeles. Desactivado conserva el aspecto
        original.</span
      >
    </span>
  </label>
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

<style>
  .options { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
  .options.two { grid-template-columns: repeat(2, minmax(0, 1fr)); max-width: 66%; }
  .option { position: relative; display: grid; gap: 4px; padding: 14px; border-radius: 14px; border: 1px solid var(--border); background: var(--surface-2); cursor: pointer; }
  .option:hover { border-color: #565c72; }
  .option.checked { border-color: var(--blue); box-shadow: var(--glow); }
  /* The invisible input covers the whole card so pointer and keyboard both hit it. */
  .option input, .switch input { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: pointer; z-index: 1; }
  .option:has(input:focus-visible), .switch:has(input:focus-visible) { outline: 2px solid var(--focus); outline-offset: 3px; }
  .diagram { width: 100%; max-width: 120px; height: auto; margin-bottom: 6px; }
  .diagram .screen { fill: #0b0d13; stroke: #3a3f52; stroke-width: 1.5; }
  .diagram .image { fill: #24324b; stroke: var(--blue); stroke-width: 1.5; }
  .option.checked .diagram .image { fill: #2b4f7d; }
  .diagram .px { stroke: #619de566; stroke-width: 0.8; }
  .switch { position: relative; display: flex; align-items: flex-start; gap: 14px; margin-top: 20px; padding: 14px; border-radius: 14px; border: 1px solid var(--border); background: var(--surface-2); cursor: pointer; }
  .track { flex: none; position: relative; width: 44px; height: 26px; border-radius: 999px; background: #2a2e3d; border: 1px solid var(--border); margin-top: 2px; }
  .track::after { content: ""; position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: var(--muted); }
  .switch:has(input:checked) .track { background: var(--blue); border-color: var(--blue); }
  .switch:has(input:checked) .track::after { left: 21px; background: #111218; }
  @media (prefers-reduced-motion: no-preference) { .track::after { transition: left 120ms ease-out; } }
  @media (max-width: 640px) {
    .options, .options.two { grid-template-columns: minmax(0, 1fr); max-width: none; }
    .option { grid-template-columns: 72px 1fr; column-gap: 12px; align-items: center; }
    .option .diagram { grid-row: 1 / span 2; margin: 0; }
  }
</style>
