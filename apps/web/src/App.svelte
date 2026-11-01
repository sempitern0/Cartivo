<script lang="ts">
  import { onMount, tick } from "svelte";
  import Player from "./Player.svelte";
  import ControlsPanel from "./ControlsPanel.svelte";
  import DiagnosticLab from "./DiagnosticLab.svelte";
  import { applyUpdate, install, pwa, startPwa } from "./pwa.svelte.ts";
  import "./theme.css";
  let controlsPage = $state(false);
  let game = $state<{ file?: File }>();
  let fileInput = $state.raw<HTMLInputElement>();
  /** A file opened from the OS while another game was running. */
  let pendingFile = $state.raw<File>();
  let dragging = $state(false);
  function openFile(file: File) {
    // One active game: never replace a running session without the player
    // closing it first (its SRAM flush is confirmed on close).
    if (game) pendingFile = file;
    else {
      pendingFile = undefined;
      game = { file };
    }
  }
  function chooseGame(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (file) openFile(file);
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
  type LaunchParams = { files: readonly FileSystemFileHandle[] };
  type LaunchQueue = {
    setConsumer: (consumer: (params: LaunchParams) => void) => void;
  };
  onMount(() => {
    startPwa();
    // "Open with Cartivo" from the operating system (installed PWA).
    const queue = (window as Window & { launchQueue?: LaunchQueue })
      .launchQueue;
    queue?.setConsumer(async ({ files }) => {
      const handle = files[0];
      if (handle) openFile(await handle.getFile());
    });
    const sync = async () => {
      controlsPage = location.hash === "#controles";
      await tick();
      pageHeading?.focus({ preventScroll: true });
      window.scrollTo(0, 0);
    };
    void sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
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
    <span class="brand"
      >cartivo<span class="palette" aria-hidden="true"
        ><i></i><i></i><i></i><i></i></span
      ></span
    >
    <nav aria-label="Principal">
      {#if pwa.canInstall && !pwa.installed}
        <button class="install" onclick={() => void install()}
          >Instalar app</button
        >
      {/if}
      <a href="#controles" aria-current={controlsPage ? "page" : undefined}
        >Ajustes</a
      >
    </nav>
  </header>
  {#if controlsPage}
    <section class="controls-page">
      <a class="back" href="#inicio"
        >← {game ? "Volver al juego" : "Volver al inicio"}</a
      >
      <h1 bind:this={pageHeading} tabindex="-1">Controles</h1>
      <ControlsPanel />
      <DiagnosticLab />
      
    </section>
  {:else if !game}
    <section class="welcome">
      <h1 id="inicio" bind:this={pageHeading} tabindex="-1" class="sr-only">Cartivo · NES</h1>
      {#if pwa.updateReady}
        <div class="update" role="status">
          Nueva versión de Cartivo lista.
          <button onclick={applyUpdate}>Actualizar ahora</button>
        </div>
      {/if}
      <div
        class="empty-stage"
        class:dragging
        aria-label="Pantalla de juego vacía"
      >
        <span class="system-label">NES</span>
        {#if pendingFile}
          <button class="primary" onclick={() => openFile(pendingFile!)}
            >Jugar {pendingFile.name}</button
          >
          <button class="demo-link" onclick={() => fileInput?.click()}
            >Elegir otro juego</button
          >
        {:else}
          <button class="primary" onclick={() => fileInput?.click()}
            >Añadir juego</button
          >
        {/if}
        <button class="demo-link" onclick={() => { game = {}; }}>Probar demo</button>
        <span class="drop-hint" aria-hidden="true"
          >o arrastra aquí un archivo .nes</span
        >
      </div>
      <input
        bind:this={fileInput}
        type="file"
        accept=".nes"
        onchange={chooseGame}
        hidden
      />
    </section>
  {/if}
  {#if game}<div hidden={controlsPage}>
      <Player
        file={game.file}
        visible={!controlsPage}
        autostart
        onclose={() => {
          game = undefined;
        }}
      />
    </div>{/if}
</main>

<style>
  nav {
    display: flex;
    align-items: center;
    gap: 20px;
    flex-wrap: wrap;
  }
  nav a {
    padding: 10px 0;
    text-decoration: none;
  }
  nav a[aria-current="page"] {
    color: var(--teal);
  }
  a:focus-visible {
    outline: 3px solid var(--gold);
    outline-offset: 5px;
  }
  .controls-page {
    max-width: 720px;
    margin: 40px auto;
  }
  .controls-page h1 {
    font-size: 44px;
    letter-spacing: -2px;
  }
  .back {
    display: inline-block;
    margin-bottom: 36px;
  }
  .controls-page :global(section) {
    margin-top: 0;
  }
  main {
    max-width: 960px;
    margin: auto;
    padding: 36px 28px;
  }
  header {
    flex-wrap: wrap;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 20px;
  }
  .brand {
    font-size: 28px;
    font-weight: 750;
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
    height: 18px;
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
  .welcome {
    text-align: center;
    padding: 24px 0;
  }
  h1 {
    font-size: clamp(40px, 7vw, 70px);
    letter-spacing: -3px;
    margin: 20px 0;
  }
  .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
  .empty-stage { min-height: min(62vh, 580px); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px; background: #08090e; border-radius: 8px; }
  .system-label { font-size: clamp(48px, 12vw, 110px); font-weight: 800; letter-spacing: -0.08em; opacity: .18; }
  .empty-stage.dragging { outline: 2px dashed var(--teal); outline-offset: -12px; }
  .drop-hint { font-size: 12px; color: var(--muted); opacity: .7; }
  .update { display: flex; align-items: center; justify-content: center; gap: 14px; flex-wrap: wrap; margin-bottom: 16px; color: var(--muted); font-size: 14px; }
  .update button, .install { min-height: 36px; padding: 6px 14px; font-size: 14px; }
  .install { border-color: var(--teal); color: var(--teal); background: transparent; }
  .demo-link { background: transparent; border: 0; font-size: 13px; color: var(--muted); }
  .welcome { padding: 24px 0; }
  @media (prefers-reduced-motion: no-preference) {
    .welcome, .controls-page { animation: view-enter 180ms ease-out both; }
  }
  @keyframes view-enter {
    from { opacity: 0; transform: translateY(5px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @media (max-width: 500px) {
    main {
      padding: 24px 20px;
    }
    .welcome {
      padding: 72px 0;
    }
    h1 {
      letter-spacing: -2px;
    }
  }
</style>
