<script lang="ts">
  import { onMount, tick } from "svelte";
  import Player from "./Player.svelte";
  import ControlsPanel from "./ControlsPanel.svelte";
  import DiagnosticLab from "./DiagnosticLab.svelte";
  import ContinueCard from "./ContinueCard.svelte";
  import Library from "./Library.svelte";
  import { demo, type GameSource } from "./game-source.ts";
  import {
    listGames,
    readRemember,
    type LibraryEntry,
  } from "../../../packages/storage/src/library.ts";
  import { applyUpdate, install, pwa, startPwa } from "./pwa.svelte.ts";
  import { icons } from "./icons.ts";
  import {
    acceptFor,
    availableSystems,
    system as findSystem,
    systemForFile,
    type SystemInfo,
  } from "../../../packages/runtime/src/systems.ts";
  import "./theme.css";
  let controlsPage = $state(false);
  const consoles = availableSystems();
  // `id` remounts the player when a ROM replaces the current one.
  let game = $state.raw<{ source: GameSource; system: SystemInfo; id: number }>();
  let nextGameId = 0;
  const startGame = (system: SystemInfo, source: GameSource = demo) => {
    openError = "";
    game = { source, system, id: ++nextGameId };
  };
  // Local library: remembered games, most recent first.
  let games = $state.raw<LibraryEntry[]>([]);
  let showLibrary = $state(false);
  async function refreshLibrary() {
    try {
      games = await listGames();
    } catch {
      games = [];
    }
    showLibrary = games.length > 0 || readRemember() !== undefined;
  }
  const latest = $derived.by(() => {
    for (const entry of games) {
      const system = findSystem(entry.system);
      if (system) return { entry, system };
    }
    return undefined;
  });
  let fileInput = $state.raw<HTMLInputElement>();
  /** System whose card opened the file picker. */
  let pickerSystem = $state.raw<SystemInfo>(consoles[0]);
  /** A file opened from the OS while another game was running. */
  let pending = $state.raw<{ file: File; system: SystemInfo }>();
  let openError = $state("");
  let dragging = $state(false);
  /** Picks the system by extension; a card choice wins for its own picker. */
  function openFile(file: File, preferred?: SystemInfo) {
    const system = preferred ?? systemForFile(file.name);
    if (!system) {
      openError = `No se reconoce «${file.name}». Formatos admitidos: ${acceptFor(consoles)}.`;
      return;
    }
    // One active game: never replace a running session without the player
    // closing it first (its SRAM flush is confirmed on close).
    if (game) pending = { file, system };
    else {
      pending = undefined;
      startGame(system, { kind: "file", file });
    }
  }
  function pick(system: SystemInfo) {
    pickerSystem = system;
    if (!fileInput) return;
    fileInput.accept = acceptFor([system]);
    fileInput.click();
  }
  function chooseGame(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (file) openFile(file, pickerSystem);
  }
  const hasFiles = (e: DragEvent) =>
    !!e.dataTransfer && [...e.dataTransfer.types].includes("Files");
  // Window-level so a dropped file never makes the browser navigate away
  // from the app (which would end an active session without its flush).
  function dragOver(e: DragEvent) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragging = !game && !controlsPage;
  }
  function drop(e: DragEvent) {
    dragging = false;
    if (!hasFiles(e)) return;
    e.preventDefault();
    const file = e.dataTransfer?.files[0];
    if (file && !controlsPage) openFile(file);
  }
  let pageHeading = $state.raw<HTMLHeadingElement>();
  async function showPage() {
    controlsPage = location.hash === "#controles";
    await tick();
    pageHeading?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }
  /** The logo returns to the start without reloading (a running game stays). */
  function goHome(event: MouseEvent) {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0)
      return;
    event.preventDefault();
    if (location.pathname !== "/" || location.hash)
      history.pushState(null, "", "/");
    void showPage();
  }
  type LaunchParams = { files: readonly FileSystemFileHandle[] };
  type LaunchQueue = {
    setConsumer: (consumer: (params: LaunchParams) => void) => void;
  };
  onMount(() => {
    startPwa();
    void refreshLibrary();
    // "Open with Cartivo" from the operating system (installed PWA).
    const queue = (window as Window & { launchQueue?: LaunchQueue })
      .launchQueue;
    queue?.setConsumer(async ({ files }) => {
      const handle = files[0];
      if (handle) openFile(await handle.getFile());
    });
    void showPage();
    const sync = () => void showPage();
    window.addEventListener("hashchange", sync);
    window.addEventListener("popstate", sync);
    return () => {
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("popstate", sync);
    };
  });
</script>

<svelte:window
  ondragover={dragOver}
  ondragleave={(e) => {
    if (!e.relatedTarget) dragging = false;
  }}
  ondrop={drop}
/>
<svelte:head
  ><meta
    name="description"
    content="Tu colección retro, sin complicaciones."
  /></svelte:head
>
<main>
  <header>
    <a class="brand" href="/" onclick={goHome} aria-label="Cartivo, inicio"
      >cartivo<span class="palette" aria-hidden="true"
        ><i></i><i></i><i></i><i></i></span
      ></a
    >
    <nav aria-label="Principal">
      {#if pwa.canInstall && !pwa.installed}
        <button class="install" onclick={() => void install()}
          >Instalar app</button
        >
      {/if}
      <a
        class="icon-button settings-link"
        href="#controles"
        aria-current={controlsPage ? "page" : undefined}
        >{@html icons.gear}<span>Ajustes</span></a
      >
    </nav>
  </header>
  {#if controlsPage}
    <section class="controls-page">
      <div class="page-head">
        <a
          class="back icon-button"
          href="#inicio"
          aria-label={game ? "Volver al juego" : "Volver al inicio"}
          title={game ? "Volver al juego" : "Volver al inicio"}
          >{@html icons.back}</a
        >
        <div class="titles">
          <p class="kicker">Mando y teclado</p>
          <h1 bind:this={pageHeading} tabindex="-1">Configurar controles</h1>
        </div>
      </div>
      <ControlsPanel />
      <DiagnosticLab />
    </section>
  {:else if !game}
    <section class="welcome">
      <div class="titles">
        <p class="kicker">Tus consolas. Tu momento.</p>
        <h1 id="inicio" bind:this={pageHeading} tabindex="-1">
          Elige una consola
        </h1>
      </div>
      {#if pwa.updateReady}
        <div class="update" role="status">
          Nueva versión de Cartivo lista.
          <button onclick={applyUpdate}>Actualizar ahora</button>
        </div>
      {/if}
      {#if openError}<p class="open-error" role="alert">{openError}</p>{/if}
      {#if latest}
        <ContinueCard
          entry={latest.entry}
          system={latest.system}
          oncontinue={() =>
            latest &&
            startGame(latest.system, {
              kind: "library",
              entry: latest.entry,
              resume: true,
            })}
        />
      {/if}
      <ul class="consoles" aria-label="Consolas">
        {#each consoles as item (item.id)}
          {@const waiting = pending?.system.id === item.id ? pending : undefined}
          <li>
            <article
              class="console-card card"
              class:dragging
              aria-labelledby={`console-${item.id}`}
            >
              <div class="console-art" aria-hidden="true">
                {#each Array(48) as _}<i></i>{/each}
              </div>
              <div class="console-text">
                <h2 id={`console-${item.id}`}>{item.name}</h2>
                <p>{item.longName}</p>
              </div>
              <div class="console-actions">
                {#if waiting}
                  <button
                    class="primary icon-button play"
                    onclick={() => openFile(waiting.file, waiting.system)}
                    >{@html icons.play}<span>Jugar {waiting.file.name}</span
                    ></button
                  >
                {:else}
                  <button
                    class="primary icon-button play"
                    onclick={() => pick(item)}
                    >{@html icons.play}<span>Jugar</span></button
                  >
                {/if}
                <a
                  class="icon-button square"
                  href="#controles"
                  aria-label={`Controles de ${item.name}`}
                  title={`Controles de ${item.name}`}>{@html icons.sliders}</a
                >
              </div>
              <div class="console-foot">
                {#if waiting}<button class="link" onclick={() => pick(item)}
                    >Elegir otro juego</button
                  >{/if}
                {#if item.demo}<button
                    class="link"
                    onclick={() => startGame(item)}>Probar demo</button
                  >{/if}
                <span class="drop-hint"
                  >o arrastra un archivo {item.extensions.join(", ")}</span
                >
              </div>
            </article>
          </li>
        {/each}
      </ul>
      <input
        bind:this={fileInput}
        type="file"
        accept={acceptFor(consoles)}
        onchange={chooseGame}
        hidden
      />
      {#if showLibrary}
        <Library
          {games}
          onplay={(entry, system) =>
            startGame(system, { kind: "library", entry, resume: false })}
          onchange={refreshLibrary}
        />
      {/if}
    </section>
  {/if}
  {#if game}<div hidden={controlsPage}>
      {#key game.id}
        <Player
          system={game.system}
          source={game.source}
          visible={!controlsPage}
          autostart
          onclose={() => {
            game = undefined;
            void refreshLibrary();
          }}
          onreplace={(file: File) => {
            pending = undefined;
            const current = game!.system;
            startGame(systemForFile(file.name) ?? current, {
              kind: "file",
              file,
            });
          }}
        />
      {/key}
    </div>{/if}
</main>

<style>
  main {
    max-width: 1180px;
    margin: auto;
    padding: 32px 40px 48px;
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 20px;
    flex-wrap: wrap;
  }
  nav {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
  }
  .settings-link {
    color: var(--text);
    text-decoration: none;
    padding: 10px 4px;
    min-height: 44px;
  }
  .settings-link[aria-current="page"] {
    color: var(--teal);
  }
  .brand {
    color: var(--text);
    text-decoration: none;
    border-radius: 8px;
    font-size: 30px;
    font-weight: 760;
    letter-spacing: -1px;
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .palette {
    display: flex;
    gap: 4px;
  }
  .palette i {
    width: 6px;
    height: 20px;
    border-radius: 3px;
    background: var(--coral);
  }
  .palette i:nth-child(2) {
    background: var(--blue);
  }
  .palette i:nth-child(3) {
    background: var(--teal);
  }
  .palette i:nth-child(4) {
    background: var(--gold);
  }
  .titles {
    text-align: center;
  }
  h1 {
    font-size: clamp(38px, 6vw, 68px);
    font-weight: 780;
    letter-spacing: -0.035em;
    line-height: 1.05;
    margin: 14px 0 0;
  }
  h1:focus {
    outline: none;
  }
  .welcome {
    padding: 56px 0 24px;
  }
  .consoles {
    list-style: none;
    padding: 0;
    margin: 48px 0 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 236px), 1fr));
    gap: 20px;
  }
  /* Each card spans three rows of a shared subgrid (text, actions, foot), so
     a longer title or extension list in one card moves the whole row and the
     «Jugar» buttons stay aligned. */
  .consoles > li {
    display: grid;
    grid-row: span 3;
    grid-template-rows: subgrid;
    row-gap: 18px;
  }
  .console-card {
    position: relative;
    overflow: hidden;
    min-width: 0;
    grid-row: 1 / -1;
    padding: 22px;
    display: grid;
    grid-template-rows: subgrid;
    row-gap: 18px;
    box-shadow: var(--glow);
  }
  .console-card.dragging {
    outline: 2px dashed var(--teal);
    outline-offset: -10px;
  }
  /* Original abstract art: a cartridge-label pixel field in Cartivo colours. */
  .console-art {
    position: absolute;
    inset: -18px -28px auto auto;
    width: 150px;
    /* Fade towards the text so labels and buttons stay legible. */
    mask-image: linear-gradient(225deg, #000 30%, transparent 78%);
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    gap: 5px;
    transform: rotate(-12deg);
    opacity: 0.7;
    pointer-events: none;
  }
  .console-art i {
    aspect-ratio: 1;
    border-radius: 3px;
    background: #262a39;
  }
  .console-art i:nth-child(7n + 1) {
    background: var(--coral);
  }
  .console-art i:nth-child(11n + 4) {
    background: var(--blue);
  }
  .console-art i:nth-child(13n + 6) {
    background: var(--teal);
  }
  .console-art i:nth-child(17n + 3) {
    background: var(--gold);
  }
  .console-text {
    position: relative;
    /* Keeps the original card height (248 px) when titles are short. */
    min-height: 88px;
  }
  .console-text h2 {
    margin: 0;
    font-size: 34px;
    font-weight: 800;
    letter-spacing: -0.04em;
    line-height: 1.05;
    text-wrap: balance;
    max-width: 9ch;
  }
  .console-text p {
    margin: 8px 0 0;
    color: var(--muted);
    font-size: 14px;
    max-width: 22ch;
    line-height: 1.35;
  }
  .console-actions {
    position: relative;
    margin-top: auto;
    display: flex;
    gap: 12px;
    align-items: center;
  }
  .play {
    flex: 1;
    min-width: 0;
    font-size: 17px;
  }
  .play span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .square {
    width: 52px;
    height: 48px;
    flex: none;
    border-radius: 12px;
    border: 1px solid var(--border);
    background: #11131bcc;
    color: var(--text);
  }
  .console-foot {
    position: relative;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 14px;
  }
  .link {
    background: transparent;
    border: 0;
    padding: 6px 0;
    min-height: 32px;
    color: var(--blue);
    font-size: 14px;
  }
  .open-error {
    margin: 24px auto 0;
    max-width: 640px;
    padding: 12px 16px;
    border: 1px solid var(--coral);
    border-radius: 10px;
    background: #34202a;
    text-align: center;
  }
  .drop-hint {
    font-size: 13px;
    color: var(--muted);
  }
  .update {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 14px;
    flex-wrap: wrap;
    margin: 28px 0 0;
    color: var(--muted);
    font-size: 14px;
  }
  .update button,
  .install {
    min-height: 36px;
    padding: 6px 14px;
    font-size: 14px;
  }
  .install {
    border-color: var(--teal);
    color: var(--teal);
    background: transparent;
  }
  .controls-page {
    padding: 40px 0 24px;
  }
  .page-head {
    display: grid;
    grid-template-columns: 56px 1fr 56px;
    align-items: start;
    gap: 12px;
    margin-bottom: 40px;
  }
  .back {
    width: 56px;
    height: 48px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: #151720cc;
    color: var(--text);
  }
  @media (prefers-reduced-motion: no-preference) {
    .welcome,
    .controls-page {
      animation: view-enter 180ms ease-out both;
    }
  }
  @keyframes view-enter {
    from {
      opacity: 0;
      transform: translateY(5px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  @media (max-width: 640px) {
    main {
      padding: 20px 16px 32px;
    }
    .welcome {
      padding-top: 32px;
    }
    .page-head {
      grid-template-columns: 48px 1fr;
    }
    .back {
      width: 48px;
    }
    .consoles {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
