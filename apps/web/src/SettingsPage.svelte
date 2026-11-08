<script lang="ts" module>
  // Ajustes (#ajustes, ADR-018): one stable page with six tabs, the same
  // everywhere. During a game, «Ajustes del juego» shows only that console's
  // screen; this page holds the defaults and the rest.
  export const settingsTabs = [
    ["pantalla", "Pantalla"],
    ["sonido", "Sonido"],
    ["controles", "Controles"],
    ["interfaz", "Interfaz"],
    ["almacenamiento", "Almacenamiento"],
    ["avanzado", "Avanzado"],
  ] as const;
  export type SettingsTab = (typeof settingsTabs)[number][0];
  /** `#ajustes/<tab>`; `#controles` stays as the direct link to controls. */
  export function tabFromHash(hash: string): SettingsTab | undefined {
    if (hash === "#controles") return "controles";
    const id = /^#ajustes\/([a-z]+)$/.exec(hash)?.[1];
    return settingsTabs.find(([tab]) => tab === id)?.[0];
  }
  /** Coming back to Ajustes opens the tab used last this visit. */
  let lastTab: SettingsTab = "pantalla";
</script>

<script lang="ts">
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

  let {
    inGame = false,
    tab,
  }: { inGame?: boolean; /** The tab the address asks for. */ tab?: SettingsTab } =
    $props();

  let selected = $state<SettingsTab>(lastTab);
  $effect.pre(() => {
    if (tab) selected = lastTab = tab;
  });
  function select(id: SettingsTab, focus = false) {
    selected = lastTab = id;
    // The address names the tab without adding a history step.
    history.replaceState(history.state, "", `#ajustes/${id}`);
    if (focus) document.getElementById(`tab-${id}`)?.focus();
  }
  /** Arrows, Home and End move along the tabs (WAI-ARIA tabs pattern). */
  function onTabKey(event: KeyboardEvent) {
    const ids = settingsTabs.map(([id]) => id);
    const at = ids.indexOf(selected);
    const to = {
      ArrowRight: at + 1,
      ArrowLeft: at - 1,
      Home: 0,
      End: ids.length - 1,
    }[event.key];
    if (to === undefined) return;
    event.preventDefault();
    select(ids[(to + ids.length) % ids.length], true);
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

<div
  class="settings-tabs"
  role="tablist"
  aria-label="Secciones de ajustes"
  tabindex="-1"
  onkeydown={onTabKey}
>
  {#each settingsTabs as [id, label] (id)}<button
      id={`tab-${id}`}
      role="tab"
      aria-selected={selected === id}
      aria-controls={id}
      tabindex={selected === id ? 0 : -1}
      onclick={() => select(id)}>{label}</button
    >{/each}
</div>

<section
  class="category"
  id="pantalla"
  role="tabpanel"
  aria-labelledby="tab-pantalla"
  tabindex="0"
  hidden={selected !== "pantalla"}
>
  <h2>Pantalla</h2>
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

<section
  class="category"
  id="sonido"
  role="tabpanel"
  aria-labelledby="tab-sonido"
  tabindex="0"
  hidden={selected !== "sonido"}
>
  <h2>Sonido</h2>
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

<section
  class="category"
  id="controles"
  role="tabpanel"
  aria-labelledby="tab-controles"
  tabindex="0"
  hidden={selected !== "controles"}
>
  <h2>Configurar controles</h2>
  <ControlsPanel />
</section>

<section
  class="category"
  id="interfaz"
  role="tabpanel"
  aria-labelledby="tab-interfaz"
  tabindex="0"
  hidden={selected !== "interfaz"}
>
  <InterfacePreference />
</section>

<section
  class="category"
  id="almacenamiento"
  role="tabpanel"
  aria-labelledby="tab-almacenamiento"
  tabindex="0"
  hidden={selected !== "almacenamiento"}
>
  <h2>Almacenamiento</h2>
  <p class="hint">
    Juegos, partidas y ajustes se quedan en este navegador. {usage}
  </p>
  {#if !inGame}<a class="button-link" href="#juegos"
      >Gestionar juegos en «Tus juegos»</a
    >{/if}
</section>

<section
  class="category"
  id="avanzado"
  role="tabpanel"
  aria-labelledby="tab-avanzado"
  tabindex="0"
  hidden={selected !== "avanzado"}
>
  <h2>Avanzado</h2>
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
  .settings-tabs {
    display: flex;
    gap: 4px;
    margin-bottom: 24px;
    overflow-x: auto;
    scrollbar-width: none;
    border-bottom: 1px solid var(--border);
  }
  .settings-tabs:focus {
    outline: none;
  }
  .settings-tabs button {
    flex: none;
    min-height: 44px;
    padding: 10px 16px;
    border: 0;
    border-bottom: 2px solid transparent;
    border-radius: 10px 10px 0 0;
    background: transparent;
    color: var(--muted);
  }
  .settings-tabs button:hover {
    color: var(--text);
  }
  .settings-tabs button[aria-selected="true"] {
    color: var(--text);
    border-bottom-color: var(--teal);
    font-weight: 650;
  }
  .settings-tabs button:focus-visible {
    outline-offset: -2px;
  }
  .category {
    margin: 0 0 32px;
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
