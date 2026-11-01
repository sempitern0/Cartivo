<script lang="ts">
  import { onMount, tick } from "svelte";
  import GameStage from "./GameStage.svelte";
  import PlayerToolbar from "./PlayerToolbar.svelte";
  import type { ScaleMode, AspectMode } from "../../../packages/media/src/display-scaler.ts";
  import {
    defaultDisplay,
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
  import {
    neutral,
    sample,
    keyboardAction,
    standard,
    sameDevice,
    type Pad,
    type Action,
  } from "../../../packages/input/src/nes-input.ts";
  import {
    getPadPreference,
    readKeyboard,
  } from "../../../packages/input/src/preferences.ts";
  let {
    file,
    visible = true,
    autostart = false,
    onclose,
    onreplace,
    system,
  }: {
    /** System being played (packages/runtime/src/systems.ts). */
    system: SystemInfo;
    file?: File;
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
  let savesPanel = $state.raw<HTMLElement>();
  let resumeOffer = $state.raw<StateMeta>();
  let confirmLoad = $state<StateSlot>();
  let toast = $state("");
  let toastTimer = 0;
  const slotNames: Record<StateSlot, string> = {
    auto: "Al salir",
    "1": "Ranura 1",
    "2": "Ranura 2",
    "3": "Ranura 3",
  };
  const allSlots: StateSlot[] = ["auto", "1", "2", "3"];
  const slotOf = (slot: StateSlot) => saves.find((s) => s.slot === slot);
  const when = (time: number) =>
    new Intl.DateTimeFormat("es", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(time);
  function notify(message: string) {
    toast = message;
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => (toast = ""), 2600);
  }
  function preview(canvas: HTMLCanvasElement, data?: Uint8ClampedArray) {
    const draw = (pixels?: Uint8ClampedArray) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      if (pixels && pixels.length === 128 * 120 * 4)
        ctx.putImageData(
          new ImageData(new Uint8ClampedArray(pixels), 128, 120),
          0,
          0,
        );
      else ctx.clearRect(0, 0, 128, 120);
    };
    draw(data);
    return { update: draw };
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
    confirmLoad = undefined;
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
      await tick();
      savesPanel?.querySelector<HTMLButtonElement>("button")?.focus({
        preventScroll: true,
      });
    }
  }
  function closeSaves() {
    savesOpen = false;
    confirmLoad = undefined;
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
  let graphicsPanel = $state.raw<HTMLElement>();
  const scaleOptions: { value: ScaleMode; label: string; hint: string }[] = [
    { value: "fit", label: "Ajustar", hint: "Ocupa todo el espacio disponible" },
    { value: "integer", label: "Píxel entero", hint: "Píxeles idénticos; puede dejar bordes" },
    { value: "corrected-integer", label: "4:3 entero", hint: "Proporción de televisor con píxel entero" },
  ];
  const aspectOptions: { value: AspectMode; label: string; hint: string }[] = [
    { value: "corrected", label: "4:3 de televisor", hint: "Como se veía en la época" },
    { value: "native", label: "Píxeles cuadrados", hint: "Imagen original de 256 × 240" },
  ];
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
    if (graphicsOpen) {
      await tick();
      graphicsPanel
        ?.querySelector<HTMLInputElement>("input:checked")
        ?.focus({ preventScroll: true });
    }
  }
  function closeGraphics() {
    graphicsOpen = false;
    graphicsButton?.focus({ preventScroll: true });
  }
  let resumeButton = $state.raw<HTMLButtonElement>();
  let screen = $state.raw<HTMLCanvasElement>();
  let importInput = $state.raw<HTMLInputElement>();
  let client: EmulatorClient | undefined;
  let audio: GameAudio | undefined;
  let active = true;
  let loop = 0;
  let time = 0;
  let remainder = 0;
  let armed = false;
  let lastPad: Pad | undefined;
  let chosenIndex: number | undefined;
  let selectedOnce = false;
  const held = new Set<string>();
  const virtual = new Set<Action>();
  let virtualRelease = 0;
  let keyboard = readKeyboard();
  function fail(e: unknown) {
    phase = "error";
    if (battery) saveStatus = "Guardado sin confirmar.";
    problem = e instanceof Error ? e.message : "No se pudo iniciar la sesión";
    audio?.pause();
    held.clear();
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
      const r = await client.request(
        "load",
        file
          ? { file, system: system.id, core: coreChoice }
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
      // Offer to continue from the exit snapshot instead of starting over.
      resumeOffer = saves.find((s) => s.slot === "auto");
      if (!resumeOffer) await resume();
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
    keyboard = readKeyboard();
    held.clear();
    armed = false;
    lastPad = undefined;
    selectedOnce = false;
    chosenIndex = undefined;
    time = performance.now();
    remainder = 0;
    phase = "running";
    await tick();
    screen?.scrollIntoView({ block: "center" });
    screen?.focus({ preventScroll: true });
    loop = requestAnimationFrame(pump);
  }
  async function pause() {
    if (phase !== "running") return;
    phase = "paused";
    cancelAnimationFrame(loop);
    held.clear();
    virtual.clear();
    clearTimeout(virtualRelease);
    armed = false;
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
    const pref = getPadPreference();
    let pads: Pad[] = [];
    try {
      pads = Array.from(navigator.getGamepads?.() ?? []).filter(
        (p): p is Gamepad => !!p && p.connected,
      );
    } catch {
      padStatus = "Mando bloqueado por el navegador; teclado disponible.";
    }
    if (!selectedOnce) {
      chosenIndex =
        pref.mode === "pad"
          ? pref.index
          : pref.mode === "auto"
            ? pads.find((p) => p.mapping === "standard")?.index
            : undefined;
      selectedOnce = true;
    }
    // Allow hot-plug without switching away from an already chosen controller.
    if (chosenIndex === undefined && pref.mode === "auto")
      chosenIndex = pads.find((p) => p.mapping === "standard")?.index;
    const pad = pads.find((p) => p.index === chosenIndex);
    if (lastPad && !sameDevice(lastPad, pad)) {
      padStatus = "Mando desconectado o sustituido. Compruébalo en Controles.";
      await pause();
      return;
    }
    if (pad) {
      if (pref.mode === "pad" && pad.id !== pref.id) {
        padStatus = "El mando ha cambiado. Selecciónalo en Controles.";
        await pause();
        return;
      }
      lastPad = {
        index: pad.index,
        id: pad.id,
        mapping: pad.mapping,
        connected: pad.connected,
        buttons: [...pad.buttons],
        axes: [...pad.axes],
      };
      padStatus = "Mando conectado";
    }
    padConnected = !!pad;
    if (!pad && padStatus === "Mando conectado") padStatus = "Sin mando";
    const profile =
      pref.mode === "pad"
        ? pref.profile
        : pad?.mapping === "standard"
          ? standard
          : undefined;
    if (pad && !profile)
      padStatus = "Configura este mando en Controles; teclado disponible.";
    const input = sample(
      pad,
      profile,
      held,
      pref.mode === "pad" ? pref.deadzone : 0.25,
      keyboard,
    );
    for (const action of virtual) input[action] = true;
    if (!armed) {
      if (!Object.values(input).some(Boolean)) armed = true;
      time = now;
      loop = requestAnimationFrame(pump);
      return;
    }
    remainder += ((now - time) * 60) / 1000;
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
    if (keyboardAction(e.code, keyboard) && !e.repeat) held.add(e.code);
  }
  function tapControl(action: "start" | "select") {
    if (phase !== "running") return;
    clearTimeout(virtualRelease);
    virtual.clear();
    virtual.add(action);
    virtualRelease = window.setTimeout(() => virtual.clear(), 180);
  }
  async function resetConsole() {
    if (phase === "running") await pause();
    if (phase !== "paused" || busy || saveStatus === "Guardado sin confirmar.")
      return;
    busy = true;
    try {
      const result = await client!.request("reset");
      frames = result.frames ?? 0;
      virtual.clear();
      held.clear();
      saveStatus = result.saved ? "Partida guardada antes de reiniciar." : saveStatus;
      problem = "";
    } catch (error) {
      problem = error instanceof Error ? error.message : "No se pudo reiniciar la consola";
    } finally {
      busy = false;
    }
  }
  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement === viewport)
        await document.exitFullscreen();
      else {
        focusMode = true;
        await viewport?.requestFullscreen();
      }
    } catch (e) {
      problem =
        "No se pudo activar pantalla completa. Puedes seguir jugando en esta ventana.";
    }
  }
  $effect(() => {
    if (phase !== "running" || !visible) return;
    const old = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = old;
    };
  });
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
            format: "cartivo-nrom-sram-v1",
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
      if (backup.size > 40000) throw Error("Copia demasiado grande");
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
      if (phase === "running" && visible && !e.ctrlKey) e.preventDefault();
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
    const up = (e: KeyboardEvent) => held.delete(e.code);
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("keyup", up);
    return () => {
      active = false;
      cancelAnimationFrame(loop);
      held.clear();
      virtual.clear();
      clearTimeout(virtualRelease);
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
  class:focus-mode={focusMode && phase === "running"}
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
    title={file?.name ?? "Demo de controles"}
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
  {#if !file && phase !== "running"}<p class="demo-info" data-player-chrome>
      WASD o flechas para moverte · L = A · K = B.
    </p>{/if}
  {#if phase === "ready" && !autostart}<p data-player-chrome>
      El archivo permanece en tu dispositivo. Esta primera versión ejecuta
      {system.formatNote}.
    </p>
    <button class="primary" onclick={start}>Jugar</button>{/if}
  {#if phase === "loading"}<p role="status">Preparando juego…</p>{/if}
  {#if graphicsOpen && phase !== "running"}
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <section
      id="graphics-panel"
      class="graphics card"
      data-player-chrome
      aria-labelledby="graphics-title"
      bind:this={graphicsPanel}
      onkeydown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          closeGraphics();
        }
      }}
    >
      <header>
        <h2 id="graphics-title">Gráficos</h2>
        <p>Los cambios se ven al momento sobre la imagen en pausa.</p>
        <button
          class="close icon-button"
          aria-label="Cerrar gráficos"
          onclick={closeGraphics}>{@html icons.close}</button
        >
      </header>
      <fieldset>
        <legend>Escalado</legend>
        <div class="options">
          {#each scaleOptions as option}<label
              class="option"
              class:checked={scaleMode === option.value}
            >
              <input
                type="radio"
                name="scale"
                value={option.value}
                checked={scaleMode === option.value}
                onchange={() => setDisplay({ scale: option.value })}
              />
              <svg class="diagram" viewBox="0 0 80 50" aria-hidden="true">
                <rect class="screen" x="1" y="1" width="78" height="48" rx="5" />
                {#if option.value === "fit"}<rect class="image" x="13" y="4" width="54" height="42" rx="2" />
                {:else if option.value === "integer"}<rect class="image" x="22" y="9" width="36" height="32" rx="2" /><path class="px" d="M22 17h36M22 25h36M22 33h36M31 9v32M40 9v32M49 9v32" />
                {:else}<rect class="image" x="19" y="9" width="42" height="32" rx="2" /><path class="px" d="M19 17h42M19 25h42M19 33h42M29.5 9v32M40 9v32M50.5 9v32" />{/if}
              </svg>
              <span class="name">{option.label}</span>
              <span class="hint">{option.hint}</span>
            </label>{/each}
        </div>
      </fieldset>
      <fieldset>
        <legend>Proporción</legend>
        <div class="options two">
          {#each aspectOptions as option}<label
              class="option"
              class:checked={aspectMode === option.value}
            >
              <input
                type="radio"
                name="aspect"
                value={option.value}
                checked={aspectMode === option.value}
                onchange={() => setDisplay({ aspect: option.value })}
              />
              <svg class="diagram" viewBox="0 0 80 50" aria-hidden="true">
                <rect class="screen" x="1" y="1" width="78" height="48" rx="5" />
                {#if option.value === "corrected"}<rect class="image" x="12" y="5" width="56" height="40" rx="2" />
                {:else}<rect class="image" x="17" y="5" width="46" height="40" rx="2" />{/if}
              </svg>
              <span class="name">{option.label}</span>
              <span class="hint">{option.hint}</span>
            </label>{/each}
        </div>
      </fieldset>
      <label class="switch">
        <input
          type="checkbox"
          role="switch"
          checked={smooth}
          onchange={(e) => setDisplay({ smooth: e.currentTarget.checked })}
        />
        <span class="track" aria-hidden="true"></span>
        <span>
          <span class="name">Suavizado</span>
          <span class="hint"
            >Difumina los bordes de los píxeles. Desactivado conserva el aspecto
            original.</span
          >
        </span>
      </label>
      <footer>
        <p aria-live="polite">
          {scaleFallback
            ? "Ese escalado no cabe en esta ventana: se usa Ajustar hasta que haya espacio."
            : displayNote}
        </p>
        <button
          onclick={() => setDisplay({ ...defaultDisplay })}
          disabled={scaleMode === defaultDisplay.scale &&
            aspectMode === defaultDisplay.aspect &&
            smooth === defaultDisplay.smooth}>Restablecer</button
        >
        <button class="primary" onclick={closeGraphics}>Listo</button>
      </footer>
    </section>
  {/if}
  {#if savesOpen && phase !== "running"}
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <section
      id="saves-panel"
      class="graphics saves card"
      data-player-chrome
      aria-labelledby="saves-title"
      bind:this={savesPanel}
      onkeydown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          closeSaves();
        }
      }}
    >
      <header>
        <h2 id="saves-title">Partidas</h2>
        <p>
          Guarda el momento exacto del juego. F5 guarda en la ranura 1 y F9 la
          carga.{battery ? " La partida interna del cartucho se guarda aparte, automáticamente." : ""}
        </p>
        <button
          class="close icon-button"
          aria-label="Cerrar partidas"
          onclick={closeSaves}>{@html icons.close}</button
        >
      </header>
      <ul class="slots">
        {#each allSlots as slot}
          {@const meta = slotOf(slot)}
          <li class="slot" data-slot={slot}>
            <canvas
              width="128"
              height="120"
              class="thumb"
              class:empty={!meta}
              aria-hidden="true"
              use:preview={meta?.preview}
            ></canvas>
            <div class="slot-info">
              <span class="name">{slotNames[slot]}</span>
              <span class="hint"
                >{meta
                  ? `${when(meta.createdAt)} · ${coreLabel(system.id, meta.core)}`
                  : slot === "auto"
                    ? "Se guarda al salir del juego"
                    : "Vacía"}</span
              >
            </div>
            <div class="slot-actions">
              {#if slot !== "auto"}<button
                  onclick={() => saveSlot(slot)}
                  aria-label={`Guardar en ${slotNames[slot]}`}>Guardar aquí</button
                >{/if}
              {#if meta}
                {#if confirmLoad === slot}<button
                    class="primary"
                    onclick={() => loadSlot(slot)}
                    aria-label={`Confirmar carga de ${slotNames[slot]}`}
                    >Confirmar carga</button
                  >{:else}<button
                    onclick={() => (confirmLoad = slot)}
                    aria-label={`Cargar ${slotNames[slot]}`}>Cargar</button
                  >{/if}
                <button
                  class="link-danger"
                  onclick={() => deleteSlot(slot)}
                  aria-label={`Borrar ${slotNames[slot]}`}>Borrar</button
                >
              {/if}
            </div>
          </li>
        {/each}
      </ul>
      {#if confirmLoad}<p class="hint" role="status">
          Cargar sustituye el progreso actual que no hayas guardado.
        </p>{/if}
    </section>
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
  <div class="frame" class:presenting={frames > 0 || !!resumeOffer}>
    {#if resumeOffer && phase === "paused"}
      <div class="resume-offer" role="dialog" aria-labelledby="resume-title">
        <canvas
          width="128"
          height="120"
          class="thumb"
          aria-hidden="true"
          use:preview={resumeOffer.preview}
        ></canvas>
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
  <div class="buttons player-actions" data-player-chrome>
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
  .game-stage-wrapper { width: 100%; height: min(60vh, 560px); min-height: 200px; border-radius: 14px; overflow: hidden; }
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
  .player:fullscreen {
    background: var(--bg);
    width: 100%;
    max-width: none;
    height: 100%;
    margin: 0;
    padding: 16px 24px;
    overflow: auto;
    display: flex;
    flex-direction: column;
  }
  .player:fullscreen p {
    margin: 4px 0;
    font-size: 12px;
  }
  .player.playing:fullscreen .demo-info,
  .player.playing:fullscreen > details {
    display: none;
  }
  .player:fullscreen .game-stage-wrapper { flex: 1; min-height: 0; height: auto; margin: 0; border-radius: 0; }
  .player:fullscreen > details {
    flex: none;
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
  .graphics { margin: 16px 0 0; padding: 20px 22px; }
  .graphics header { display: grid; grid-template-columns: 1fr auto; column-gap: 16px; align-items: start; }
  .graphics h2 { margin: 0; font-size: 20px; }
  .graphics header p { grid-column: 1; margin: 4px 0 0; color: var(--muted); font-size: 14px; }
  .graphics .close { grid-column: 2; grid-row: 1 / span 2; width: 44px; padding: 0; background: transparent; }
  .graphics fieldset { border: 0; padding: 0; margin: 18px 0 0; min-width: 0; }
  .graphics legend { padding: 0; margin-bottom: 10px; font-size: 13px; font-weight: 600; color: var(--muted); }
  .options { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
  .options.two { grid-template-columns: repeat(2, minmax(0, 1fr)); max-width: 66%; }
  .option { position: relative; display: grid; gap: 4px; padding: 14px; border-radius: 14px; border: 1px solid var(--border); background: var(--surface-2); cursor: pointer; }
  .option:hover { border-color: #565c72; }
  .option.checked { border-color: var(--blue); box-shadow: var(--glow); }
  /* The invisible input covers the whole card so pointer and keyboard both hit it. */
  .option input, .switch input { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: pointer; z-index: 1; }
  .option:has(input:focus-visible), .switch:has(input:focus-visible) { outline: 3px solid var(--focus); outline-offset: 3px; }
  .diagram { width: 100%; max-width: 120px; height: auto; margin-bottom: 6px; }
  .diagram .screen { fill: #0b0d13; stroke: #3a3f52; stroke-width: 1.5; }
  .diagram .image { fill: #24324b; stroke: var(--blue); stroke-width: 1.5; }
  .option.checked .diagram .image { fill: #2b4f7d; }
  .diagram .px { stroke: #619de566; stroke-width: 0.8; }
  .graphics .name { font-weight: 650; }
  .graphics .hint { display: block; font-size: 13px; color: var(--muted); line-height: 1.4; }
  .switch { position: relative; display: flex; align-items: flex-start; gap: 14px; margin-top: 20px; padding: 14px; border-radius: 14px; border: 1px solid var(--border); background: var(--surface-2); cursor: pointer; }
  .track { flex: none; position: relative; width: 44px; height: 26px; border-radius: 999px; background: #2a2e3d; border: 1px solid var(--border); margin-top: 2px; }
  .track::after { content: ""; position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: var(--muted); }
  .switch:has(input:checked) .track { background: var(--blue); border-color: var(--blue); }
  .switch:has(input:checked) .track::after { left: 21px; background: #111218; }
  @media (prefers-reduced-motion: no-preference) { .track::after { transition: left 120ms ease-out; } }
  .graphics footer { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 18px; }
  .graphics footer p { flex: 1; min-width: 200px; margin: 0; font-size: 13px; color: var(--muted); }
  @media (max-width: 640px) {
    .options, .options.two { grid-template-columns: minmax(0, 1fr); max-width: none; }
    .option { grid-template-columns: 72px 1fr; column-gap: 12px; align-items: center; }
    .option .diagram { grid-row: 1 / span 2; margin: 0; }
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
  .thumb {
    width: 128px;
    height: 120px;
    border-radius: 8px;
    background: #050507;
    border: 1px solid var(--border);
    image-rendering: pixelated;
  }
  .thumb.empty {
    opacity: 0.4;
  }
  .slots {
    list-style: none;
    padding: 0;
    margin: 16px 0 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 220px), 1fr));
    gap: 12px;
  }
  .slot {
    display: grid;
    gap: 10px;
    padding: 12px;
    border-radius: 14px;
    border: 1px solid var(--border);
    background: var(--surface-2);
  }
  .slot .thumb {
    width: 100%;
    height: auto;
    aspect-ratio: 16 / 15;
  }
  .slot-info {
    display: grid;
    gap: 2px;
  }
  .slot-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .slot-actions button {
    min-height: 38px;
    padding: 6px 12px;
    font-size: 14px;
  }
  .link-danger {
    background: transparent;
    border-color: transparent;
    color: var(--coral);
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
