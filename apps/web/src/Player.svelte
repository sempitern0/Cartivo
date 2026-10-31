<script lang="ts">
  import { onMount, tick } from "svelte";
  import { NesClient } from "../../../packages/runtime/src/nes-client.ts";
  import audioWorkletUrl from "./audio.worklet.ts?worker&url";
  import { GameAudio } from "../../../packages/media/src/audio.ts";
  import {
    neutral,
    sample,
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
    onclose,
  }: { file?: File; visible?: boolean; onclose: () => void } = $props();
  let phase = $state<"ready" | "loading" | "running" | "paused" | "error">(
    "ready",
  );
  let problem = $state("");
  let saveStatus = $state("");
  let battery = $state(false);
  let muted = $state(false);
  let audioReady = $state(false);
  let frames = $state(0);
  let padStatus = $state("Teclado disponible");
  let busy = $state(false);
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
    const audioLoad = audio
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
      await audioLoad;
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
      await audioLoad;
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
    screen?.focus();
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
    }
  }
  $effect(() => {
    if (!visible && phase === "running") void pause();
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
    if (e.code === "Escape") {
      e.preventDefault();
      void pause();
      return;
    }
    if (phase === "running" && Object.values(keyboard).includes(e.code)) {
      e.preventDefault();
      if (!e.repeat) held.add(e.code);
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
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("keyup", up);
    };
  });
</script>

<section class="player" aria-label="Reproductor NES">
  <div class="heading">
    <div>
      <p class="badge">NES · EXPERIMENTAL</p>
      <h1>{file?.name ?? "Demo de controles"}</h1>
    </div>
    <button onclick={close} disabled={busy}
      >{phase === "loading" ? "Cancelar carga" : "Cerrar juego"}</button
    >
  </div>
  {#if !file}<p>
      Cruceta o flechas: mueve el cuadrado. A: cambia el color y guarda ese
      progreso. B: emite un tono. Usa tus asignaciones de Controles.
    </p>{/if}
  {#if phase === "ready"}<p>
      El archivo permanece en tu dispositivo. Esta primera versión ejecuta
      cartuchos NROM NTSC.
    </p>
    <button class="primary" onclick={start}>Jugar</button>{/if}
  {#if phase === "loading"}<p role="status">Preparando juego…</p>{/if}
  <!-- Canvas is a focused keyboard-controlled game surface; Tab exits normally. -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex a11y_no_noninteractive_element_interactions -->
  <canvas
    bind:this={screen}
    width="256"
    height="240"
    tabindex="0"
    aria-label="Pantalla del juego NES. Escape para pausar."
    onkeydown={keydown}
    onblur={() => {
      void pause();
    }}
    data-frames={frames}
  ></canvas>
  <div class="buttons">
    {#if phase === "running"}<button onclick={() => pause()}
        >Pausar juego</button
      >{/if}
    {#if phase === "paused"}<button
        class="primary"
        onclick={resume}
        disabled={busy}>Reanudar juego</button
      >{/if}
    {#if audioReady}<button
        aria-pressed={muted}
        onclick={() => {
          muted = !muted;
          audio?.mute(muted);
        }}>{muted ? "Activar sonido" : "Silenciar"}</button
      >{/if}
    <a href="#controles">Configurar controles</a>
  </div>
  <p data-testid="player-phase">
    {phase === "running"
      ? "Jugando"
      : phase === "paused"
        ? "En pausa"
        : phase === "error"
          ? "No se pudo continuar"
          : ""}
  </p>
  <p class="secondary">{padStatus}</p>
  <p data-testid="save-status">{saveStatus}</p>
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
  {#if problem}<p role="alert">{problem}</p>{/if}
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
  canvas {
    display: block;
    width: 100%;
    aspect-ratio: 4/3;
    height: auto;
    background: #000;
    image-rendering: pixelated;
    border-radius: 8px;
    margin: 24px 0;
  }
  canvas:focus-visible {
    outline: 3px solid var(--gold);
    outline-offset: 4px;
  }
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
