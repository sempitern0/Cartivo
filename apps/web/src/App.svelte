<script lang="ts">
  import { onMount, tick } from "svelte";
  import Player from "./Player.svelte";
  import SettingsPage, {
    tabFromHash,
    type SettingsTab,
  } from "./SettingsPage.svelte";
  import RecentGames from "./RecentGames.svelte";
  import LibraryPage from "./LibraryPage.svelte";
  import { demo, hasFiles, type GameSource } from "./game-source.ts";
  import { sharedGames, pruneSharedRoms, type GameSort } from "../../../packages/storage/src/library.ts";
  import { resumeIndex } from "../../../packages/storage/src/state-index.ts";
  import { chooseResume, type GameCard } from "./library-view.ts";
  import { applyUpdate, install, pwa, startPwa } from "./pwa.svelte.ts";
  import {
    storageHealth,
    type StorageHealth,
  } from "../../../packages/storage/src/persistence.ts";
  import { icons } from "./icons.ts";
  import { startPadNavigation } from "./pad-navigation.svelte.ts";
  import { ui } from "./input-mode.svelte.ts";
  import { motion } from "./motion.svelte.ts";
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
  import ConsoleCard from "./ConsoleCard.svelte";
  import { profiles } from "./profile.svelte.ts";
  import {
    initials,
    type Profile,
  } from "../../../packages/storage/src/profiles.ts";
  import {
    cueFiles,
    matchTracks,
  } from "../../../packages/storage/src/cue.ts";
  /** Screens without a router: the hash names the page (#ajustes, #juegos). */
  type Page = "inicio" | "ajustes" | "juegos";
  let page = $state<Page>("inicio");
  /** The Ajustes tab the address asks for (#ajustes/sonido, #controles). */
  let settingsTab = $state<SettingsTab>();
  const pageFromHash = (hash: string): Page =>
    hash === "#ajustes" || tabFromHash(hash)
      ? "ajustes"
      : hash === "#juegos"
        ? "juegos"
        : "inicio";
  const consoles = availableSystems();
  // `id` remounts the player when a ROM replaces the current one.
  let game = $state.raw<{ source: GameSource; system: SystemInfo; id: number }>();
  let nextGameId = 0;
  /**
   * The control (`data-launch`) that started the game: it gets the focus
   * back when the game ends, so a pad or the keyboard carries on from the
   * same card instead of the top of the page.
   */
  let launcher: string | undefined;
  const startGame = (system: SystemInfo, source: GameSource = demo) => {
    if (pwa.applyingUpdate) return;
    openError = "";
    const from = document.activeElement;
    if (!game) launcher = from instanceof HTMLElement ? from.dataset.launch : undefined;
    game = { source, system, id: ++nextGameId };
  };
  async function returnFocus() {
    await tick();
    const control = launcher
      ? document.querySelector<HTMLElement>(
          `[data-launch="${CSS.escape(launcher)}"]`,
        )
      : null;
    (control ?? pageHeading)?.focus({ preventScroll: true });
    control?.scrollIntoView({ block: "nearest" });
  }
  // Local library: remembered games, most recent first.
  let games = $state.raw<GameCard[]>([]);
  let libraryQuery = $state("");
  let libraryFilter = $state("");
  let librarySort = $state<GameSort>("recent");
  let libraryProblem = $state("");
  let libraryLoading = $state(true);
  let storage = $state<StorageHealth>("ok");
  let pruned = false;
  let libraryRequest = 0;
  async function refreshLibrary() {
    const id = profiles.id;
    const request = ++libraryRequest;
    libraryLoading = true;
    try {
      const entries = await sharedGames(id, profiles.all.map((p) => p.id));
      let warning = "";
      const states = await resumeIndex(id).catch((error: unknown) => {
        warning = error instanceof Error
          ? error.message
          : "No se pudieron consultar las partidas. Puedes revisarlas desde Partidas.";
        return undefined;
      });
      if (request !== libraryRequest || profiles.active?.id !== id) return;
      games = entries.map((entry) => {
        const system = findSystem(entry.system);
        const saved = states?.get(entry.hash) ?? [];
        const resume = system ? chooseResume(saved, system) : undefined;
        return { ...entry, resume, stateUnavailable: saved.length > 0 && !resume };
      });
      libraryProblem = warning;
      if (!pruned) {
        pruned = true;
        void pruneSharedRoms().catch(() => 0);
      }
    } catch {
      if (request === libraryRequest && profiles.active?.id === id)
        libraryProblem = "No se pudo leer la biblioteca. Tus archivos no se han borrado.";
    } finally {
      if (request === libraryRequest) libraryLoading = false;
    }
  }
  const continueGame = (entry: GameCard, system: SystemInfo) =>
    startGame(system, { kind: "library", entry, resume: !!entry.resume, resumeState: entry.resume });
  let fileInput = $state.raw<HTMLInputElement>();
  /** System whose card opened the file picker. */
  let pickerSystem = $state.raw<SystemInfo>(consoles[0]);
  /** Files opened from the OS while another game was running. */
  let pending = $state.raw<GameFiles<File>>();
  let openError = $state("");
  let dragging = $state(false);
  /** The cards deal in once per visit, not on every return to the start. */
  let dealt = $state(false);
  /** «Jugar» on a card: the files waiting there, or the picker. */
  function launch(system: SystemInfo) {
    const waiting = pending?.system.id === system.id ? pending : undefined;
    if (waiting) void openFiles([waiting.file, ...waiting.extra], system);
    else pick(system);
  }
  /** The game among the files opened together (a disc may be several). */
  const sourceOf = ({ file, extra }: GameFiles<File>): GameSource =>
    extra.length ? { kind: "file", file, extra } : { kind: "file", file };
  /** A disc's .cue opened without the tracks it names: asked for on its card. */
  let incomplete = $state.raw<{ game: GameFiles<File>; missing: string[] }>();
  /** The next pick adds tracks to `incomplete` instead of replacing it. */
  let addingTracks = false;
  /** The tracks a .cue names that were not opened with it (a tiny read). */
  async function missingTracks({ file, extra }: GameFiles<File>) {
    if (!file.name.toLowerCase().endsWith(".cue")) return [];
    try {
      return matchTracks(cueFiles(await file.text()), extra).missing;
    } catch {
      return []; // unreadable here: the Worker reports it
    }
  }
  /** Picks the system by extension; a card choice wins for its own picker. */
  async function openFiles(files: readonly File[], preferred?: SystemInfo) {
    const found = gameForFiles(files, preferred);
    if (!found) {
      openError = `No se reconoce «${files.map((f) => f.name).join("», «")}». Formatos admitidos: ${acceptFor(consoles)}.`;
      return;
    }
    const missing = await missingTracks(found);
    incomplete = missing.length ? { game: found, missing } : undefined;
    if (incomplete) {
      openError = "";
      await tick();
      document.querySelector<HTMLElement>(".tracks .primary")?.focus();
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
  function pickTracks() {
    if (!incomplete) return;
    addingTracks = true;
    pick(incomplete.game.system);
  }
  function chooseGame(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = "";
    const adding = addingTracks ? incomplete : undefined;
    addingTracks = false;
    if (!files.length) return;
    if (adding)
      void openFiles(
        [adding.game.file, ...adding.game.extra, ...files],
        adding.game.system,
      );
    else void openFiles(files, pickerSystem);
  }
  // Window-level so a dropped file never makes the browser navigate away
  // from the app (which would end an active session without its flush).
  function dragOver(e: DragEvent) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragging = !game && page === "inicio";
  }
  function drop(e: DragEvent) {
    dragging = false;
    // A console card already took it (with that console as preference).
    if (!hasFiles(e) || e.defaultPrevented) return;
    e.preventDefault();
    const files = Array.from(e.dataTransfer?.files ?? []);
    if (files.length && page === "inicio") void openFiles(files);
  }
  /**
   * `#demo/<console>` starts that console's original demo ROM. The demos left
   * the interface; this hidden entry keeps them for tests and diagnosis.
   */
  function startDemoFromHash() {
    const id = /^#demo\/([\w-]+)$/.exec(location.hash)?.[1];
    if (!id) return false;
    history.replaceState(null, "", location.pathname + location.search);
    const found = consoles.find((item) => item.id === id && item.demo);
    if (found && profiles.active && !game) startGame(found);
    return true;
  }
  let pageHeading = $state.raw<HTMLHeadingElement>();
  async function showPage() {
    if (startDemoFromHash()) {
      page = "inicio";
      return;
    }
    page = pageFromHash(location.hash);
    settingsTab = tabFromHash(location.hash);
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
    libraryQuery = "";
    libraryFilter = "";
    libraryProblem = "";
    void refreshLibrary();
    void showPage();
  }
  function switchProfile() {
    ++libraryRequest;
    profiles.choose(undefined);
    games = [];
    libraryProblem = "";
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
    root.dataset.motion = motion.reduced ? "reduce" : "full";
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
        void openFiles(await Promise.all(files.map((h) => h.getFile())));
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
            >{initials(profiles.active.name)}</span
          ><span class="chip-name">{profiles.active.name}</span></button
        >{/if}
      {#if pwa.canInstall && !pwa.installed}
        <button class="install" onclick={() => void install()}
          >Instalar app</button
        >
      {/if}
      {#if !game && profiles.active}<a
          class="icon-button settings-link"
          href="#juegos"
          aria-current={page === "juegos" ? "page" : undefined}
          >{@html icons.library}<span>Tus juegos</span></a
        >{/if}
      {#if profiles.active || game}<a
          class="icon-button settings-link"
          href="#ajustes"
          aria-current={page === "ajustes" ? "page" : undefined}
          >{@html icons.gear}<span>Ajustes</span></a
        >{/if}
    </nav>
  </header>
  {#if libraryProblem && profiles.active && !game}<p class="storage-note" role="status">{libraryProblem} <button onclick={refreshLibrary}>Reintentar</button></p>{/if}
  {#if !game && !profiles.active}
    <ProfilePicker onchoose={chooseProfile} />
  {:else if page === "ajustes"}
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
          <p class="kicker">A tu manera</p>
          <h1 bind:this={pageHeading} tabindex="-1">Ajustes</h1>
        </div>
      </div>
      <SettingsPage inGame={!!game} tab={settingsTab} />
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
        loading={libraryLoading}
        bind:query={libraryQuery}
        bind:systemFilter={libraryFilter}
        bind:sort={librarySort}
        {games}
        oncontinue={continueGame}
        onchange={refreshLibrary}
      />
    </section>
  {:else if !game}
    <section class="welcome">
      <!-- The cards speak for themselves (the owner asked for no visible
           title): the heading is for assistive technology and the focus
           target of the start. -->
      <h1 id="inicio" class="visually-hidden" bind:this={pageHeading} tabindex="-1">
        Elige una consola
      </h1>
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
      <RecentGames
        games={games.filter((g) => !g.hidden)}
        oncontinue={continueGame}
      />
      <ul
        class="consoles"
        aria-label="Consolas"
        onanimationend={(e) => {
          if (e.target === e.currentTarget.lastElementChild) dealt = true;
        }}
      >
        {#each consoles as item, index (item.id)}
          {@const waiting = pending?.system.id === item.id ? pending : undefined}
          {@const asking =
            incomplete?.game.system.id === item.id ? incomplete : undefined}
          <li class:deal={!dealt} style={`--i: ${index}`}>
            <ConsoleCard
              system={item}
              {dragging}
              waiting={waiting?.file.name}
              missing={asking && {
                file: asking.game.file.name,
                tracks: asking.missing,
              }}
              onplay={() => launch(item)}
              onpick={() => pick(item)}
              onpicktracks={pickTracks}
              oncanceltracks={() => (incomplete = undefined)}
              ondropfiles={(files) => void openFiles(files, item)}
            />
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
  {#if game}<div hidden={page === "ajustes"}>
      {#key game.id}
        <Player
          system={game.system}
          source={game.source}
          visible={page !== "ajustes"}
          canRemember={storage === "ok"}
          autostart
          onclose={() => {
            game = undefined;
            void refreshLibrary();
            void returnFocus();
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
    padding: 8px 0 24px;
  }
  .consoles {
    list-style: none;
    padding: 0;
    margin: 32px 0 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 236px), 1fr));
    gap: 20px;
  }
  /* Each card spans three rows of a shared subgrid (badge, text, foot), so a
     longer title in one card moves the whole row and the feet stay aligned. */
  .consoles > li {
    display: grid;
    grid-row: span 3;
    grid-template-rows: subgrid;
    row-gap: 16px;
  }
  .profile-chip {
    gap: 10px;
    padding: 5px 16px 5px 5px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: #151824cc;
    transition:
      border-color 0.2s ease,
      background 0.2s ease,
      transform 0.2s ease;
  }
  .profile-chip:hover {
    border-color: var(--color);
    background: color-mix(in srgb, var(--color) 12%, #151824);
  }
  .profile-chip:hover .chip-avatar {
    transform: scale(1.08);
  }
  .chip-avatar {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background:
      radial-gradient(120% 120% at 20% 10%, #ffffff40, transparent 55%),
      var(--color);
    color: #111218;
    font-size: 13px;
    font-weight: 750;
    transition: transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  .chip-name {
    max-width: 14ch;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
  /* Movement (docs/DESIGN.md): short view entrances and answers to what the
     user does; theme.css turns all of it off under prefers-reduced-motion. */
  .welcome,
  .controls-page,
  .games-page {
    animation: view-enter 320ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
  }
  /* The one orchestrated moment: the console shelf deals in on the first
     visit to the start; later returns only fade the view in. */
  .consoles > li.deal {
    animation: rise 460ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
    animation-delay: calc(60ms + var(--i, 0) * 45ms);
  }
  .open-error {
    animation: nudge 360ms ease both;
  }
  .settings-link:not(.profile-chip) {
    position: relative;
  }
  .settings-link:not(.profile-chip)::after {
    content: "";
    position: absolute;
    left: 4px;
    right: 4px;
    bottom: 6px;
    height: 2px;
    border-radius: 2px;
    background: currentColor;
    transform: scaleX(0);
    transform-origin: left;
    transition: transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  .settings-link:hover::after,
  .settings-link[aria-current="page"]::after {
    transform: scaleX(1);
  }
  .back {
    transition:
      transform 0.2s ease,
      border-color 0.2s ease;
  }
  .back:hover {
    transform: translateX(-3px);
    border-color: #ffffff40;
  }
  @keyframes view-enter {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
  }
  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(16px) scale(0.98);
    }
  }
  @keyframes nudge {
    0% {
      opacity: 0;
      transform: translateX(0);
    }
    30% {
      opacity: 1;
      transform: translateX(-6px);
    }
    60% {
      transform: translateX(4px);
    }
    100% {
      transform: none;
    }
  }
  @media (max-width: 640px) {
    main {
      padding: 20px 16px 32px;
    }
    .welcome {
      padding-top: 4px;
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
  :global(:root[data-ui="pad"]) main { padding-bottom: 96px; }
</style>
