<script lang="ts">
  import SnapshotThumb from "./SnapshotThumb.svelte";
  import { when } from "./saves.ts";
  import { icons } from "./icons.ts";
  import {
    forgetGame,
    rememberGames,
    viewGames,
    writeRemember,
    type GameSort,
    type LibraryEntry,
  } from "../../../packages/storage/src/library.ts";
  import {
    availableSystems,
    system as findSystem,
    type SystemInfo,
  } from "../../../packages/runtime/src/systems.ts";
  // «Tus juegos» (#juegos, ADR-012): every remembered game with search,
  // console filter and order, the remember switch and the space they use.
  // Removing a game never touches its Partidas or SRAM.
  let {
    games,
    oncontinue,
    onchange,
  }: {
    games: LibraryEntry[];
    oncontinue: (entry: LibraryEntry, system: SystemInfo) => void;
    /** The list changed on disk; the parent reloads it. */
    onchange: () => void;
  } = $props();
  let query = $state("");
  let systemFilter = $state("");
  let sort = $state<GameSort>("recent");
  let remember = $state(rememberGames());
  let note = $state("");
  let confirming = $state<string>();
  /** Consoles that have at least one game, in the order of systems.ts. */
  const consoles = $derived.by(() => {
    const present = new Set(games.map((g) => g.system));
    return availableSystems().filter((s) => present.has(s.id));
  });
  const shown = $derived(viewGames(games, { query, system: systemFilter, sort }));
  const megabytes = (bytes: number) =>
    `${(bytes / (1024 * 1024)).toLocaleString("es", { maximumFractionDigits: 1 })} MB`;
  // The browser's own estimate, refreshed whenever the list changes.
  let estimate = $state.raw<{ used: number; quota: number }>();
  $effect(() => {
    void games;
    void navigator.storage
      ?.estimate?.()
      .then(({ usage: used, quota }) => {
        estimate = used !== undefined && quota ? { used, quota } : undefined;
      })
      .catch(() => {});
  });
  const usage = $derived(
    `Ocupan ${megabytes(games.reduce((sum, g) => sum + g.size, 0))}.` +
      (estimate
        ? ` Cartivo usa ${megabytes(estimate.used)} de ${megabytes(estimate.quota)} disponibles en este navegador.`
        : ""),
  );
  function toggle(event: Event) {
    remember = (event.target as HTMLInputElement).checked;
    note = writeRemember(remember)
      ? remember
        ? "Los juegos que abras se recordarán en este dispositivo."
        : "Los juegos nuevos no se recordarán. Los de la lista siguen aquí."
      : "El navegador no permite guardar esta preferencia.";
  }
  async function remove(entry: LibraryEntry) {
    confirming = undefined;
    try {
      await forgetGame(entry.hash);
      note = `${entry.name} ya no está en la lista. Sus partidas se conservan.`;
    } catch {
      note = "No se pudo quitar el juego. Inténtalo de nuevo.";
    }
    onchange();
  }
</script>

<section class="library" aria-label="Tus juegos">
  {#if games.length}
    <div class="filters">
      <label class="search"
        >{@html icons.search}<input
          type="search"
          placeholder="Buscar por nombre"
          aria-label="Buscar por nombre"
          bind:value={query}
        /></label
      >
      <label class="sort"
        >Orden <select bind:value={sort}
          ><option value="recent">Recientes</option><option value="name"
            >Nombre</option
          ></select
        ></label
      >
      {#if consoles.length > 1}
        <div class="chips" role="group" aria-label="Consola">
          <button aria-pressed={systemFilter === ""}
            onclick={() => (systemFilter = "")}
            >Todas</button
          >{#each consoles as system (system.id)}<button
              aria-pressed={systemFilter === system.id}
              onclick={() => (systemFilter = system.id)}>{system.name}</button
            >{/each}
        </div>
      {/if}
    </div>
    {#if shown.length}
      <ul>
        {#each shown as entry (entry.hash)}
          {@const system = findSystem(entry.system)}
          <li class="card" data-game={entry.hash}>
            <div class="thumb"><SnapshotThumb pixels={entry.preview} fill /></div>
            <div class="info">
              <span class="name">{entry.name}</span>
              <span class="hint"
                >{system?.name ?? entry.system} · {when(entry.lastPlayedAt)} · {megabytes(
                  entry.size,
                )}</span
              >
            </div>
            <div class="actions">
              {#if confirming === entry.hash}
                <span class="hint">Sus partidas se conservan.</span>
                <button class="danger" onclick={() => remove(entry)}
                  >Quitar {entry.name}</button
                ><button onclick={() => (confirming = undefined)}
                  >Cancelar</button
                >
              {:else}
                <button
                  class="primary"
                  disabled={!system}
                  aria-label={`Continuar ${entry.name}`}
                  onclick={() => system && oncontinue(entry, system)}
                  >Continuar</button
                ><button
                  aria-label={`Quitar ${entry.name} de la lista`}
                  onclick={() => (confirming = entry.hash)}>Quitar</button
                >
              {/if}
            </div>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="hint empty" role="status">Ningún juego coincide.</p>
    {/if}
    <p class="hint">{usage}</p>
  {:else}
    <p class="hint empty">
      Aún no hay juegos. Los que abras desde el inicio aparecerán aquí para
      continuar con un clic.
    </p>
  {/if}
  <label class="toggle"
    ><input type="checkbox" checked={remember} onchange={toggle} />
    Recordar juegos nuevos en este dispositivo</label
  >
  <p class="hint">
    Se guarda una copia del archivo solo en este navegador; nunca se envía a
    ningún sitio. El navegador puede borrarla si se queda sin espacio.
  </p>
  {#if note}<p class="note" role="status">{note}</p>{/if}
</section>

<style>
  .library {
    max-width: 960px;
    margin: 0 auto;
  }
  .filters {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;
    margin-bottom: 18px;
  }
  .search {
    flex: 1 1 260px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 14px;
    min-height: 44px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--surface-2);
    color: var(--muted);
  }
  .search:focus-within {
    outline: 2px solid var(--focus);
    outline-offset: 3px;
  }
  .search input {
    flex: 1;
    min-width: 0;
    border: 0;
    background: transparent;
    color: var(--text);
    font: inherit;
    outline: none;
  }
  .sort {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--muted);
  }
  select {
    min-height: 44px;
    padding: 0 12px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--surface);
    color: var(--text);
    font: inherit;
  }
  .chips {
    flex-basis: 100%;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .chips button {
    min-height: 36px;
    padding: 6px 14px;
    border-radius: 999px;
    font-size: 14px;
  }
  .chips button[aria-pressed="true"] {
    border-color: var(--teal);
    color: var(--teal);
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 14px;
  }
  li {
    display: grid;
    grid-template-rows: auto 1fr auto;
    gap: 12px;
    padding: 14px;
  }
  .info {
    min-width: 0;
    display: grid;
    gap: 2px;
    align-content: start;
  }
  .name {
    font-weight: 650;
    overflow-wrap: anywhere;
  }
  .hint {
    font-size: 13px;
    color: var(--muted);
    line-height: 1.4;
  }
  .empty {
    font-size: 15px;
  }
  .actions {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }
  .actions button {
    min-height: 40px;
    padding: 8px 14px;
    font-size: 14px;
  }
  .danger {
    border-color: var(--coral);
    color: var(--coral);
  }
  .toggle {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 44px;
    margin-top: 24px;
  }
  .toggle input {
    width: 20px;
    height: 20px;
  }
  .note {
    color: var(--teal);
    font-size: 14px;
  }
</style>
