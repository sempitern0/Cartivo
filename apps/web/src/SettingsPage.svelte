<script lang="ts">
  // Ajustes (#controles, ADR-018): one stable page with six categories, the
  // same everywhere. During a game, «Ajustes del juego» shows only that
  // console's screen; this page holds the defaults and the rest.
  import ControlsPanel from "./ControlsPanel.svelte";
  import InterfacePreference from "./InterfacePreference.svelte";
  import DisplayOptions from "./DisplayOptions.svelte";
  import { DisplaySettings } from "./display.svelte.ts";
  import {
    availableSystems,
    type SystemInfo,
  } from "../../../packages/runtime/src/systems.ts";
  import {
    readCore,
    writeCore,
  } from "../../../packages/runtime/src/core-preference.ts";
  import {
    readSound,
    writeSound,
  } from "../../../packages/media/src/sound-preferences.ts";
  import { defaultDisplay } from "../../../packages/media/src/display-preferences.ts";

  let { inGame = false }: { inGame?: boolean } = $props();

  const sections = [
    ["pantalla", "Pantalla"],
    ["sonido", "Sonido"],
    ["configurar-controles", "Controles"],
    ["interfaz", "Interfaz"],
    ["almacenamiento", "Almacenamiento"],
    ["avanzado", "Avanzado"],
  ] as const;
  function go(id: string) {
    const target = document.getElementById(id);
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: "start" });
  }

  // Pantalla: one console at a time, the same options as in the game.
  const consoles = availableSystems();
  let screenSystem = $state<SystemInfo>(consoles[0]);
  const display = $derived(new DisplaySettings(screenSystem));

  // Sonido: the device's level for every game.
  const saved = readSound();
  let volume = $state(Math.round(saved.volume * 100));
  let muted = $state(saved.muted);
  let soundNote = $state("");
  function storeSound() {
    soundNote = writeSound({ volume: volume / 100, muted })
      ? "Se aplicará al abrir un juego."
      : "El navegador no permite guardar esta preferencia.";
  }

  // Almacenamiento: what this browser reports.
  const megabytes = (bytes: number) =>
    `${(bytes / (1024 * 1024)).toLocaleString("es", { maximumFractionDigits: 1 })} MB`;
  let usage = $state("");
  $effect(() => {
    void navigator.storage
      ?.estimate?.()
      .then(({ usage: used, quota }) => {
        if (used !== undefined && quota)
          usage = `Cartivo usa ${megabytes(used)} de ${megabytes(quota)} disponibles en este navegador.`;
      })
      .catch(() => {});
  });

  // Avanzado: consoles with more than one core.
  const choosable = consoles.filter((s) => s.cores.length > 1);
  let coreNote = $state("");
  function chooseCore(system: SystemInfo, id: string) {
    coreNote = writeCore(system, id)
      ? `${system.name} usará ${system.cores.find((c) => c.id === id)?.label} desde el próximo juego.`
      : "El navegador no permite guardar esta preferencia.";
  }
</script>

<nav class="settings-sections" aria-label="Secciones de ajustes">
  {#each sections as [id, label] (id)}<button onclick={() => go(id)}
      >{label}</button
    >{/each}
</nav>

<section class="category" id="pantalla" tabindex="-1" aria-labelledby="pantalla-title">
  <h2 id="pantalla-title">Pantalla</h2>
  <p class="hint">
    Cada consola recuerda su escalado, proporción y suavizado. Durante la
    partida, también desde «Ajustes del juego».
  </p>
  <label class="field"
    >Consola <select
      value={screenSystem.id}
      onchange={(e) =>
        (screenSystem =
          consoles.find((s) => s.id === e.currentTarget.value) ?? consoles[0])}
    >
      {#each consoles as system (system.id)}<option value={system.id}
          >{system.name}</option
        >{/each}
    </select></label
  >
  <DisplayOptions
    video={screenSystem.video}
    scaleMode={display.scale}
    aspectMode={display.aspect}
    smooth={display.smooth}
    name="settings"
    onchange={(patch) => display.set(patch)}
  />
  <div class="row">
    <p class="hint" aria-live="polite">{display.note}</p>
    <button
      onclick={() => display.set({ ...defaultDisplay })}
      disabled={display.scale === defaultDisplay.scale &&
        display.aspect === defaultDisplay.aspect &&
        display.smooth === defaultDisplay.smooth}>Restablecer</button
    >
  </div>
</section>

<section class="category" id="sonido" tabindex="-1" aria-labelledby="sonido-title">
  <h2 id="sonido-title">Sonido</h2>
  <label class="field volume"
    >Volumen <input
      type="range"
      min="0"
      max="100"
      step="5"
      bind:value={volume}
      onchange={storeSound}
      aria-valuetext={`${volume} %`}
    /><output>{volume} %</output></label
  >
  <label class="check"
    ><input type="checkbox" bind:checked={muted} onchange={storeSound} /> Silenciar
    los juegos</label
  >
  <p class="hint" aria-live="polite">{soundNote}</p>
</section>

<section class="category" aria-labelledby="configurar-controles">
  <h2 id="configurar-controles" tabindex="-1">Configurar controles</h2>
  <ControlsPanel />
</section>

<section class="category" id="interfaz" tabindex="-1" aria-label="Interfaz">
  <InterfacePreference />
</section>

<section
  class="category"
  id="almacenamiento"
  tabindex="-1"
  aria-labelledby="almacenamiento-title"
>
  <h2 id="almacenamiento-title">Almacenamiento</h2>
  <p class="hint">
    Juegos, partidas y ajustes se quedan en este navegador. {usage}
  </p>
  {#if !inGame}<a class="button-link" href="#juegos"
      >Gestionar juegos en «Tus juegos»</a
    >{/if}
</section>

<section class="category" id="avanzado" tabindex="-1" aria-labelledby="avanzado-title">
  <h2 id="avanzado-title">Avanzado</h2>
  {#each choosable as system (system.id)}
    <label class="field"
      >Núcleo de {system.name}
      <select
        value={readCore(system)}
        onchange={(e) => chooseCore(system, e.currentTarget.value)}
      >
        {#each system.cores as core (core.id)}<option value={core.id}
            >{core.label}</option
          >{/each}
      </select></label
    >
  {/each}
  <p class="hint" aria-live="polite">{coreNote}</p>
  <p class="hint">
    El rendimiento de cada sesión y los detalles del núcleo están en la pausa
    del juego.
  </p>
</section>

<style>
  .settings-sections {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 24px;
  }
  .settings-sections button {
    min-height: 44px;
  }
  .category {
    margin: 0 0 32px;
    scroll-margin-top: 16px;
  }
  .category:focus {
    outline: none;
  }
  .category:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 6px;
    border-radius: 8px;
  }
  h2 {
    margin: 0 0 8px;
  }
  .hint {
    color: var(--muted);
  }
  .field {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
    margin: 12px 0;
    min-height: 44px;
  }
  .field select {
    min-height: 44px;
  }
  .volume input {
    flex: 1;
    max-width: 320px;
  }
  .check {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 44px;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: 12px;
  }
  .row button,
  .button-link {
    min-height: 44px;
    display: inline-flex;
    align-items: center;
  }
</style>
