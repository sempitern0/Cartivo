<script lang="ts">
  import SnapshotThumb from "./SnapshotThumb.svelte";
  import { when } from "./saves.ts";
  import { icons } from "./icons.ts";
  import { tick } from "svelte";
  import { playLabel, type GameCard } from "./library-view.ts";
  import { profiles } from "./profile.svelte.ts";
  import { eraseProgress } from "../../../packages/storage/src/progress.ts";
  import {
    deleteTitle,
    rememberGames,
    setHidden,
    viewGames,
    writeRemember,
    type GameSort,
  } from "../../../packages/storage/src/library.ts";
  import {
    availableSystems,
    system as findSystem,
    type SystemInfo,
  } from "../../../packages/runtime/src/systems.ts";
  // «Tus juegos» (#juegos, ADR-012/018): the device's shared titles with
  // search, console filter and order, the remember switch and the space they
  // use. «Opciones» separates three scopes: hide it for me, erase my
  // progress, delete it from the device (every profile; Partidas stay).
  let {
    games,
    loading = false,
    oncontinue,
    onchange,
    query = $bindable(""),
    systemFilter = $bindable(""),
    sort = $bindable<GameSort>("recent"),
  }: {
    games: GameCard[];
    loading?: boolean;
    oncontinue: (entry: GameCard, system: SystemInfo) => void;
    /** The list changed on disk; the parent reloads it. */
    onchange: () => void | Promise<void>;
    query?: string;
    systemFilter?: string;
    sort?: GameSort;
  } = $props();
  let remember = $state(rememberGames());
  let note = $state("");
  /** The two irreversible actions ask first, in place. */
  type Risky = "erase" | "delete";
  let confirming = $state<{ hash: string; action: Risky }>();
  let managing = $state<string>();
  let libraryElement: HTMLElement;
  async function ask(hash: string, action: Risky) {
    confirming = { hash, action };
    await tick();
    document.getElementById(`confirm-${hash}`)?.focus();
  }
  async function cancel(hash: string) {
    confirming = undefined;
    await tick();
    document.getElementById(`manage-${hash}`)?.focus();
  }
  /** Titles this profile hid; they stay for everyone else. */
  const listed = $derived(games.filter((g) => !g.hidden));
  const hidden = $derived(games.filter((g) => g.hidden));
  /** Consoles that have at least one game, in the order of systems.ts. */
  const consoles = $derived.by(() => {
    const present = new Set(listed.map((g) => g.system));
    return availableSystems().filter((s) => present.has(s.id));
  });
  $effect(() => {
    if (!loading && systemFilter && !listed.some((game) => game.system === systemFilter))
      systemFilter = "";
  });
  const shown = $derived(viewGames(listed, { query, system: systemFilter, sort }));
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
  /** Runs one option, reports it and reloads the list. */
  async function act(
    entry: GameCard,
    work: () => Promise<unknown>,
    done: string,
    failed: string,
  ) {
    confirming = undefined;
    managing = undefined;
    try {
      await work();
      note = done;
    } catch (error) {
      note = error instanceof Error && error.message.includes("pestaña")
        ? error.message
        : failed;
    }
    await onchange();
    await tick();
    (libraryElement.querySelector<HTMLInputElement>('input[type="search"]') ?? libraryElement).focus();
  }
  const hide = (entry: GameCard, value: boolean) =>
    act(
      entry,
      () => setHidden(entry, value, profiles.id),
      value
        ? `${entry.name} ya no aparece para ti. Los demás perfiles lo siguen viendo; lo tienes en «Ocultos».`
        : `${entry.name} vuelve a tu lista.`,
      "No se pudo cambiar la lista. Inténtalo de nuevo.",
    );
  const erase = (entry: GameCard) =>
    act(
      entry,
      () => eraseProgress(entry.system, entry.hash, profiles.id),
      `Tus partidas y tu guardado de ${entry.name} se han borrado.`,
      "No se pudo borrar tu progreso. Inténtalo de nuevo.",
    );
  const remove = (entry: GameCard) =>
    act(
      entry,
      () => deleteTitle(entry.hash),
      `${entry.name} se ha eliminado del dispositivo. Las partidas se conservan.`,
      "No se pudo eliminar el juego. Inténtalo de nuevo.",
    );
</script>

<section bind:this={libraryElement} class="library" aria-label="Tus juegos" tabindex="-1">
  <p class="hint">Biblioteca compartida con todos los perfiles de este dispositivo. Partidas y recientes propios para cada perfil.</p>
  {#if listed.length}
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
                >{system?.name ?? entry.system} · {entry.lastPlayedAt ? when(entry.lastPlayedAt) : "Aún no has jugado"} · {megabytes(
                  entry.size,
                )}</span
              >
            </div>
            {#if entry.stateUnavailable}<p class="hint">Guardado de otra versión. Revisa Partidas antes de sobrescribirlo.</p>{/if}
            <div class="actions">
              {#if confirming?.hash === entry.hash}
                <span class="hint"
                  >{confirming.action === "delete"
                    ? "Se eliminará para todos los perfiles y se liberará su espacio. Las partidas se conservan."
                    : "Se borrarán tus partidas y tu guardado de este juego. No se puede deshacer."}</span
                >
                <button
                  id={`confirm-${entry.hash}`}
                  class="danger"
                  onclick={() =>
                    confirming?.action === "delete" ? remove(entry) : erase(entry)}
                  >{confirming.action === "delete"
                    ? `Eliminar ${entry.name}`
                    : `Borrar mi progreso en ${entry.name}`}</button
                ><button onclick={() => cancel(entry.hash)}>Cancelar</button>
              {:else}
                <button
                  class="primary"
                  disabled={!system}
                  aria-label={`${playLabel(entry)} ${entry.name}`}
                  data-launch={`continue-${entry.hash}`}
                  onclick={() => system && oncontinue(entry, system)}
                  >{playLabel(entry)}</button
                ><button
                  id={`manage-${entry.hash}`}
                  aria-label={`Opciones de ${entry.name}`}
                  aria-expanded={managing === entry.hash}
                  aria-controls={`options-${entry.hash}`}
                  onclick={() =>
                    (managing = managing === entry.hash ? undefined : entry.hash)}
                  >Opciones</button
                >
                <div
                  id={`options-${entry.hash}`}
                  class="options"
                  hidden={managing !== entry.hash}
                >
                  <button onclick={() => hide(entry, true)}>Ocultar para mí</button
                  ><button onclick={() => ask(entry.hash, "erase")}
                    >Borrar mi progreso</button
                  ><button
                    class="danger"
                    onclick={() => ask(entry.hash, "delete")}
                    >Eliminar del dispositivo</button
                  >
                </div>
              {/if}
            </div>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="hint empty" role="status">Ningún juego coincide.</p>
    {/if}
    <p class="hint">{usage}</p>
  {:else if loading}
    <p class="hint empty" role="status">Cargando tus juegos…</p>
  {:else if hidden.length}
    <p class="hint empty">Has ocultado todos los juegos de este dispositivo.</p>
  {:else}
    <p class="hint empty">
      Aún no hay juegos. Elige una consola y carga una ROM para empezar.
      <a href="#inicio">Elegir consola</a>
    </p>
  {/if}
  {#if hidden.length}
    <details class="hidden-games">
      <summary>Ocultos para ti ({hidden.length})</summary>
      <ul class="plain">
        {#each hidden as entry (entry.hash)}
          <li>
            <span>{entry.name}</span><button
              aria-label={`Mostrar ${entry.name}`}
              onclick={() => hide(entry, false)}>Mostrar</button
            >
          </li>
        {/each}
      </ul>
    </details>
  {/if}
  <label class="toggle"
    ><input type="checkbox" checked={remember} onchange={toggle} />
    Recordar juegos nuevos en este dispositivo</label
  >
  <p class="hint">
    Se guarda una copia del archivo solo en este navegador; nunca se envía a
    ningún sitio. Los discos se copian mientras juegas, si caben. El navegador puede borrarla si se queda sin espacio.
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
    min-height: 44px;
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
    grid-template-columns: repeat(auto-fill, minmax(min(280px, 100%), 1fr));
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
    min-height: 44px;
    padding: 8px 14px;
    font-size: 14px;
  }
  .options {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    flex-basis: 100%;
  }
  .hidden-games {
    margin: 20px 0 8px;
    color: var(--muted);
  }
  .hidden-games summary {
    min-height: 44px;
    display: flex;
    align-items: center;
    cursor: pointer;
  }
  .plain {
    display: grid;
    gap: 8px;
    grid-template-columns: none;
  }
  .plain li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .plain button {
    min-height: 44px;
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
