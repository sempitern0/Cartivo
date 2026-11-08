<script lang="ts">
  import { AlertDialog, DropdownMenu } from "bits-ui";
  import { fade, fly, scale } from "svelte/transition";
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
  /**
   * «⋯» opens a menu (Bits UI, ADR-019); the two irreversible actions then
   * ask in a dialog with the risky button focused.
   */
  type Risky = "erase" | "delete";
  let confirming = $state.raw<{ entry: GameCard; action: Risky }>();
  let libraryElement: HTMLElement;
  /** Escape here belongs to the menu or dialog, not to the page's «back». */
  const keepEscape = (event: KeyboardEvent) => event.stopPropagation();
  function ask(entry: GameCard, action: Risky) {
    confirming = { entry, action };
  }
  async function cancel() {
    const hash = confirming?.entry.hash;
    confirming = undefined;
    await tick();
    if (hash) document.getElementById(`manage-${hash}`)?.focus();
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
              >
              <DropdownMenu.Root>
                <DropdownMenu.Trigger
                  id={`manage-${entry.hash}`}
                  class="icon-button more"
                  aria-label={`Opciones de ${entry.name}`}
                  >{@html icons.more}</DropdownMenu.Trigger
                >
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    forceMount
                    align="end"
                    sideOffset={6}
                    onEscapeKeydown={keepEscape}
                    onCloseAutoFocus={(e) => confirming && e.preventDefault()}
                  >
                    {#snippet child({ wrapperProps, props, open })}
                      {#if open}
                        <div {...wrapperProps}>
                          <div
                            {...props}
                            class="game-menu"
                            data-pad-scope
                            transition:fly={{ y: -6, duration: 140 }}
                          >
                            <DropdownMenu.Item
                              class="game-menu-item"
                              onSelect={() => hide(entry, true)}
                              >{@html icons.hide}Ocultar para mí</DropdownMenu.Item
                            >
                            <DropdownMenu.Item
                              class="game-menu-item"
                              onSelect={() => ask(entry, "erase")}
                              >{@html icons.erase}Borrar mi progreso</DropdownMenu.Item
                            >
                            <DropdownMenu.Separator class="game-menu-separator" />
                            <DropdownMenu.Item
                              class="game-menu-item danger"
                              onSelect={() => ask(entry, "delete")}
                              >{@html icons.trash}Eliminar del dispositivo</DropdownMenu.Item
                            >
                          </div>
                        </div>
                      {/if}
                    {/snippet}
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
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

<AlertDialog.Root
  open={!!confirming}
  onOpenChange={(open) => {
    if (!open) void cancel();
  }}
>
  <AlertDialog.Portal>
    <AlertDialog.Overlay forceMount>
      {#snippet child({ props, open })}
        {#if open}<div
            {...props}
            class="dialog-overlay"
            transition:fade={{ duration: 140 }}
          ></div>{/if}
      {/snippet}
    </AlertDialog.Overlay>
    <AlertDialog.Content
      forceMount
      onEscapeKeydown={keepEscape}
      onOpenAutoFocus={(e) => {
        e.preventDefault();
        document.getElementById("confirm-risky")?.focus();
      }}
      onCloseAutoFocus={(e) => e.preventDefault()}
    >
      {#snippet child({ props, open })}
        {#if open && confirming}
          {@const { entry, action } = confirming}
          <div
            {...props}
            class="dialog"
            data-pad-scope
            transition:scale={{ start: 0.96, duration: 160 }}
          >
            <AlertDialog.Title class="dialog-title"
              >{action === "delete"
                ? `¿Eliminar ${entry.name} del dispositivo?`
                : `¿Borrar tu progreso en ${entry.name}?`}</AlertDialog.Title
            >
            <AlertDialog.Description class="dialog-text"
              >{action === "delete"
                ? "Se eliminará para todos los perfiles y se liberará su espacio. Las partidas se conservan."
                : "Se borrarán tus partidas y tu guardado de este juego. No se puede deshacer."}</AlertDialog.Description
            >
            <div class="dialog-actions">
              <AlertDialog.Cancel>Cancelar</AlertDialog.Cancel>
              <AlertDialog.Action
                id="confirm-risky"
                class="danger"
                onclick={() => (action === "delete" ? remove(entry) : erase(entry))}
                >{action === "delete"
                  ? `Eliminar ${entry.name}`
                  : `Borrar mi progreso en ${entry.name}`}</AlertDialog.Action
              >
            </div>
          </div>
        {/if}
      {/snippet}
    </AlertDialog.Content>
  </AlertDialog.Portal>
</AlertDialog.Root>

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
  /* Menu and dialog live in a portal at the end of <body>: global styles. */
  :global(.game-menu) {
    min-width: 230px;
    padding: 6px;
    border-radius: 14px;
    border: 1px solid var(--border);
    background: var(--surface);
    box-shadow: 0 18px 40px #0008;
  }
  :global(.game-menu-item) {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 44px;
    padding: 0 12px;
    border-radius: 10px;
    font-size: 14px;
    cursor: pointer;
    outline: none;
  }
  :global(.game-menu-item[data-highlighted]) {
    background: var(--surface-2);
  }
  :global(.game-menu-item.danger) {
    color: var(--coral);
  }
  :global(.game-menu-separator) {
    height: 1px;
    margin: 6px 4px;
    background: var(--border);
  }
  :global(.dialog-overlay) {
    position: fixed;
    inset: 0;
    z-index: 50;
    background: #0009;
    backdrop-filter: blur(3px);
  }
  :global(.dialog) {
    position: fixed;
    z-index: 51;
    top: 50%;
    left: 50%;
    translate: -50% -50%;
    width: min(440px, calc(100vw - 32px));
    padding: 22px;
    border-radius: var(--card-radius);
    border: 1px solid var(--border);
    background: var(--surface);
    box-shadow: 0 24px 60px #000a;
  }
  :global(.dialog-title) {
    margin: 0 0 8px;
    font-size: 18px;
  }
  :global(.dialog-text) {
    margin: 0;
    color: var(--muted);
    font-size: 14px;
    line-height: 1.5;
  }
  :global(.dialog-actions) {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 20px;
  }
  :global(.dialog .danger) {
    border-color: var(--coral);
    color: var(--coral);
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
