<script lang="ts">
  import { onMount, tick } from "svelte";
  import GameStage from "./GameStage.svelte";
  import PlayerToolbar from "./PlayerToolbar.svelte";
  import GraphicsPanel from "./GraphicsPanel.svelte";
  import SavePanel from "./SavePanel.svelte";
  import SnapshotThumb from "./SnapshotThumb.svelte";
  import { slotNames, when } from "./saves.ts";
  import {
    backupFormat,
    MAX_BACKUP_FILE,
  } from "../../../packages/storage/src/formats.ts";
  import type { ScaleMode, AspectMode } from "../../../packages/media/src/display-scaler.ts";
  import {
    readDisplay,
    writeDisplay,
    type DisplayPreferences,
  } from "../../../packages/media/src/display-preferences.ts";
  import { EmulatorClient } from "../../../packages/runtime/src/client.ts";
  import {
    acceptFor,
    coreLabel,
    type SystemInfo,
  } from "../../../packages/runtime/src/systems.ts";
  import { icons } from "./icons.ts";
  import {
    readCore,
    writeCore,
  } from "../../../packages/runtime/src/core-preference.ts";
  import type {
    StateMeta,
    StateSlot,
  } from "../../../packages/storage/src/states.ts";
  import audioWorkletUrl from "./audio.worklet.ts?worker&url";
  import { GameAudio } from "../../../packages/media/src/audio.ts";
  import { InputCapture } from "../../../packages/input/src/capture.ts";
  import {
    readRemember,
    writeRemember,
    type LibraryEntry,
  } from "../../../packages/storage/src/library.ts";
  import {
    getPadPreference,
    readKeyboard,
  } from "../../../packages/input/src/preferences.ts";
  let {
    file,
    stored,
    resume: continueNow = false,
    visible = true,
    autostart = false,
    onclose,
    onreplace,
    system,
  }: {
    /** System being played (packages/runtime/src/systems.ts). */
    system: SystemInfo;
    file?: File;
    /** A remembered game, read from this device by the Worker (ADR-012). */
    stored?: LibraryEntry;
    /** Continue from «Al salir» directly, without the offer. */
    resume?: boolean;
    visible?: boolean;
    autostart?: boolean;
    onclose: () => void;
    /** Called after this session closed safely, to start another ROM. */
    onreplace?: (file: File) => void;
  } = $props();
  let phase = $state<"ready" | "loading" | "running" | "paused" | "error">(
    "ready",
  );
  let notice = $state.raw<HTMLDivElement>();
  let problem = $state("");
  let saveStatus = $state("");
  let battery = $state(false);
  let muted = $state(false);
  let audioReady = $state(false);
  let frames = $state(0);
  let padStatus = $state("Sin mando");
  let padConnected = $state(false);
  let romInput = $state.raw<HTMLInputElement>();
  // The player is remounted for each game ({#key} in App), so the system
  // is fixed for its lifetime and reading its initial value is intended.
  // svelte-ignore state_referenced_locally
  let coreChoice = $state<string>(readCore(system));
  // «Partidas»: full-console snapshots (ADR-009).
  let saves = $state.raw<StateMeta[]>([]);
  let savesOpen = $state(false);
  let savesButton = $state.raw<HTMLButtonElement>();
  let resumeOffer = $state.raw<StateMeta>();
  // One-time question: remember games on this device? (ADR-012)
  let askRemember = $state(false);
  async function answerRemember(yes: boolean) {
    askRemember = false;
    const kept = writeRemember(yes);
    if (!yes) {
      notify("No se recordarán juegos. Puedes cambiarlo en Tus juegos.");
      return;
    }
    if (!kept) notify("El navegador no permite guardar esta preferencia.");
    try {
      const r = await client?.request("library-add");
      if (r?.libraryError) problem = r.libraryError;
      else if (r?.remembered)
        notify("Juego recordado: podrás continuar desde el inicio.");
    } catch (e) {
      problem = e instanceof Error ? e.message : "No se pudo recordar el juego";
    }
  }
  let toast = $state("");
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
      if (!quiet) notify(`Partida guardada en ${slotNames[slot].toLowerCase()}.`);
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
  const savedDisplay = readDisplay(system.id);
  let scaleMode = $state<ScaleMode>(savedDisplay.scale);
  let aspectMode = $state<AspectMode>(savedDisplay.aspect);
  let smooth = $state(savedDisplay.smooth);
  let scaleFallback = $state(false);
  let displayNote = $state("");
  let graphicsOpen = $state(false);
  let graphicsButton = $state.raw<HTMLButtonElement>();
  function setDisplay(patch: Partial<DisplayPreferences>) {
    const next = { scale: scaleMode, aspect: aspectMode, smooth, ...patch };
    scaleMode = next.scale;
    aspectMode = next.aspect;
    smooth = next.smooth;
    displayNote = writeDisplay(system.id, next)
      ? `Se recordará para ${system.name} en este dispositivo.`
      : "Aplicado solo en esta sesión: el navegador no permite guardarlo.";
  }
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
  let importInput = $state.raw<HTMLInputElement>();
  let client: EmulatorClient | undefined;
  let audio: GameAudio | undefined;
  let active = true;
  let loop = 0;
  let time = 0;
  let remainder = 0;
  const controls = new InputCapture(
    readKeyboard(),
    () => navigator.getGamepads?.() ?? [],
    getPadPreference,
  );
  function fail(e: unknown) {
    phase = "error";
    if (battery) saveStatus = "Guardado sin confirmar.";
    problem = e instanceof Error ? e.message : "No se pudo iniciar la sesión";
    audio?.pause();
    controls.clear();
  }
  async function start() {
    if (phase !== "ready") return;
    phase = "loading";
    problem = "";
    audio = new GameAudio();
    // Audio is optional: the ROM must start even if autoplay is blocked.
    const pendingAudio = audio;
    void pendingAudio
      .open(new URL(audioWorkletUrl, location.href))
      .then(() => {
        if (active && audio === pendingAudio) audioReady = true;
      })
      .catch(() => {
        pendingAudio.close();
        if (audio === pendingAudio) {
          audio = undefined;
          audioReady = false;
        }
      });
    client = new EmulatorClient(
      new Worker(new URL("./emulator.worker.ts", import.meta.url), {
        type: "module",
      }),
    );
    try {
      const choice = readRemember();
      const r = await client.request(
        "load",
        file
          ? { file, system: system.id, core: coreChoice, remember: choice === true }
          : stored
            ? { stored: stored.hash, system: system.id, core: coreChoice }
            : { demo: true, system: system.id, core: coreChoice },
      );
      runningCore = r.core;
      if (!active) return;
      battery = !!r.battery;
      saves = r.states ?? [];
      saveStatus = r.recovered
        ? "Partida recuperada desde la generación anterior."
        : battery
          ? "Guardado automático preparado."
          : "Este cartucho no tiene batería; usa Partidas para guardar.";
      phase = "paused";
      if (r.libraryError) problem = r.libraryError;
      askRemember = !!file && choice === undefined && !r.remembered;
      const exit = saves.find((s) => s.slot === "auto");
      // «Continuar» from the home screen goes straight to the exit snapshot.
      if (continueNow && exit) await loadSlot("auto");
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
    // Audio unlock can remain pending until a user gesture; never await it.
    void audio?.resume().catch(() => {
      audioReady = false;
    });
    if (!active || !visible) return;
    // Playing without choosing «Continuar» starts over from power-on.
    resumeOffer = undefined;
    controls.start(readKeyboard());
    time = performance.now();
    remainder = 0;
    phase = "running";
    await tick();
    (actionsElement ?? screen)?.scrollIntoView({ block: "nearest" });
    screen?.focus({ preventScroll: true });
    loop = requestAnimationFrame(pump);
  }
  async function pause() {
    if (phase !== "running") return;
    phase = "paused";
    cancelAnimationFrame(loop);
    controls.clear();
    audio?.pause();
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
    if (!reading.ready) {
      time = now;
      loop = requestAnimationFrame(pump);
      return;
    }
    remainder += ((now - time) * system.frameRate) / 1000;
    time = now;
    if (remainder > 12) {
      problem =
        "La ejecución se ha retrasado. Reanuda para continuar sin acelerar el juego.";
      await pause();
      return;
    }
    const count = Math.min(3, Math.floor(remainder));
    if (!count) {
      loop = requestAnimationFrame(pump);
      return;
    }
    remainder -= count;
    try {
      const r = await client!.request("advance", { count, input });
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
      if (r.saveError) {
        problem = r.saveError;
        await pause();
        return;
      }
      if (r.saved) saveStatus = "Partida guardada en este dispositivo.";
      if (phase === "running" && visible && r.audio) audio?.push(r.audio);
    } catch (e) {
      fail(e);
      return;
    }
    if (phase === "running") loop = requestAnimationFrame(pump);
  }
  function keydown(e: KeyboardEvent) {
    if (phase !== "running" || !visible) return;
    if (e.code === "KeyF" && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      e.stopPropagation();
      focusMode = !focusMode;
      return;
    }
    if ((e.code === "F5" || e.code === "F9") && !e.repeat) {
      // Never let F5 reload the page during a game.
      e.preventDefault();
      e.stopPropagation();
      if (e.code === "F5") void saveSlot("1");
      else void loadSlot("1");
      return;
    }
    if (e.code === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      if (document.fullscreenElement === viewport)
        void document.exitFullscreen().catch(() => {});
      void pause();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    // Never block native activation of game toolbar controls or form fields.
    // Only gameplay focus (canvas/body) is captured.
    if (
      e.target instanceof Element &&
      e.target.closest("button, a, input, select, textarea, summary, [role=button]")
    ) return;
    e.preventDefault();
    e.stopPropagation();
    controls.keyDown(e.code, e.repeat);
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
    let restarted = false;
    try {
      const result = await client!.request("reset");
      frames = result.frames ?? 0;
      controls.clear();
      // Never leave the previous game's last frame on screen.
      screen?.getContext("2d")?.clearRect(0, 0, screen.width, screen.height);
      saveStatus = result.saved ? "Partida guardada antes de reiniciar." : saveStatus;
      problem = "";
      resumeOffer = undefined;
      restarted = true;
    } catch (error) {
      problem = error instanceof Error ? error.message : "No se pudo reiniciar la consola";
    } finally {
      busy = false;
    }
    // A reset is a power cycle: the console starts running again.
    if (restarted) {
      notify("Consola reiniciada.");
      await resume();
    }
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
    if (audioReady) return;
    audio?.close();
    const next = new GameAudio();
    audio = next;
    try {
      await next.open(new URL(audioWorkletUrl, location.href));
      if (!active || audio !== next) {
        next.close();
        return;
      }
      audioReady = true;
      if (phase === "running") void next.resume();
    } catch {
      next.close();
      if (audio === next) audio = undefined;
      problem = "El navegador no ha podido activar el sonido.";
    }
  }
  async function exportSave() {
    if ((phase !== "paused" && phase !== "error") || busy) return;
    busy = true;
    try {
      const r = await client!.request("save");
      if (!r.save) throw Error("No hay partida exportable");
      const blob = new Blob(
        [
          JSON.stringify({
            format: backupFormat(system.id),
            game: r.hash,
            sha256: r.saveHash,
            bytes: Array.from(r.save),
          }),
        ],
        { type: "application/json" },
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "cartivo-partida.json";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      saveStatus = "Copia exportada.";
    } catch (e) {
      problem = e instanceof Error ? e.message : "Exportación fallida";
    } finally {
      busy = false;
    }
  }
  async function importSave(e: Event) {
    const input = e.target as HTMLInputElement;
    const backup = input.files?.[0];
    input.value = "";
    if (!backup || phase !== "paused" || busy) return;
    busy = true;
    try {
      if (backup.size > MAX_BACKUP_FILE) throw Error("Copia demasiado grande");
      await client!.request("import", {
        backup: JSON.parse(await backup.text()),
      });
      frames = 0;
      saveStatus = "Copia importada. Reanuda para reiniciar con ese progreso.";
      problem = "";
    } catch (e) {
      problem = e instanceof Error ? e.message : "Importación fallida";
    } finally {
      busy = false;
    }
  }
  // Closing always goes through the same path: pause (SRAM flush confirmed by
  // the worker), then dispose. `next` starts another ROM afterwards.
  async function close(next?: File) {
    const finish = () => (next && onreplace ? onreplace(next) : onclose());
    if (phase === "loading") {
      client?.dispose();
      audio?.close();
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
    if (phase === "paused" && !resumeOffer) await saveSlot("auto", true);
    if (saveStatus === "Guardado sin confirmar.") {
      problem =
        "Exporta una copia antes de cerrar: el guardado local no se ha confirmado.";
      return;
    }
    client?.dispose();
    audio?.close();
    finish();
  }
  async function chooseRom() {
    if (busy) return;
    if (phase === "running") await pause();
    romInput?.click();
  }
  function romChosen(event: Event) {
    const input = event.target as HTMLInputElement;
    const next = input.files?.[0];
    input.value = "";
    if (next) void close(next);
  }
  onMount(() => {
    fullscreenAvailable = !!document.fullscreenEnabled;
    if (autostart) void start();
    const fullscreenChange = () => {
      const was = fullscreen;
      fullscreen = document.fullscreenElement === viewport;
      if (was && !fullscreen) void pause();
    };
    // Explicit player controls are real interactive elements. Do not steal
    // their pointer/focus events, or click activation can fail in Firefox.
    const isPlayerAction = (target: EventTarget | null) =>
      target instanceof Element && !!target.closest("[data-player-action]");
    const focus = (e: FocusEvent) => {
      if (
        phase === "running" && visible && e.target !== screen &&
        !isPlayerAction(e.target)
      ) screen?.focus({ preventScroll: true });
    };
    const pointer = (e: PointerEvent) => {
      if (phase !== "running" || !visible || e.target === screen) return;
      if (isPlayerAction(e.target)) return;
      // Keep the game captured when clicking outside the player; never
      // cancel the button events belonging to the player itself.
      e.preventDefault();
      e.stopImmediatePropagation();
      screen?.focus({ preventScroll: true });
    };
    const wheel = (e: WheelEvent) => {
      // Over the picture the wheel belongs to the game; elsewhere the page
      // scrolls so the controls below stay reachable.
      if (
        phase === "running" && visible && !e.ctrlKey &&
        e.target instanceof Node && frameElement?.contains(e.target)
      )
        e.preventDefault();
    };
    document.addEventListener("keydown", keydown, true);
    document.addEventListener("focusin", focus, true);
    document.addEventListener("pointerdown", pointer, true);
    document.addEventListener("wheel", wheel, {
      passive: false,
      capture: true,
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
    const up = (e: KeyboardEvent) => controls.keyUp(e.code);
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("keyup", up);
    return () => {
      active = false;
      cancelAnimationFrame(loop);
      controls.clear();
      audio?.close();
      client?.dispose();
      document.removeEventListener("keydown", keydown, true);
      document.removeEventListener("focusin", focus, true);
      document.removeEventListener("pointerdown", pointer, true);
      document.removeEventListener("wheel", wheel, true);
      document.removeEventListener("fullscreenchange", fullscreenChange);
      if (document.fullscreenElement === viewport)
        void document.exitFullscreen().catch(() => {});
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("keyup", up);
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
>
  {#if focusMode && phase === "running"}
    <button
      type="button"
      class="focus-exit"
      data-player-action
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
    title={file?.name ?? stored?.name ?? "Demo de controles"}
    {phase}
    {busy}
    {graphicsOpen}
    {savesOpen}
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
    onchange={romChosen}
    hidden
  />

  {#if !file && !stored && phase !== "running"}<p class="demo-info" data-player-chrome>
      WASD o flechas para moverte · L = A · K = B.
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
      {scaleMode}
      {aspectMode}
      {smooth}
      fallback={scaleFallback}
      note={displayNote}
      onchange={setDisplay}
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
      <div class="resume-offer" role="dialog" aria-labelledby="resume-title">
        <SnapshotThumb pixels={resumeOffer.preview} />
        <div>
          <h2 id="resume-title">Continuar donde lo dejaste</h2>
          <p class="hint">Guardada el {when(resumeOffer.createdAt)}</p>
          <div class="buttons">
            <button class="primary" onclick={() => loadSlot("auto")}
              >Continuar</button
            ><button onclick={() => resume()}>Empezar de nuevo</button>
          </div>
        </div>
      </div>
    {/if}
    {#if fullscreen && phase === "paused" && !resumeOffer}
      <div class="fullscreen-pause" role="group" aria-label="En pausa">
        <button class="primary" onclick={resume} disabled={busy}
          >Reanudar juego</button
        ><button onclick={toggleFullscreen}>Salir de pantalla completa</button>
      </div>
    {/if}
    <div class="game-stage-wrapper">
      <GameStage
        video={system.video}
        label={system.name}
        bind:screen
        bind:fallback={scaleFallback}
        {frames}
        {scaleMode}
        {aspectMode}
        {smooth}
      />
    </div>
  </div>
  <div bind:this={actionsElement} class="buttons player-actions" data-player-chrome>
    {#if phase === "running"}<button
        data-player-action
        onclick={() => pause()}>Pausar juego</button
      ><button data-player-action onclick={() => tapControl("select")}
        >Select · Q</button
      ><button data-player-action onclick={() => tapControl("start")}
        >Start · Enter</button
      >{/if}
    {#if phase === "paused"}<button
        bind:this={resumeButton}
        class="primary"
        onclick={resume}
        disabled={busy}>Reanudar juego</button
      ><button
        data-player-action
        onclick={resetConsole}
        disabled={busy}>Reiniciar consola</button
      >{/if}
    {#if !audioReady && phase === "running"}<button
        data-player-action
        onclick={enableSound}>Activar sonido</button
      >{/if}
    {#if audioReady}<button
        data-player-action
        aria-pressed={muted}
        onclick={() => {
          muted = !muted;
          audio?.mute(muted);
        }}>{muted ? "Activar sonido" : "Silenciar"}</button
      >{/if}
    <button
      data-player-action
      class:focus-selected={focusMode}
      onclick={() => {
        focusMode = !focusMode;
      }}
      aria-pressed={focusMode}
      aria-label={focusMode ? "Desactivar Focus" : "Activar Focus"}
      >{focusMode ? "Focus activado" : "Activar Focus"}</button
    >
    {#if fullscreenAvailable}<button
        data-player-action
        onclick={toggleFullscreen}
        >{fullscreen
          ? "Salir de pantalla completa"
          : "Pantalla completa"}</button
      >{/if}
    <a data-player-action href="#controles">Configurar controles</a>
  </div>
  {#if askRemember}<div
      class="remember-ask"
      role="group"
      aria-labelledby="remember-ask-text"
      data-player-chrome
    >
      <p id="remember-ask-text">
        ¿Recordar tus juegos en este dispositivo para continuar con un clic?
      </p>
      <button data-player-action onclick={() => answerRemember(true)}
        >Sí, recordar</button
      ><button data-player-action onclick={() => answerRemember(false)}
        >No</button
      >
    </div>{/if}
  {#if toast}<p class="toast" role="status" data-testid="toast">{toast}</p>{/if}
  <ul class="status" data-player-chrome aria-label="Dispositivos">
    <li data-testid="pad-status" class:on={padConnected}>
      {@html icons.gamepad}<span>{padStatus}</span>
    </li>
    <li data-testid="keyboard-status" class="on">
      {@html icons.keyboard}<span>Teclado conectado</span>
    </li>
  </ul>
  {#if battery && (phase === "paused" || phase === "error")}<details>
      <summary>Copias de partida</summary>
      <p>
        Importar reinicia el juego con la copia seleccionada. Se conserva una
        generación anterior del guardado local.
      </p>
      <div class="buttons">
        <button onclick={exportSave} disabled={busy}>Exportar partida</button
        ><button
          onclick={() => importInput?.click()}
          disabled={busy || phase === "error"}>Importar partida</button
        >
      </div>
      <input
        bind:this={importInput}
        type="file"
        accept="application/json,.json"
        onchange={importSave}
        hidden
      />
    </details>{/if}

  {#if saveStatus === "Guardado sin confirmar."}<button
      onclick={() => {
        client?.dispose();
        audio?.close();
        onclose();
      }}>Cerrar descartando los cambios sin guardar</button
    >{/if}
  <details>
    <summary>Acerca de esta prueba</summary>
    <fieldset class="core-choice">
      <legend>Núcleo {system.name}</legend>
      {#each system.cores as option (option.id)}<label
          ><input
            type="radio"
            name="core"
            value={option.id}
            checked={coreChoice === option.id}
            onchange={() => chooseCore(option.id)}
          />
          {option.label}{#if runningCore === option.id}<span class="secondary"
              >{" · en uso"}</span
            >{/if}</label
        >{/each}
      {#if runningCore && coreChoice !== runningCore}<p
          class="secondary"
          data-testid="core-pending"
        >
          Se usará al abrir el próximo juego o con Cargar ROM.
        </p>{/if}
    </fieldset>
    <p class="secondary">
      Los núcleos se ejecutan en un Worker y comparten la memoria de batería
      del cartucho.
      {#each system.cores.flatMap((c) => c.licenses) as license (license.href)}<a
          href={license.href}
          target="_blank"
          rel="noreferrer">{license.name}</a
        >
        ·
      {/each}<a href="/licenses/NOTICE.txt" target="_blank" rel="noreferrer"
        >Avisos de terceros</a
      >
    </p>
  </details>
</section>

<style>
  .visually-hidden { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
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
  .player.focus-mode :global([data-player-chrome]), .player.focus-mode > details { display: none; }
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
  .player:fullscreen :global([data-player-chrome]),
  .player:fullscreen > details {
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
  .fullscreen-pause {
    position: absolute;
    inset: 0;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    gap: 12px;
    background: #050507b3;
  }

  .player {
    margin: 28px auto;
    max-width: 1040px;
  }
  .player-actions {
    justify-content: center;
  }
  .player-actions button,
  .player-actions a {
    min-height: 40px;
    padding: 8px 14px;
    font-size: 14px;
  }
  .status {
    list-style: none;
    padding: 0;
    margin: 18px 0 6px;
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: 10px 0;
    color: var(--muted);
    font-size: 15px;
  }
  .status li {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 0 22px;
  }
  .status li + li {
    border-left: 1px solid var(--border);
  }
  .status li.on {
    color: var(--text);
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
  .focus-selected { border-color: var(--teal); color: var(--teal); background: #17312e; }
  .buttons {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    align-items: center;
  }
  .secondary {
    font-size: 12px;
    color: var(--muted);
  }
  [role="alert"] {
    color: var(--coral);
  }
  summary {
    cursor: pointer;
    padding: 12px 0;
  }
  .frame {
    position: relative;
  }
  .resume-offer {
    position: absolute;
    inset: 0;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 22px;
    flex-wrap: wrap;
    padding: 20px;
    border-radius: 14px;
    background: #0a0c12e6;
  }
  .resume-offer h2 {
    margin: 0;
    font-size: 22px;
  }
  .remember-ask {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    gap: 8px 12px;
    margin: 12px 0 0;
    font-size: 14px;
  }
  .remember-ask p {
    margin: 0;
  }
  .remember-ask button {
    min-height: 36px;
    padding: 6px 14px;
    font-size: 14px;
  }
  .toast {
    text-align: center;
    margin: 8px 0 0;
    color: var(--teal);
    font-size: 14px;
  }
  .core-choice {
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 12px 16px;
    display: grid;
    gap: 8px;
  }
  .core-choice legend {
    font-size: 13px;
    color: var(--muted);
  }
  .core-choice label {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 32px;
  }
</style>
