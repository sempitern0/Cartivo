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
  const focus = async (id: string) => {
    await tick();
    document.getElementById(id)?.focus();
  };
  function open(hash: string) {
    confirming = undefined;
    managing = hash;
    void focus(`options-${hash}`);
  }
  function close(hash: string) {
    confirming = undefined;
    managing = undefined;
    void focus(`manage-${hash}`);
  }
  /** Escape (or the pad's back button) closes the options it reaches. */
  function closesOnEscape(sheet: HTMLElement, hash: string) {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      close(hash);
    };
    sheet.addEventListener("keydown", onKey);
    return { destroy: () => sheet.removeEventListener("keydown", onKey) };
  }
  function ask(hash: string, action: Risky) {
    confirming = { hash, action };
    void focus(`confirm-${hash}`);
  }
  function cancel(hash: string) {
    confirming = undefined;
    void focus(`options-${hash}`);
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
  // Only the copies' own size: the browser's quota is not shown, because
  // some browsers mask it (Brave reports 2 GB) and it read as a limit on the
  // ROMs a player can open from their disk.
  const usage = $derived(
    `Las copias recordadas ocupan ${megabytes(games.reduce((sum, g) => sum + g.size, 0))} en este navegador.`,
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
      // Storage refusals are written for the player (a game open in another
      // tab); browser errors are not.
      note =
        error instanceof Error && !(error instanceof DOMException)
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
              <button
                class="primary icon-button play"
                disabled={!system}
                aria-label={`${playLabel(entry)} ${entry.name}`}
                data-launch={`continue-${entry.hash}`}
                onclick={() => system && oncontinue(entry, system)}
                >{@html icons.play}{playLabel(entry)}</button
              ><button
                id={`manage-${entry.hash}`}
                class="icon-button more"
                aria-label={`Opciones de ${entry.name}`}
                aria-expanded={managing === entry.hash}
                aria-controls={`options-${entry.hash}`}
                onclick={() => (managing === entry.hash ? close(entry.hash) : open(entry.hash))}
                >{@html icons.more}</button
              >
            </div>
            <!-- Options cover the card instead of growing it: one list, then
                 the confirmation of a risky action in the same place. -->
            <div
              id={`options-${entry.hash}`}
              class="sheet"
              role="group"
              aria-label={`Opciones de ${entry.name}`}
              tabindex="-1"
              hidden={managing !== entry.hash}
              use:closesOnEscape={entry.hash}
            >
              <div class="sheet-head">
                <span class="name">{entry.name}</span><button
                  class="icon-button"
                  aria-label="Cerrar opciones"
                  onclick={() => close(entry.hash)}>{@html icons.close}</button
                >
              </div>
              {#if confirming?.hash === entry.hash}
                <p class="hint">
                  {confirming.action === "delete"
                    ? "Se eliminará para todos los perfiles y se liberará su espacio. Las partidas se conservan."
                    : "Se borrarán tus partidas y tu guardado de este juego. No se puede deshacer."}
                </p>
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
                <button class="icon-button row" onclick={() => hide(entry, true)}
                  >{@html icons.hide}Ocultar para mí</button
                ><button
                  class="icon-button row"
                  onclick={() => ask(entry.hash, "erase")}
                  >{@html icons.erase}Borrar mi progreso</button
                ><button
                  class="icon-button row danger"
                  onclick={() => ask(entry.hash, "delete")}
                  >{@html icons.trash}Eliminar del dispositivo</button
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
    Recordar guarda una copia del archivo solo en este navegador, para
    «Continuar» sin buscarlo; nunca se envía a ningún sitio. Los discos se
    copian mientras juegas, si caben. Cualquier ROM de tu disco se puede abrir
    siempre, se recuerde o no; si el navegador borra una copia por falta de
    espacio, basta con volver a abrir el archivo.
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
  .actions .play {
    flex: 1;
  }
  .actions .more {
    width: 44px;
    padding: 0;
  }
  .card {
    position: relative;
  }
  .sheet {
    position: absolute;
    inset: 0;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 14px;
    overflow: auto;
    border-radius: inherit;
    background: color-mix(in srgb, var(--surface) 96%, transparent);
    backdrop-filter: blur(6px);
  }
  .sheet[hidden] {
    display: none;
  }
  .sheet:focus {
    outline: none;
  }
  .sheet-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 4px;
  }
  .sheet-head button {
    width: 44px;
    padding: 0;
    flex: none;
    background: transparent;
    border-color: transparent;
  }
  .sheet button {
    min-height: 44px;
    font-size: 14px;
  }
  .sheet .row {
    justify-content: flex-start;
    background: transparent;
    border-color: transparent;
    text-align: left;
  }
  .sheet .row:hover,
  .sheet .row:focus-visible {
    background: var(--surface-2);
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
