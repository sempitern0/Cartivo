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
  import { Tabs } from "bits-ui";
  import ControlsPanel from "./ControlsPanel.svelte";
  import InterfacePreference from "./InterfacePreference.svelte";
  import DisplayOptions from "./DisplayOptions.svelte";
  import { megabytes } from "./format.ts";
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
  /** Bits UI runs the tabs (keys, focus, ARIA; ADR-019); this keeps the address. */
  function select(id: string) {
    const found = settingsTabs.find(([tab]) => tab === id)?.[0];
    if (!found) return;
    selected = lastTab = found;
    // The address names the tab without adding a history step.
    history.replaceState(history.state, "", `#ajustes/${found}`);
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

  // Almacenamiento: only what Cartivo uses. The browser's quota is left out:
  // some browsers report a masked figure (Brave says 2 GB) and it read as a
  // limit on the ROMs a player can open from their own disk.
  let usage = $state("");
  $effect(() => {
    void navigator.storage
      ?.estimate?.()
      .then(({ usage: used }) => {
        if (used !== undefined)
          usage = `Ahora ocupan ${megabytes(used)} en este navegador.`;
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

<Tabs.Root value={selected} onValueChange={select}>
<Tabs.List class="settings-tabs" aria-label="Secciones de ajustes">
  {#each settingsTabs as [id, label] (id)}<Tabs.Trigger value={id}
      >{label}</Tabs.Trigger
    >{/each}
</Tabs.List>

<Tabs.Content class="settings-panel" id="pantalla" value="pantalla">
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
</Tabs.Content>

<Tabs.Content class="settings-panel" id="sonido" value="sonido">
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
</Tabs.Content>

<Tabs.Content class="settings-panel" id="controles" value="controles">
  <h2>Configurar controles</h2>
  <ControlsPanel />
</Tabs.Content>

<Tabs.Content class="settings-panel" id="interfaz" value="interfaz">
  <InterfacePreference />
</Tabs.Content>

<Tabs.Content class="settings-panel" id="almacenamiento" value="almacenamiento">
  <h2>Almacenamiento</h2>
  <p class="hint">
    Partidas, ajustes y las copias de los juegos que se recuerdan para
    «Continuar» se quedan en este navegador. {usage}
  </p>
  <p class="hint">
    Puedes abrir cualquier ROM de tu disco aunque no se recuerde: el espacio
    del navegador solo cuenta esas copias. Si un día no cabe una, Cartivo lo
    dice al guardarla y el juego se abre igual.
  </p>
  {#if !inGame}<a class="button-link" href="#juegos"
      >Gestionar juegos en «Tus juegos»</a
    >{/if}
</Tabs.Content>

<Tabs.Content class="settings-panel" id="avanzado" value="avanzado">
  <h2>Avanzado</h2>
  {#each choosable as system (system.id)}
    {@const current = readCore(system)}
    <fieldset class="cores">
      <legend>Núcleo de {system.name}</legend>
      {#if system.coreAdvice}<p class="hint">{system.coreAdvice}</p>{/if}
      <div class="core-options">
        {#each system.cores as core (core.id)}<div class="core">
            <!-- The radio covers the card; the trade-offs are read after it. -->
            <label
              ><input
                type="radio"
                name={`core-${system.id}`}
                value={core.id}
                checked={current === core.id}
                onchange={() => chooseCore(system, core.id)}
              /><span class="core-name"
                >{core.label}{#if core.id === system.defaultCore}<span
                    class="badge">Recomendado</span
                  >{/if}</span
              >{#if core.advice}<span class="hint">{core.advice.summary}</span
                >{/if}</label
            >
            {#if core.advice}
              <div class="trade">
                <div class="pros">
                  <strong>A favor</strong>
                  <ul>
                    {#each core.advice.pros as item}<li>{item}</li>{/each}
                  </ul>
                </div>
                <div class="cons">
                  <strong>En contra</strong>
                  <ul>
                    {#each core.advice.cons as item}<li>{item}</li>{/each}
                  </ul>
                </div>
              </div>
            {/if}
          </div>{/each}
      </div>
    </fieldset>
  {/each}
  <p class="hint" aria-live="polite">{coreNote}</p>
  <p class="hint">
    El rendimiento de cada sesión y los detalles del núcleo están en la pausa
    del juego.
  </p>
</Tabs.Content>
</Tabs.Root>

<style>
  :global(.settings-tabs) {
    display: flex;
    gap: 4px;
    margin-bottom: 24px;
    overflow-x: auto;
    scrollbar-width: none;
    border-bottom: 1px solid var(--border);
  }
  :global(.settings-tabs:focus) {
    outline: none;
  }
  :global(.settings-tabs button) {
    flex: none;
    min-height: 44px;
    padding: 10px 16px;
    border: 0;
    border-bottom: 2px solid transparent;
    border-radius: 10px 10px 0 0;
    background: transparent;
    color: var(--muted);
  }
  :global(.settings-tabs button:hover) {
    color: var(--text);
  }
  :global(.settings-tabs button[data-state="active"]) {
    color: var(--text);
    border-bottom-color: var(--teal);
    font-weight: 650;
  }
  :global(.settings-tabs button:focus-visible) {
    outline-offset: -2px;
  }
  :global(.settings-panel) {
    margin: 0 0 32px;
  }
  /* Each panel rises in when its tab opens (no motion if reduced). */
  :global(.settings-panel:not([hidden])) {
    animation: panel-in 0.18s ease-out;
  }
  @keyframes panel-in {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
  }
  :global(.settings-panel:focus) {
    outline: none;
  }
  :global(.settings-panel:focus-visible) {
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
  .cores {
    border: 0;
    margin: 12px 0 0;
    padding: 0;
  }
  .cores legend {
    font-weight: 650;
    padding: 0;
  }
  .core-options {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(300px, 100%), 1fr));
    gap: 12px;
    margin-top: 12px;
  }
  .core {
    position: relative;
    display: grid;
    gap: 6px;
    align-content: start;
    padding: 14px 16px;
    border-radius: 14px;
    border: 1px solid var(--border);
    background: var(--surface-2);
    cursor: pointer;
  }
  .core:has(input:checked) {
    border-color: var(--blue);
    box-shadow: var(--glow);
  }
  .core:has(input:focus-visible) {
    outline: 2px solid var(--focus);
    outline-offset: 3px;
  }
  .core input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    opacity: 0;
    cursor: pointer;
  }
  .core label {
    display: grid;
    gap: 6px;
    cursor: pointer;
  }
  .core-name {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    font-weight: 650;
  }
  .badge {
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
    color: var(--teal);
    border: 1px solid currentColor;
  }
  .core .hint {
    margin: 0;
  }
  .trade {
    display: grid;
    gap: 8px;
    font-size: 14px;
  }
  .trade ul {
    margin: 4px 0 0;
    padding-left: 18px;
  }
  .trade strong {
    font-size: 13px;
  }
  .pros strong {
    color: var(--teal);
  }
  .cons strong {
    color: var(--gold);
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
