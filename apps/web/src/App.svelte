<script lang="ts">
  import { onMount, tick } from "svelte";
  import Player from "./Player.svelte";
  import ControlsPanel from "./ControlsPanel.svelte";
  import RecentGames from "./RecentGames.svelte";
  import LibraryPage from "./LibraryPage.svelte";
  import { demo, type GameSource } from "./game-source.ts";
  import {
    listGames,
    pruneOrphanRoms,
    rememberedBy,
    type LibraryEntry,
  } from "../../../packages/storage/src/library.ts";
  import { applyUpdate, install, pwa, startPwa } from "./pwa.svelte.ts";
  import {
    storageHealth,
    type StorageHealth,
  } from "../../../packages/storage/src/persistence.ts";
  import { icons } from "./icons.ts";
  import { startPadNavigation } from "./pad-navigation.svelte.ts";
  import { ui } from "./input-mode.svelte.ts";
  import InterfacePreference from "./InterfacePreference.svelte";
  import PadHints from "./PadHints.svelte";
  import {
    acceptFor,
    availableSystems,
    system as findSystem,
    gameForFiles,
    type GameFiles,
    type SystemInfo,
  } from "../../../packages/runtime/src/systems.ts";
  import "./theme.css";
  import ProfilePicker from "./ProfilePicker.svelte";
  import { profiles } from "./profile.svelte.ts";
  import type { Profile } from "../../../packages/storage/src/profiles.ts";
  /** Screens without a router: the hash names the page (#controles, #juegos). */
  type Page = "inicio" | "controles" | "juegos";
  let page = $state<Page>("inicio");
  const pageFromHash = (hash: string): Page =>
    hash === "#controles" ? "controles" : hash === "#juegos" ? "juegos" : "inicio";
  const consoles = availableSystems();
  // `id` remounts the player when a ROM replaces the current one.
  let game = $state.raw<{ source: GameSource; system: SystemInfo; id: number }>();
  let nextGameId = 0;
  const startGame = (system: SystemInfo, source: GameSource = demo) => {
    if (pwa.applyingUpdate) return;
    openError = "";
    game = { source, system, id: ++nextGameId };
  };
  // Local library: remembered games, most recent first.
  let games = $state.raw<LibraryEntry[]>([]);
  /** What this browser lets Cartivo keep (notice on the home screen). */
  let storage = $state<StorageHealth>("ok");
  let pruned = false;
  async function refreshLibrary() {
    try {
      games = await listGames(profiles.id);
      // Once per visit, in the background: copies left by an interrupted
      // remember/forget or a deleted profile, unless any profile still
      // remembers them. Never blocks nor fails the home screen.
      if (!pruned) {
        pruned = true;
        void rememberedBy(profiles.all.map((p) => p.id))
          .then((known) => pruneOrphanRoms(known))
          .catch(() => 0);
      }
    } catch {
      games = [];
    }
  }
  /** «Continuar» from the home screen or the games page: from «Al salir». */
  const continueGame = (entry: LibraryEntry, system: SystemInfo) =>
    startGame(system, { kind: "library", entry, resume: true });
  let fileInput = $state.raw<HTMLInputElement>();
  /** System whose card opened the file picker. */
  let pickerSystem = $state.raw<SystemInfo>(consoles[0]);
  /** Files opened from the OS while another game was running. */
  let pending = $state.raw<GameFiles<File>>();
  let openError = $state("");
  let dragging = $state(false);
  /** The game among the files opened together (a disc may be several). */
  const sourceOf = ({ file, extra }: GameFiles<File>): GameSource =>
    extra.length ? { kind: "file", file, extra } : { kind: "file", file };
  /** Picks the system by extension; a card choice wins for its own picker. */
  function openFiles(files: readonly File[], preferred?: SystemInfo) {
    const found = gameForFiles(files, preferred);
    if (!found) {
      openError = `No se reconoce «${files.map((f) => f.name).join("», «")}». Formatos admitidos: ${acceptFor(consoles)}.`;
      return;
    }
    // One active game: never replace a running session without the player
    // closing it first (its SRAM flush is confirmed on close). Before a
    // profile is picked, the files wait on their console's card.
    if (game || !profiles.active) pending = found;
    else {
      pending = undefined;
      startGame(found.system, sourceOf(found));
    }
  }
  function pick(system: SystemInfo) {
    pickerSystem = system;
    if (!fileInput) return;
    fileInput.accept = acceptFor([system]);
    fileInput.multiple = !!system.disc;
    fileInput.click();
  }
  function chooseGame(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = "";
    if (files.length) openFiles(files, pickerSystem);
  }
  const hasFiles = (e: DragEvent) =>
    !!e.dataTransfer && [...e.dataTransfer.types].includes("Files");
  // Window-level so a dropped file never makes the browser navigate away
  // from the app (which would end an active session without its flush).
  function dragOver(e: DragEvent) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragging = !game && page === "inicio";
  }
  function drop(e: DragEvent) {
    dragging = false;
    if (!hasFiles(e)) return;
    e.preventDefault();
    const files = Array.from(e.dataTransfer?.files ?? []);
    if (files.length && page === "inicio") openFiles(files);
  }
  let pageHeading = $state.raw<HTMLHeadingElement>();
  async function showPage() {
    page = pageFromHash(location.hash);
    await tick();
    pageHeading?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }
  /** The app's root: "/" or the sub-path it is deployed under. */
  const home = import.meta.env.BASE_URL;
  /** The logo returns to the start without reloading (a running game stays). */
  /** Who plays this visit (ADR-016): their library, saves and controls. */
  function chooseProfile(profile: Profile) {
    profiles.choose(profile);
    games = [];
    void refreshLibrary();
    void showPage();
  }
  function switchProfile() {
    profiles.choose(undefined);
    games = [];
  }
  function goHome(event: MouseEvent) {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0)
      return;
    event.preventDefault();
    if (location.pathname !== home || location.hash)
      history.pushState(null, "", home);
    void showPage();
  }
  // `data-ui` picks the presentation (modo consola); `data-input` the focus
  // ring of the device actually in use.
  $effect(() => {
    const root = document.documentElement;
    root.dataset.ui = ui.current;
    root.dataset.input = ui.lastDevice;
  });
  type LaunchParams = { files: readonly FileSystemFileHandle[] };
  type LaunchQueue = {
    setConsumer: (consumer: (params: LaunchParams) => void) => void;
  };
  onMount(() => {
    startPwa();
    void storageHealth().then((health) => (storage = health));
    if (profiles.active) void refreshLibrary();
    // "Open with Cartivo" from the operating system (installed PWA).
    const queue = (window as Window & { launchQueue?: LaunchQueue })
      .launchQueue;
    queue?.setConsumer(async ({ files }) => {
      if (files.length)
        openFiles(await Promise.all(files.map((h) => h.getFile())));
    });
    void showPage();
    const sync = () => void showPage();
    window.addEventListener("hashchange", sync);
    window.addEventListener("popstate", sync);
    const stopPad = startPadNavigation();
    return () => {
      stopPad();
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
    <a class="brand" href={home} onclick={goHome} aria-label="Cartivo, inicio"
      >cartivo<span class="palette" aria-hidden="true"
        ><i></i><i></i><i></i><i></i></span
      ></a
    >
    <nav aria-label="Principal">
      {#if profiles.active && !game}<button
          class="icon-button settings-link profile-chip"
          style={`--color: var(--profile-${profiles.active.color})`}
          aria-label={`Perfil: ${profiles.active.name}. Cambiar de perfil`}
          title="Cambiar de perfil"
          onclick={switchProfile}
          ><span class="chip-avatar" aria-hidden="true"
            >{[...profiles.active.name][0]?.toUpperCase()}</span
          ><span>{profiles.active.name}</span></button
        >{/if}
      {#if pwa.canInstall && !pwa.installed}
        <button class="install" onclick={() => void install()}
          >Instalar app</button
        >
      {/if}
      {#if games.length && !game && profiles.active}<a
          class="icon-button settings-link"
          href="#juegos"
          aria-current={page === "juegos" ? "page" : undefined}
          >{@html icons.library}<span>Tus juegos</span></a
        >{/if}
      {#if profiles.active || game}<a
          class="icon-button settings-link"
          href="#controles"
          aria-current={page === "controles" ? "page" : undefined}
          >{@html icons.gear}<span>Ajustes</span></a
        >{/if}
    </nav>
  </header>
  {#if !game && !profiles.active}
    <ProfilePicker onchoose={chooseProfile} />
  {:else if page === "controles"}
    <section class="controls-page">
      <div class="page-head">
        <a
          class="back icon-button"
          href="#inicio"
          data-pad-back
          aria-label={game ? "Volver al juego" : "Volver al inicio"}
          title={game ? "Volver al juego" : "Volver al inicio"}
          >{@html icons.back}</a
        >
        <div class="titles">
          <p class="kicker">Mando y teclado</p>
          <h1 bind:this={pageHeading} tabindex="-1">Configurar controles</h1>
        </div>
      </div>
      <InterfacePreference />
      <ControlsPanel />
    </section>
  {:else if page === "juegos" && !game}
    <section class="games-page">
      <div class="page-head">
        <a
          class="back icon-button"
          href="#inicio"
          data-pad-back
          aria-label="Volver al inicio"
          title="Volver al inicio">{@html icons.back}</a
        >
        <div class="titles">
          <p class="kicker">En este dispositivo</p>
          <h1 bind:this={pageHeading} tabindex="-1">Tus juegos</h1>
        </div>
      </div>
      <LibraryPage
        {games}
        oncontinue={continueGame}
        onchange={refreshLibrary}
      />
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
          <button onclick={applyUpdate} disabled={pwa.applyingUpdate}>
            {pwa.applyingUpdate ? "Actualizando…" : "Actualizar ahora"}
          </button>
          {#if pwa.updateProblem}<p>{pwa.updateProblem}</p>{/if}
        </div>
      {/if}
      {#if storage !== "ok"}<p class="storage-note" role="status">
          {storage === "none"
            ? "Este navegador no permite guardar: puedes jugar, pero el progreso no se conservará."
            : "Este navegador no guarda copias de tus juegos (ventana privada o almacenamiento restringido): «Continuar» no estará disponible y tus partidas podrían borrarse al cerrarlo. Exporta las que quieras conservar desde Partidas."}
        </p>{/if}
      {#if openError}<p class="open-error" role="alert">{openError}</p>{/if}
      <RecentGames {games} oncontinue={continueGame} />
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
                    onclick={() => openFiles([waiting.file, ...waiting.extra], waiting.system)}
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
    </section>
  {/if}
  {#if game}<div hidden={page === "controles"}>
      {#key game.id}
        <Player
          system={game.system}
          source={game.source}
          visible={page !== "controles"}
          canRemember={storage === "ok"}
          autostart
          onclose={() => {
            game = undefined;
            void refreshLibrary();
          }}
          onreplace={(files: File[]) => {
            pending = undefined;
            const found = gameForFiles(files) ?? gameForFiles(files, game!.system);
            if (found) startGame(found.system, sourceOf(found));
          }}
        />
      {/key}
    </div>{/if}
  {#if ui.current === "pad"}<PadHints />{/if}
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
  .chip-avatar {
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    border-radius: 8px;
    background: var(--color);
    color: #111218;
    font-weight: 700;
  }
  .link {
    background: transparent;
    border: 0;
    padding: 6px 0;
    min-height: 32px;
    color: var(--blue);
    font-size: 14px;
  }
  .storage-note {
    margin: 24px auto 0;
    max-width: 640px;
    text-align: center;
    color: var(--gold);
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
  .controls-page,
  .games-page {
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
    .controls-page,
    .games-page {
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
  /* Modo consola: the consoles become a horizontal carousel the D-pad
     scrolls through, and the page keeps room for the button legend. */
  :global(:root[data-ui="pad"]) main {
    padding-bottom: 96px;
  }
  :global(:root[data-ui="pad"]) .consoles {
    grid-auto-flow: column;
    grid-template-columns: none;
    grid-template-rows: repeat(3, auto);
    grid-auto-columns: minmax(260px, 30%);
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    padding: 8px 8px 16px;
  }
  :global(:root[data-ui="pad"]) .consoles > li {
    grid-row: 1 / span 3;
    scroll-snap-align: start;
  }
</style>
