<script lang="ts">
  import { onMount, tick } from "svelte";
  import GameStage from "./GameStage.svelte";
  import type { ScaleMode, AspectMode } from "../../../packages/media/src/display-scaler.ts";
  import { NesClient } from "../../../packages/runtime/src/nes-client.ts";
  import audioWorkletUrl from "./audio.worklet.ts?worker&url";
  import { GameAudio } from "../../../packages/media/src/audio.ts";
  import {
    neutral,
    sample,
    keyboardAction,
    standard,
    sameDevice,
    type Pad,
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
  }: { file?: File; visible?: boolean; autostart?: boolean; onclose: () => void } = $props();
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
  let padStatus = $state("Teclado disponible");
  let busy = $state(false);
  let viewport = $state.raw<HTMLElement>();
  let fullscreen = $state(false);
  let fullscreenAvailable = $state(false);
  let focusMode = $state(false);
  let scaleMode = $state<ScaleMode>("fit");
  let aspectMode = $state<AspectMode>("corrected");
  let graphicsOpen = $state(false);
  let resumeButton = $state.raw<HTMLButtonElement>();
  let screen = $state.raw<HTMLCanvasElement>();
  let importInput = $state.raw<HTMLInputElement>();
  let client: NesClient | undefined;
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
    // Resume is invoked directly by the user's Jugar gesture, before awaiting the worker.
    void audio
      .open(new URL(audioWorkletUrl, location.href))
      .then(() => {
        audioReady = true;
      })
      .catch(() => {
        audio?.close();
        audio = undefined;
        audioReady = false;
        problem = "Audio no disponible. Puedes continuar sin sonido.";
      });
    client = new NesClient(
      new Worker(new URL("./nes.worker.ts", import.meta.url), {
        type: "module",
      }),
    );
    try {
      const r = await client.request("load", file ? { file } : { demo: true });
      if (!active) return;
      battery = !!r.battery;
      saveStatus = r.recovered
        ? "Partida recuperada desde la generación anterior."
        : battery
          ? "Guardado automático preparado."
          : "Este cartucho no usa guardado de partida.";
      phase = "paused";
      await resume();
    } catch (e) {
      client?.dispose();
      if (active) fail(e);
    }
  }
  async function resume() {
    if (phase !== "paused" || busy || !visible) return;
    try {
      await audio?.resume();
    } catch {
      problem = "No se pudo reactivar el sonido.";
    }
    if (!active || !visible) return;
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
      padStatus = "Mando conectado · P1";
    }
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
          new ImageData(new Uint8ClampedArray(r.pixels), 256, 240),
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
    if (e.code === "KeyF" && !e.repeat) {
      e.preventDefault();
      e.stopPropagation();
      focusMode = !focusMode;
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
    e.preventDefault();
    e.stopPropagation();
    if (keyboardAction(e.code, keyboard) && !e.repeat) held.add(e.code);
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
  async function close() {
    if (phase === "loading") {
      client?.dispose();
      audio?.close();
      onclose();
      return;
    }
    if (busy) return;
    if (phase === "running") await pause();
    if (saveStatus === "Guardado sin confirmar.") {
      problem =
        "Exporta una copia antes de cerrar: el guardado local no se ha confirmado.";
      return;
    }
    client?.dispose();
    audio?.close();
    onclose();
  }
  onMount(() => {
    fullscreenAvailable = !!document.fullscreenEnabled;
    if (autostart) void start();
    const fullscreenChange = () => {
      const was = fullscreen;
      fullscreen = document.fullscreenElement === viewport;
      if (was && !fullscreen) void pause();
    };
    const focus = (e: FocusEvent) => {
      if (phase === "running" && visible && e.target !== screen)
        screen?.focus({ preventScroll: true });
    };
    const pointer = (e: PointerEvent) => {
      if (phase !== "running" || !visible || e.target === screen) return;
      e.preventDefault();
      if (
        !(
          e.target instanceof Element &&
          e.target.closest("[data-player-action]")
        )
      )
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
      if (document.hidden) void pause();
    };
    const up = (e: KeyboardEvent) => held.delete(e.code);
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("keyup", up);
    return () => {
      active = false;
      cancelAnimationFrame(loop);
      held.clear();
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
  aria-label="Reproductor NES"
>
  <div class="heading" data-player-chrome>
    <div>
      <p class="badge">NES</p>
      <h1>{file?.name ?? "Demo de controles"}</h1>
    </div>
    <button data-player-action onclick={close} disabled={busy}
      >{phase === "loading" ? "Cancelar carga" : "Cerrar juego"}</button
    >
  </div>
  {#if !file}<p class="demo-info" data-player-chrome>
      WASD o flechas para moverte · K/L para A/B.
    </p>{/if}
  {#if phase === "ready" && !autostart}<p data-player-chrome>
      El archivo permanece en tu dispositivo. Esta primera versión ejecuta
      cartuchos iNES NTSC (mappers 0–4).
    </p>
    <button class="primary" onclick={start}>Jugar</button>{/if}
  {#if phase === "loading"}<p role="status">Preparando juego…</p>{/if}
  <div class="buttons player-actions" data-player-chrome>
    {#if phase === "running"}<button data-player-action onclick={() => pause()}
        >Pausar juego</button
      >{/if}
    {#if phase === "paused"}<button
        bind:this={resumeButton}
        class="primary"
        onclick={resume}
        disabled={busy}>Reanudar juego</button
      >{/if}
    {#if audioReady}<button
        data-player-action
        aria-pressed={muted}
        onclick={() => {
          muted = !muted;
          audio?.mute(muted);
        }}>{muted ? "Activar sonido" : "Silenciar"}</button
      >{/if}
    <a data-player-action href="#controles">Configurar controles</a>
    <button data-player-action onclick={() => { focusMode = !focusMode; }} aria-pressed={focusMode}>Modo Focus</button>
    <button data-player-action onclick={() => { graphicsOpen = !graphicsOpen; }} aria-expanded={graphicsOpen}>Gráficos</button>
    {#if fullscreenAvailable}<button
        data-player-action
        onclick={toggleFullscreen}
        >{fullscreen
          ? "Salir de pantalla completa"
          : "Pantalla completa"}</button
      >{/if}
  </div>
  {#if graphicsOpen && phase !== "running"}<fieldset class="graphics-menu">
    <legend>Presentación de vídeo</legend>
    <label>Escalado <select bind:value={scaleMode}><option value="fit">Ajustar</option><option value="integer">Píxel entero</option><option value="corrected-integer">4:3 entero (NES)</option></select></label>
    <label>Aspecto <select bind:value={aspectMode}><option value="corrected">4:3 corregido</option><option value="native">Píxeles originales</option></select></label>
  </fieldset>{/if}
  <p data-testid="player-phase" class="visually-hidden" aria-live="polite">
    {phase === "running"
      ? "Jugando"
      : phase === "paused"
        ? "En pausa"
        : phase === "error"
          ? "No se pudo continuar"
          : ""}
  </p>

  <p data-testid="save-status" class="visually-hidden" aria-live="polite">{saveStatus}</p>
  {#if problem}<div
      bind:this={notice}
      class="notice"
      role="alert"
      tabindex="-1"
    >
      {problem}
    </div>{/if}
  <!-- Canvas is a focused keyboard-controlled game surface; Escape releases input capture. -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex a11y_no_noninteractive_element_interactions -->
  <div class="game-stage-wrapper"><GameStage bind:screen {frames} {scaleMode} {aspectMode} /></div>
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
    <p class="secondary">
      Núcleo JSNES 2.1.0 · JavaScript en Worker. <a
        href="/licenses/jsnes-Apache-2.0.txt"
        target="_blank"
        rel="noreferrer">Licencia y atribución</a
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
  .player.focus-mode [data-player-chrome], .player.focus-mode > details { display: none; }
  .game-stage-wrapper { width: 100%; height: min(65vh, 660px); min-height: 200px; margin: 20px auto; }
  .player.focus-mode .game-stage-wrapper { flex: 1; height: auto; min-height: 0; margin: 0; }
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
  .player:fullscreen h1 {
    font-size: 20px;
    margin: 8px 0;
    max-width: 70vw;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .player.playing:fullscreen .demo-info,
  .player.playing:fullscreen > details {
    display: none;
  }
  .player:fullscreen .game-stage-wrapper { flex: 1; min-height: 0; height: auto; margin: 0; }
  .player:fullscreen > details {
    flex: none;
  }

  .player {
    margin: 40px auto;
    max-width: 780px;
  }
  .heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }
  h1 {
    font-size: 28px;
    overflow-wrap: anywhere;
  }
  .badge {
    font-size: 11px;
    letter-spacing: 1px;
    color: var(--teal);
  }
  p {
    line-height: 1.6;
  }
  .graphics-menu { display: flex; flex-wrap: wrap; gap: 12px; border: 1px solid var(--border); border-radius: 12px; padding: 12px; }
  .graphics-menu label { display: flex; gap: 8px; align-items: center; }
  .graphics-menu select { background: var(--surface); color: var(--text); padding: 9px; border-radius: 8px; border: 1px solid var(--border); }
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
</style>
