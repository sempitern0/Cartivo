<script lang="ts">
  // «Partidas» slots (ADR-009). Shows metadata and previews and reports
  // intents; the player performs saves and loads through the worker.
  import { onMount } from "svelte";
  import { icons } from "./icons.ts";
  import SnapshotThumb from "./SnapshotThumb.svelte";
  import { allSlots, slotNames, when } from "./saves.ts";
  import { coreLabel } from "../../../packages/runtime/src/systems.ts";
  import type {
    StateMeta,
    StateSlot,
  } from "../../../packages/storage/src/states.ts";
  let {
    saves,
    systemId,
    battery,
    onsave,
    onload,
    ondelete,
    onclose,
  }: {
    saves: StateMeta[];
    systemId: string;
    battery: boolean;
    onsave: (slot: StateSlot) => void;
    onload: (slot: StateSlot) => void;
    ondelete: (slot: StateSlot) => void;
    onclose: () => void;
  } = $props();
  let panel = $state.raw<HTMLElement>();
  /** Loading replaces unsaved progress, so it takes a second click. */
  let confirmLoad = $state<StateSlot>();
  const slotOf = (slot: StateSlot) => saves.find((s) => s.slot === slot);
  onMount(() => {
    panel?.querySelector<HTMLButtonElement>("button")?.focus({
      preventScroll: true,
    });
  });
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<section
  id="saves-panel"
  class="panel saves card"
  data-player-chrome
  aria-labelledby="saves-title"
  bind:this={panel}
  onkeydown={(e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onclose();
    }
  }}
>
  <header>
    <h2 id="saves-title">Partidas</h2>
    <p>
      Guarda el momento exacto del juego. F5 guarda en la ranura 1 y F9 la
      carga.{battery
        ? " La partida interna del cartucho se guarda aparte, automáticamente."
        : ""}
    </p>
    <button
      class="close icon-button"
      aria-label="Cerrar partidas"
      onclick={onclose}>{@html icons.close}</button
    >
  </header>
  <ul class="slots">
    {#each allSlots as slot (slot)}
      {@const meta = slotOf(slot)}
      <li class="slot" data-slot={slot}>
        <SnapshotThumb pixels={meta?.preview} fill />
        <div class="slot-info">
          <span class="name">{slotNames[slot]}</span>
          <span class="hint"
            >{meta
              ? `${when(meta.createdAt)} · ${coreLabel(systemId, meta.core)}`
              : slot === "auto"
                ? "Se guarda al salir del juego"
                : "Vacía"}</span
          >
        </div>
        <div class="slot-actions">
          {#if slot !== "auto"}<button
              onclick={() => onsave(slot)}
              aria-label={`Guardar en ${slotNames[slot]}`}>Guardar aquí</button
            >{/if}
          {#if meta}
            {#if confirmLoad === slot}<button
                class="primary"
                onclick={() => {
                  confirmLoad = undefined;
                  onload(slot);
                }}
                aria-label={`Confirmar carga de ${slotNames[slot]}`}
                >Confirmar carga</button
              >{:else}<button
                onclick={() => (confirmLoad = slot)}
                aria-label={`Cargar ${slotNames[slot]}`}>Cargar</button
              >{/if}
            <button
              class="link-danger"
              onclick={() => ondelete(slot)}
              aria-label={`Borrar ${slotNames[slot]}`}>Borrar</button
            >
          {/if}
        </div>
      </li>
    {/each}
  </ul>
  {#if confirmLoad}<p class="hint" role="status">
      Cargar sustituye el progreso actual que no hayas guardado.
    </p>{/if}
</section>

<style>
  .slots {
    list-style: none;
    padding: 0;
    margin: 16px 0 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 220px), 1fr));
    gap: 12px;
  }
  .slot {
    display: grid;
    gap: 10px;
    padding: 12px;
    border-radius: 14px;
    border: 1px solid var(--border);
    background: var(--surface-2);
  }
  .slot-info {
    display: grid;
    gap: 2px;
  }
  .slot-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .slot-actions button {
    min-height: 38px;
    padding: 6px 12px;
    font-size: 14px;
  }
  .link-danger {
    background: transparent;
    border-color: transparent;
    color: var(--coral);
  }
</style>
