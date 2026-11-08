<script lang="ts">
  import { onMount, tick } from "svelte";
  import GameStage from "./GameStage.svelte";
  import PlayerToolbar from "./PlayerToolbar.svelte";
  import GraphicsPanel from "./GraphicsPanel.svelte";
  import SavePanel from "./SavePanel.svelte";
  import ResumeOffer from "./ResumeOffer.svelte";
  import FullscreenPause from "./FullscreenPause.svelte";
  import PerformanceDetails from "./PerformanceDetails.svelte";
  import PauseMenu from "./PauseMenu.svelte";
  import { ui } from "./input-mode.svelte.ts";
  import PlayerActions from "./PlayerActions.svelte";
  import DeviceStatus from "./DeviceStatus.svelte";
  import BackupPanel from "./BackupPanel.svelte";
  import AboutCore from "./AboutCore.svelte";
  import { DisplaySettings } from "./display.svelte.ts";
  import { FrameMetrics } from "../../../packages/media/src/frame-metrics.ts";
  import { FramePacer } from "../../../packages/media/src/frame-pacer.ts";
  import { slotNames } from "./saves.ts";
  import { downloadJson } from "./download.ts";
  import { stateFileName } from "../../../packages/storage/src/state-file.ts";
  import { EmulatorClient } from "../../../packages/runtime/src/client.ts";
  import {
    acceptFor,
    type SystemInfo,
  } from "../../../packages/runtime/src/systems.ts";
  import {
    readCore,
    writeCore,
  } from "../../../packages/runtime/src/core-preference.ts";
  import type {
    StateMeta,
    StateSlot,
  } from "../../../packages/storage/src/states.ts";
  import { GameSound } from "./sound.svelte.ts";
  import { surfaceFor } from "./surface.ts";
  import { claimPadWhile } from "./pad-navigation.svelte.ts";
  import { isPauseGesture } from "../../../packages/input/src/ui-navigation.ts";
  import { captureGameInput } from "./game-capture.ts";
  import { InputCapture } from "../../../packages/input/src/capture.ts";
  import { keyLabel } from "../../../packages/input/src/nes-input.ts";
  import { rememberGames } from "../../../packages/storage/src/library.ts";
  import { loadFields, sourceTitle, type GameSource } from "./game-source.ts";
  import {
    getPadPreference,
    KEYBOARD_KEY,
    readKeyboard,
  } from "../../../packages/input/src/preferences.ts";
  import { profiles } from "./profile.svelte.ts";
  let {
    source,
    visible = true,
    autostart = false,
    canRemember = true,
    onclose,
    onreplace,
    system,
  }: {
    /** System being played (packages/runtime/src/systems.ts). */
    system: SystemInfo;
    source: GameSource;
    visible?: boolean;
    autostart?: boolean;
    /** False when the browser cannot keep ROM copies (no OPFS): never ask. */
    canRemember?: boolean;
    onclose: () => void;
    /** Called after this session closed safely, to start another ROM. */
    /** Files opened from the player to start instead (a disc may be several). */
    onreplace?: (files: File[]) => void;
  } = $props();
  let phase = $state<"ready" | "loading" | "running" | "paused" | "error">(
    "ready",
  );
  let notice = $state.raw<HTMLDivElement>();
  let problem = $state("");
  let saveStatus = $state("");
  /** This browser cannot save at all; the game runs without saving. */
  let noStorage = $state("");
  let battery = $state(false);
  let frames = $state(0);
  let padStatus = $state("Sin mando");
  let padConnected = $state(false);
  let romInput = $state.raw<HTMLInputElement>();
  // The player is remounted for each game ({#key} in App), so the system
  // is fixed for its lifetime and reading its initial value is intended.
  // svelte-ignore state_referenced_locally
  let coreChoice = $state<string>(source.kind === "library" && source.resumeState ? source.resumeState.core : readCore(system));
  // «Partidas»: full-console snapshots (ADR-009).
  let saves = $state.raw<StateMeta[]>([]);
  let savesOpen = $state(false);
  let savesButton = $state.raw<HTMLButtonElement>();
  let resumeOffer = $state.raw<StateMeta>();
  let toast = $state("");
  let hasPlayed = false;
  let exitSaveFailed = $state(false);
  let toastTimer = 0;
  function notify(message: string) {
    toast = message;
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => (toast = ""), 2600);
  }
  async function saveSlot(slot: StateSlot, quiet = false) {
    if (!client || phase === "loading" || phase === "error") return false;
    try {
      const r = await client.request("state-save", { slot });
      saves = r.states ?? saves;
      const where = slotNames[slot].toLowerCase();
      if (r.saveError)
        problem = `Partida guardada en ${where}, pero la memoria del cartucho no se pudo guardar: ${r.saveError}`;
      else if (!quiet) notify(`Partida guardada en ${where}.`);
      return true;
    } catch (e) {
      if (!quiet)
        problem = e instanceof Error ? e.message : "No se pudo guardar la partida";
      return false;
    }
  }
  async function loadSlot(slot: StateSlot) {
    if (!client || phase === "loading" || phase === "error") return;
    const wasRunning = phase === "running";
    if (wasRunning) await pause();
    try {
      const r = await client.request("state-load", { slot });
      saves = r.states ?? saves;
      frames = r.frames ?? frames;
      resumeOffer = undefined;
      savesOpen = false;
      problem = "";
      notify(`Partida cargada: ${slotNames[slot].toLowerCase()}.`);
      await resume();
    } catch (e) {
      problem = e instanceof Error ? e.message : "No se pudo cargar la partida";
    }
  }
  async function deleteSlot(slot: StateSlot) {
    if (!client) return;
    try {
      const r = await client.request("state-delete", { slot });
      saves = r.states ?? saves;
    } catch (e) {
      problem = e instanceof Error ? e.message : "No se pudo borrar la partida";
    }
  }
  async function exportSlot(slot: StateSlot) {
    if (!client) return;
    try {
      const { stateFile } = await client.request("state-export", { slot });
      if (!stateFile) throw Error("No hay partida que exportar");
      downloadJson(stateFileName(system.id, slot, stateFile.createdAt), stateFile);
      notify("Partida exportada.");
    } catch (e) {
      problem = e instanceof Error ? e.message : "No se pudo exportar la partida";
    }
  }
  async function importState(stateFile: object) {
    if (!client) return;
    try {
      const r = await client.request("state-import", { stateFile });
      saves = r.states ?? saves;
      problem = "";
      notify("Partida importada.");
    } catch (e) {
      problem = e instanceof Error ? e.message : "No se pudo importar la partida";
    }
  }
  async function toggleSaves() {
    if (phase === "running") await pause();
    savesOpen = !savesOpen;
    if (savesOpen) {
      graphicsOpen = false;
    }
  }
  function closeSaves() {
    savesOpen = false;
    savesButton?.focus({ preventScroll: true });
  }
  // Demo hint: the first face buttons with this console's own names.
  const demoHint = $derived.by(() => {
    const keys = readKeyboard(profiles.key(KEYBOARD_KEY));
    const face = system.buttons
      .filter((a) => a !== "start" && a !== "select")
      .slice(0, 3)
      .map(
        (a) =>
          `${keyLabel(keys[a])} = ${system.labels?.[a] ?? a.toUpperCase()}`,
      );
    return `WASD o flechas para moverte · ${face.join(" · ")}.`;
  });
  let runningCore = $state<string>();
  function chooseCore(id: string) {
    coreChoice = id;
    writeCore(system, id);
  }
  let busy = $state(false);
  let viewport = $state.raw<HTMLElement>();
  let fullscreen = $state(false);
  let fullscreenAvailable = $state(false);
  let focusMode = $state(false);
  // svelte-ignore state_referenced_locally
  const display = new DisplaySettings(system);
  let scaleFallback = $state(false);
  let graphicsOpen = $state(false);
  let graphicsButton = $state.raw<HTMLButtonElement>();
  async function toggleGraphics() {
    if (phase === "running") await pause();
    graphicsOpen = !graphicsOpen;
    if (graphicsOpen) savesOpen = false;
  }
  function closeGraphics() {
    graphicsOpen = false;
    graphicsButton?.focus({ preventScroll: true });
  }
  let resumeButton = $state.raw<HTMLButtonElement>();
  let screen = $state.raw<HTMLCanvasElement>();
  let frameElement = $state.raw<HTMLDivElement>();
  let actionsElement = $state.raw<HTMLDivElement>();
  // Reactive: BackupPanel receives it as a prop.
  let client = $state.raw<EmulatorClient>();
  const sound = new GameSound();
  let active = true;
  let loop = 0;
  // The system's nominal rate until the core reports the game's own (PAL);
  // the pacer follows it.
  // svelte-ignore state_referenced_locally
  let frameRate = $state(system.frameRate);
  const pacer = $derived(new FramePacer(frameRate));
  const metrics = new FrameMetrics();
  let diagnostics = $state.raw(metrics.snapshot());
  let loadMs = $state<number>();
  const controls = new InputCapture(
    readKeyboard(profiles.key(KEYBOARD_KEY)),
    () => navigator.getGamepads?.() ?? [],
    getPadPreference,
    !!system.analogStick,
  );
  function fail(e: unknown) {
    phase = "error";
    if (battery) saveStatus = "Guardado sin confirmar.";
    problem = e instanceof Error ? e.message : "No se pudo iniciar la sesión";
    sound.pause();
    controls.clear();
  }
  async function start() {
    if (phase !== "ready") return;
    phase = "loading";
    problem = "";
    sound.start();
    const loadStarted = performance.now();
    client = new EmulatorClient(
      new Worker(new URL("./emulator.worker.ts", import.meta.url), {
        type: "module",
      }),
    );
    try {
      // A core that draws itself gets the game canvas (ADR-017); after the
      // transfer the page never touches its pixels again.
      const canvas = system.surface ? surfaceFor(screen) : undefined;
      const r = await client.request(
        "load",
        {
          ...loadFields(source, canRemember && rememberGames()),
          system: system.id,
          profile: profiles.id,
          core: coreChoice,
          canvas,
        },
        canvas ? [canvas] : [],
      );
      loadMs = performance.now() - loadStarted;
      runningCore = r.core;
      if (!active) return;
      frameRate = r.frameRate ?? system.frameRate;
      battery = !!r.battery;
      saves = r.states ?? [];
      noStorage = r.storageError ?? "";
      saveStatus = noStorage
        ? noStorage
        : r.recovered
          ? "Partida recuperada desde la generación anterior."
          : battery
            ? "Guardado automático preparado."
            : "Este cartucho no tiene batería; usa Partidas para guardar.";
      phase = "paused";
      if (r.libraryError) problem = r.libraryError;
      // A disc is copied while it plays; its outcome comes with a frame.
      if (r.remembering)
        notify(
          `Guardando el disco en «Tus juegos» (${Math.ceil(r.remembering / 2 ** 20)} MB)…`,
        );
      const exit = saves.find((s) => s.slot === "auto" && system.cores.some((core) => core.id === coreChoice && s.core === core.id && s.coreVersion === core.version));
      // «Continuar» from the home screen goes straight to the exit snapshot.
      if (source.kind === "library" && source.resume && (source.resumeState || exit))
        await loadSlot(source.resumeState?.slot ?? "auto");
      else {
        // Offer to continue from the exit snapshot instead of starting over.
        resumeOffer = exit;
        if (!resumeOffer) await resume();
      }
    } catch (e) {
      client?.dispose();
      if (active) fail(e);
    }
  }
  async function resume() {
    if (phase !== "paused" || busy || !visible) return;
    sound.resume();
    if (!active || !visible) return;
    // Playing without choosing «Continuar» starts over from power-on.
    resumeOffer = undefined;
    controls.start(readKeyboard(profiles.key(KEYBOARD_KEY)));
    pacer.start(performance.now());
    metrics.reset(performance.now());
    phase = "running";
    hasPlayed = true;
    await tick();
    (actionsElement ?? screen)?.scrollIntoView({ block: "nearest" });
    screen?.focus({ preventScroll: true });
    loop = requestAnimationFrame(pump);
  }
  async function pause() {
    if (phase !== "running") return;
    phase = "paused";
    diagnostics = metrics.snapshot();
    cancelAnimationFrame(loop);
    controls.clear();
    sound.pause();
    busy = true;
    try {
      const r = await client?.request("pause");
      if (r?.saved) saveStatus = "Partida guardada en este dispositivo.";
    } catch (e) {
      problem =
        e instanceof Error
          ? e.message
          : "No se pudo guardar. Exporta una copia antes de salir.";
      saveStatus = "Guardado sin confirmar.";
    } finally {
      busy = false;
      await tick();
      if (visible) resumeButton?.focus({ preventScroll: true });
    }
  }
  $effect(() => {
    if (!visible && phase === "running") void pause();
  });
  // Modo consola: the pause is a menu over the game, unless something else
  // (the continue offer, a panel, another page) is on screen.
  const pauseMenu = $derived(
    ui.current === "pad" &&
      phase === "paused" &&
      visible &&
      !resumeOffer &&
      !savesOpen &&
      !graphicsOpen,
  );
  // While the game runs the pad is the game's; paused, it drives the menus.
  claimPadWhile("player", () => phase === "running");
  $effect(() => {
    const message = problem;
    if (message && visible)
      void tick().then(() => {
        if (active && visible && problem === message)
          notice?.scrollIntoView({ block: "nearest" });
      });
  });
  async function pump(now: number) {
    if (phase !== "running" || !visible || !active) return;
    const reading = controls.read();
    padStatus = reading.status;
    if (reading.lost) {
      await pause();
      return;
    }
    padConnected = reading.connected;
    const input = reading.input;
    // The pause gesture never reaches the game; the menus take the pad.
    // (Made on a pad, PadActivity has already switched to «Mando».)
    if (reading.ready && isPauseGesture(input)) {
      await pause();
      return;
    }
    if (!reading.ready) {
      pacer.start(now);
      metrics.reset(now);
      loop = requestAnimationFrame(pump);
      return;
    }
    const step = pacer.step(now);
    if ("tooSlow" in step) {
      problem =
        "Este dispositivo no consigue mantener la velocidad del juego. Reanuda para seguir; el juego nunca se acelera para recuperar.";
      await pause();
      return;
    }
    const count = step.frames;
    if (!count) {
      loop = requestAnimationFrame(pump);
      return;
    }
    try {
      const requestedAt = performance.now();
      const r = await client!.request("advance", {
        count,
        input,
        analog: reading.analog,
      });
      const completedAt = performance.now();
      if (active && phase === "running")
        metrics.record(completedAt, completedAt - requestedAt, count);
      if (!active) return;
      if (r.pixels && screen) {
        const ctx = screen.getContext("2d");
        if (!ctx) throw Error("Canvas 2D no disponible");
        ctx.putImageData(
          new ImageData(
            new Uint8ClampedArray(r.pixels),
            r.width ?? system.video.sourceWidth,
            r.height ?? system.video.sourceHeight,
          ),
          0,
          0,
        );
      }
      frames = r.frames ?? frames;
      if (r.remembered) notify("Disco guardado en «Tus juegos».");
      if (r.libraryError) problem = r.libraryError;
      if (r.saveError) {
        problem = r.saveError;
        await pause();
        return;
      }
      if (r.saved) saveStatus = "Partida guardada en este dispositivo.";
      if (phase === "running" && visible && r.audio) sound.push(r.audio);
    } catch (e) {
      fail(e);
      return;
    }
    if (phase === "running") loop = requestAnimationFrame(pump);
  }
  /** Player shortcuts while playing; the rest of the keys go to the game. */
  function shortcut(e: KeyboardEvent) {
    if (e.code === "KeyF" && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) {
      focusMode = !focusMode;
      return true;
    }
    if ((e.code === "F5" || e.code === "F9") && !e.repeat) {
      // Never let F5 reload the page during a game.
      void (e.code === "F5" ? saveSlot("1") : loadSlot("1"));
      return true;
    }
    if (e.code === "Escape") {
      if (document.fullscreenElement === viewport)
        void document.exitFullscreen().catch(() => {});
      void pause();
      return true;
    }
    return false;
  }
  function tapControl(action: "start" | "select") {
    if (phase !== "running") return;
    controls.tap(action);
  }
  async function resetConsole() {
    if (phase === "running") await pause();
    if (phase !== "paused" || busy || saveStatus === "Guardado sin confirmar.")
      return;
    busy = true;
    try {
      const result = await client!.request("reset");
      frames = result.frames ?? 0;
      controls.clear();
      // Never leave the previous game's last frame on screen (a surface
      // core repaints its own canvas).
      if (!system.surface)
        screen?.getContext("2d")?.clearRect(0, 0, screen.width, screen.height);
      saveStatus = result.saved ? "Partida guardada antes de reiniciar." : saveStatus;
      problem = "";
      resumeOffer = undefined;
    } catch (error) {
      problem = error instanceof Error ? error.message : "No se pudo reiniciar la consola";
      return;
    } finally {
      busy = false;
    }
    // A reset is a power cycle: the console starts running again.
    notify("Consola reiniciada.");
    await resume();
  }
  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement === viewport)
        await document.exitFullscreen();
      else {
        await viewport?.requestFullscreen();
        notify("Pulsa Escape para salir de pantalla completa.");
      }
    } catch (e) {
      problem =
        "No se pudo activar pantalla completa. Puedes seguir jugando en esta ventana.";
    }
  }
  async function enableSound() {
    if (!(await sound.enable(phase === "running")))
      problem = "El navegador no ha podido activar el sonido.";
  }
  // Closing always goes through the same path: pause (SRAM flush confirmed by
  // the worker), then dispose. `next` starts another ROM afterwards.
  async function close(next?: File[]) {
    const finish = () => (next && onreplace ? onreplace(next) : onclose());
    if (phase === "loading") {
      client?.dispose();
      sound.close();
      finish();
      return;
    }
    // Wait for an in-flight save/pause instead of ignoring «Salir».
    for (let i = 0; busy && i < 50; i++)
      await new Promise((r) => setTimeout(r, 50));
    if (busy) return;
    if (phase === "running") await pause();
    // Exit snapshot so the next opening can continue from here. Skipped
    // while the continue offer is pending: nothing has been played yet.
    if (phase === "paused" && hasPlayed && !resumeOffer && !noStorage) {
      exitSaveFailed = !(await saveSlot("auto", true));
      if (exitSaveFailed) {
        problem = "No se pudo guardar la partida al salir. Reintenta Salir o exporta una ranura desde Partidas antes de cerrar.";
        return;
      }
    }
    if (saveStatus === "Guardado sin confirmar.") {
      problem =
        "Exporta una copia antes de cerrar: el guardado local no se ha confirmado.";
      return;
    }
    client?.dispose();
    sound.close();
    finish();
  }
  async function chooseRom() {
    if (busy) return;
    if (phase === "running") await pause();
    romInput?.click();
  }
  function romChosen(event: Event) {
    const input = event.target as HTMLInputElement;
    const next = Array.from(input.files ?? []);
    input.value = "";
    if (next.length) void close(next);
  }
  onMount(() => {
    fullscreenAvailable = !!document.fullscreenEnabled;
    if (autostart) void start();
    const fullscreenChange = () => {
      const was = fullscreen;
      fullscreen = document.fullscreenElement === viewport;
      if (was && !fullscreen) void pause();
    };
    const release = captureGameInput({
      playing: () => phase === "running" && visible,
      screen: () => screen,
      picture: () => frameElement,
      shortcut,
      keyDown: (code, repeat) => controls.keyDown(code, repeat),
      keyUp: (code) => controls.keyUp(code),
    });
    document.addEventListener("fullscreenchange", fullscreenChange);
    const blur = () => {
      void pause();
    };
    const hide = () => {
      if (!document.hidden || phase !== "running") return;
      // Mobile may kill a hidden tab: keep an exit snapshot as well.
      void pause().then(() => saveSlot("auto", true));
    };
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", hide);
    return () => {
      active = false;
      cancelAnimationFrame(loop);
      controls.clear();
      sound.close();
      client?.dispose();
      release();
      document.removeEventListener("fullscreenchange", fullscreenChange);
      if (document.fullscreenElement === viewport)
        void document.exitFullscreen().catch(() => {});
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", hide);
    };
  });
</script>

<section
  bind:this={viewport}
  class="player"
  class:playing={phase === "running"}
  class:focus-mode={focusMode && phase === "running" && !fullscreen}
  class:immersive={fullscreen}
  aria-label={`Reproductor ${system.name}`}
  data-pad-scope
>
  {#if focusMode && phase === "running"}
    <button
      type="button"
      class="focus-exit"
      aria-label="Salir del modo Focus"
      onclick={() => {
        focusMode = false;
        if (document.fullscreenElement === viewport)
          void document.exitFullscreen().catch(() => {});
      }}>Salir de Focus</button
    >
  {/if}
  <PlayerToolbar
    systemName={system.name}
    title={sourceTitle(source)}
    {phase}
    {busy}
    {graphicsOpen}
    {savesOpen}
    savesAvailable={!noStorage}
    exitLabel={noStorage ? "Salir" : "Guardar y salir"}
    bind:graphicsButton
    bind:savesButton
    ongraphics={toggleGraphics}
    onsaves={toggleSaves}
    onrom={chooseRom}
    onexit={() => close()}
  />
  <input
    bind:this={romInput}
    type="file"
    accept={acceptFor([system])}
    multiple={!!system.disc}
    onchange={romChosen}
    hidden
  />

  {#if noStorage}<p class="storage-note" role="status" data-player-chrome>
      {noStorage}
    </p>{/if}
  {#if source.kind === "demo" && phase !== "running"}<p class="demo-info" data-player-chrome>
      {demoHint}
    </p>{/if}
  {#if phase === "ready" && !autostart}<p data-player-chrome>
      El archivo permanece en tu dispositivo. Esta primera versión ejecuta
      {system.formatNote}.
    </p>
    <button class="primary" onclick={start}>Jugar</button>{/if}
  {#if phase === "loading"}<p role="status">Preparando juego…</p>{/if}
  {#if graphicsOpen && phase !== "running"}
    <GraphicsPanel
      video={system.video}
      scaleMode={display.scale}
      aspectMode={display.aspect}
      smooth={display.smooth}
      fallback={scaleFallback}
      note={display.note}
      onchange={(patch) => display.set(patch)}
      onclose={closeGraphics}
    />
  {/if}
  {#if savesOpen && phase !== "running"}
    <SavePanel
      {saves}
      systemId={system.id}
      {battery}
      onsave={(slot) => saveSlot(slot)}
      onload={loadSlot}
      ondelete={deleteSlot}
      onexport={exportSlot}
      onimport={importState}
      onproblem={(message) => (problem = message)}
      onclose={closeSaves}
    />
  {/if}
  <p data-testid="player-phase" class="visually-hidden" aria-live="polite">
    {phase === "running"
      ? "Jugando"
      : phase === "paused"
        ? "En pausa"
        : phase === "error"
          ? "No se pudo continuar"
          : ""}
  </p>

  <p data-testid="save-status" class="visually-hidden" aria-live="polite">
    {saveStatus}
  </p>
  {#if problem}<div
      bind:this={notice}
      class="notice"
      role="alert"
      tabindex="-1"
    >
      {problem}
    </div>{/if}
  <!-- Canvas is a focused keyboard-controlled game surface; Escape releases input capture. -->
  <div bind:this={frameElement} class="frame" class:presenting={frames > 0 || !!resumeOffer}>
    {#if resumeOffer && phase === "paused"}
      <ResumeOffer
        offer={resumeOffer}
        oncontinue={() => loadSlot("auto")}
        onrestart={() => resume()}
      />
    {/if}
    {#if pauseMenu}
      <PauseMenu
        {loadMs}
        {diagnostics}
        {busy}
        savesAvailable={!noStorage}
        onresume={resume}
        onsave={() => saveSlot("1")}
        onsaves={toggleSaves}
        ongraphics={toggleGraphics}
        oncontrols={() => (location.hash = "#controles")}
        onreset={resetConsole}
        onexit={() => close()}
      />
    {:else if fullscreen && phase === "paused" && !resumeOffer}
      <FullscreenPause {busy} onresume={resume} onexit={toggleFullscreen} />
    {/if}
    <div class="game-stage-wrapper">
      <GameStage
        video={system.video}
        label={system.name}
        bind:screen
        bind:fallback={scaleFallback}
        {frames}
        scaleMode={display.scale}
        aspectMode={display.aspect}
        smooth={display.smooth}
      />
    </div>
  </div>
  <PlayerActions
    bind:element={actionsElement}
    bind:resumeButton
    {phase}
    {busy}
    audioReady={sound.ready}
    muted={sound.muted}
    {focusMode}
    {fullscreen}
    {fullscreenAvailable}
    onpause={() => pause()}
    onresume={resume}
    onsave={noStorage ? undefined : () => saveSlot("1")}
    onreset={resetConsole}
    ontap={tapControl}
    onsound={enableSound}
    onmute={() => sound.toggleMute()}
    onfocus={() => (focusMode = !focusMode)}
    onfullscreen={toggleFullscreen}
  />
  {#if toast}<p class="toast" role="status" data-testid="toast">{toast}</p>{/if}
  <DeviceStatus {padStatus} {padConnected} />
  {#if battery && (phase === "paused" || phase === "error")}
    <BackupPanel
      {client}
      systemId={system.id}
      paused={phase === "paused"}
      bind:busy
      onstatus={(message) => (saveStatus = message)}
      onproblem={(message) => (problem = message)}
      onimported={() => {
        frames = 0;
        saveStatus = "Copia importada. Reanuda para reiniciar con ese progreso.";
        problem = "";
      }}
    />
  {/if}

  {#if saveStatus === "Guardado sin confirmar." || exitSaveFailed}<button
      onclick={() => {
        client?.dispose();
        sound.close();
        onclose();
      }}>Cerrar descartando los cambios sin guardar</button
    >{/if}
  {#if phase === "paused" && !pauseMenu}
    <PerformanceDetails {diagnostics} {loadMs} />
  {/if}
  <AboutCore
    {system}
    choice={coreChoice}
    running={runningCore}
    {frameRate}
    onchoose={chooseCore}
  />
</section>

<style>
  .visually-hidden { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
  .storage-note {
    color: var(--gold);
  }
  .notice {
    background: #34202a;
    border: 1px solid var(--coral);
    padding: 14px 18px;
    border-radius: 10px;
    margin: 12px 0;
    overflow-wrap: anywhere;
  }
  :global(body:has(.player.focus-mode)) { overflow: hidden; }
  :global(body:has(.player.focus-mode) header), :global(body:has(.player.focus-mode) footer) { visibility: hidden; }
  .player.focus-mode { position: fixed; inset: 0; z-index: 1000; margin: 0; max-width: none; width: 100%; height: 100dvh; padding: 0; background: #050507; display: flex; flex-direction: column; overflow: hidden; }
  .player.focus-mode:fullscreen { height: 100%; padding: 0; overflow: hidden; }
  .focus-exit { position: absolute; z-index: 3; top: 16px; right: 16px; opacity: .65; min-height: 44px; background: #181b25f0; border: 1px solid #656b7b; }
  .focus-exit:hover, .focus-exit:focus-visible { opacity: 1; }
  @media (prefers-reduced-motion: no-preference) { .focus-exit { transition: opacity 120ms ease-out; } }
  /* Chrome may live in child components (toolbar, panels): match globally. */
  .player.focus-mode :global([data-player-chrome]) { display: none; }
  .frame { margin: 20px auto 16px; padding: 14px; border-radius: 26px; border: 2px solid #619de5aa; box-shadow: 0 0 34px #619de533, inset 0 0 22px #619de514; background: #0a0c12; opacity: .45; }
  .frame.presenting { opacity: 1; }
  /* Leaves room for the title, toolbar and actions so the whole player fits. */
  .game-stage-wrapper { width: 100%; height: clamp(200px, calc(100dvh - 320px), 560px); border-radius: 14px; overflow: hidden; }
  @media (prefers-reduced-motion: no-preference) {
    .frame { transition: opacity 180ms ease-out; }
    .player:not(.focus-mode) { animation: player-enter 180ms ease-out both; }
  }
  @keyframes player-enter {
    from { opacity: 0; transform: translateY(5px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .player.focus-mode .frame, .player:fullscreen .frame { flex: 1; min-height: 0; margin: 0; padding: 0; border: 0; border-radius: 0; box-shadow: none; display: flex; }
  .player.focus-mode .game-stage-wrapper { flex: 1; height: auto; min-height: 0; margin: 0; border-radius: 0; }
  /* Fullscreen: only the game. Chrome stays hidden even in pause; a small
     overlay offers Reanudar and the way out (Escape also exits). */
  .player:fullscreen {
    position: relative;
    width: 100%;
    max-width: none;
    height: 100%;
    margin: 0;
    padding: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    background: #050507;
  }
  .player:fullscreen :global([data-player-chrome]) {
    display: none;
  }
  .player:fullscreen .game-stage-wrapper { flex: 1; min-height: 0; height: auto; margin: 0; border-radius: 0; }
  .player:fullscreen .notice {
    position: absolute;
    z-index: 3;
    top: 16px;
    left: 50%;
    transform: translateX(-50%);
    max-width: min(640px, 90%);
    margin: 0;
  }
  .player:fullscreen .toast {
    position: absolute;
    z-index: 3;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    margin: 0;
    padding: 6px 14px;
    border-radius: 10px;
    background: #0a0c12d9;
  }

  .player {
    margin: 28px auto;
    max-width: 1040px;
  }
  @media (max-width: 640px) {
    .frame {
      padding: 6px;
      border-radius: 16px;
    }
    .game-stage-wrapper {
      height: auto;
      aspect-ratio: 4 / 3;
      min-height: 0;
    }
  }
  p {
    line-height: 1.6;
  }
  [role="alert"] {
    color: var(--coral);
  }
  .frame {
    position: relative;
  }
  .toast {
    text-align: center;
    margin: 8px 0 0;
    color: var(--teal);
    font-size: 14px;
  }
</style>
