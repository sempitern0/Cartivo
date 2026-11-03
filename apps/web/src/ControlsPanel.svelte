<script lang="ts">
  import { onMount } from "svelte";
  import {
    selectPad,
    getPadPreference,
    readKeyboard,
  } from "../../../packages/input/src/preferences.ts";
  import {
    actions,
    defaultKeyboard,
    parseKeyboard,
    allowedKey,
    keyLabel,
    neutral,
    sample,
    keyboardAction,
    standard,
    pressedBindings,
    sameBinding,
    sameDevice,
    parseProfile,
  } from "../../../packages/input/src/nes-input.ts";
  import type {
    KeyboardProfile,
    Action,
    InputState,
    Pad,
    Profile,
  } from "../../../packages/input/src/nes-input.ts";
  import { icons } from "./icons.ts";
  import {
    resumePadNavigation,
    suspendPadNavigation,
  } from "./pad-navigation.ts";
  import {
    buttonNotes,
    controlButtons,
  } from "../../../packages/runtime/src/systems.ts";
  const labels: Record<Action, string> = {
    up: "Arriba",
    down: "Abajo",
    left: "Izquierda",
    right: "Derecha",
    a: "A",
    b: "B",
    select: "Select",
    start: "Start",
    l: "L",
    r: "R",
    x: "X",
    y: "Y",
  };
  let pads = $state<Pad[]>([]);
  let selected = $state(-1);
  let active = $state(false);
  let inputState = $state<InputState>(neutral());
  let message = $state(
    "Conecta un mando y pulsa uno de sus botones para que el navegador lo detecte.",
  );
  let profile = $state.raw<Profile>();
  let deadzone = $state(0.25);
  let target: HTMLButtonElement;
  let capture = $state<Action>();
  let waitingRelease = $state(false);
  // The test and the assignment read the pad: menus must not move meanwhile.
  $effect(() => {
    if (active || capture || keyCapture) suspendPadNavigation("controls");
    else resumePadNavigation("controls");
  });
  let draft: Partial<Profile> = {};
  let held = new Set<string>();
  let last = $state.raw<Pad>();
  let armed = false;
  let frame = 0;
  let gamepadBlocked = false;
  let savedAvailable = $state(false);
  let raw = $state("");
  let autoSelect = true;
  let keyboard = $state<KeyboardProfile>({ ...defaultKeyboard });
  let keyCapture = $state<Action>();
  let connection = $state("Buscando mando…");
  let advancedOpen = $state(false);
  const directions = ["up", "down", "left", "right"] as const;
  // Only the buttons some available console uses, in a fixed order.
  const buttonsRow = controlButtons([
    "a",
    "b",
    "x",
    "y",
    "start",
    "select",
    "l",
    "r",
  ]);
  const notes = buttonNotes((action) => labels[action]);
  const padConnected = $derived(selected !== -1 && !!last);
  const keyboardStore = "cartivo:keyboard:v1";
  function saveKeyboard() {
    try {
      localStorage.setItem(keyboardStore, JSON.stringify(keyboard));
    } catch {
      message += " No se pudo guardar: la asignación solo durará esta sesión.";
    }
  }
  function assignKey(action: Action) {
    pause("Pulsa una tecla para " + labels[action] + ". Escape cancela.");
    keyCapture = action;
    target.focus({ preventScroll: true });
  }
  function resetKeyboard() {
    pause("Teclado restablecido.");
    keyboard = { ...defaultKeyboard };
    saveKeyboard();
  }
  function snapshot(p: Pad | undefined): Pad | undefined {
    return p
      ? {
          index: p.index,
          id: p.id,
          connected: p.connected,
          mapping: p.mapping,
          buttons: [...p.buttons],
          axes: [...p.axes],
        }
      : undefined;
  }
  function pause(reason: string) {
    active = false;
    capture = undefined;
    keyCapture = undefined;
    held.clear();
    inputState = neutral();
    armed = false;
    message = reason;
  }
  function savedKey(p: Pad) {
    return `cartivo:input:v1:${p.id}:${p.buttons.length}:${p.axes.length}`;
  }
  function refreshSaved(p: Pad | undefined) {
    try {
      savedAvailable = !!p && !!localStorage.getItem(savedKey(p));
    } catch {
      savedAvailable = false;
    }
  }
  function choose(manual = true) {
    if (manual) autoSelect = selected !== -1;
    pause("Mando seleccionado. Activa la prueba cuando estés listo.");
    last = snapshot(pads.find((p) => p.index === selected));
    profile = last?.mapping === "standard" ? standard : undefined;
    refreshSaved(last);
    selectPad(last, profile, deadzone);
  }
  function activate() {
    held.clear();
    armed = false;
    inputState = neutral();
    active = true;
    message = "Prueba activa. Suelta todos los controles antes de empezar.";
    target.focus({ preventScroll: true });
  }
  function keydown(event: KeyboardEvent) {
    if (keyCapture) {
      if (event.code === "Tab" || event.code === "Escape") return;
      event.preventDefault();
      if (event.repeat) return;
      if (
        !allowedKey(event.code) ||
        event.ctrlKey ||
        event.altKey ||
        event.metaKey
      ) {
        message =
          "Elige una letra, número, flecha, espacio, Enter o Mayús. Tab y Escape se reservan para salir.";
        return;
      }
      if (actions.some((a) => a !== keyCapture && keyboard[a] === event.code)) {
        message = "Esa tecla ya está asignada. Elige otra.";
        return;
      }
      keyboard = { ...keyboard, [keyCapture]: event.code };
      keyCapture = undefined;
      message = "Tecla asignada. Activa la prueba para comprobarla.";
      saveKeyboard();
      return;
    }
    if (!active || capture || !keyboardAction(event.code, keyboard)) return;
    event.preventDefault();
    if (!event.repeat) held.add(event.code);
  }
  function keyup(event: KeyboardEvent) {
    held.delete(event.code);
    if (active && keyboardAction(event.code, keyboard)) event.preventDefault();
  }
  function beginMapping() {
    if (!last) return;
    pause(
      `Asigna los ${actions.length} controles (L, R, X e Y al final). Escape cancela.`,
    );
    draft = {};
    capture = actions[0];
    waitingRelease = true;
    target.focus({ preventScroll: true });
  }
  function restore() {
    if (!last) return;
    try {
      const value = JSON.parse(localStorage.getItem(savedKey(last)) ?? "null");
      const parsed = parseProfile(value, last);
      if (!parsed) throw Error();
      profile = parsed;
      selectPad(last, profile, deadzone);
      pause(
        "Perfil local aplicado. Comprueba los controles antes de jugar.",
      );
    } catch {
      pause(
        "El perfil no es válido para este mando. Asigna los controles de nuevo.",
      );
    }
  }
  function reset() {
    if (!last) return;
    let removed = true;
    try {
      localStorage.removeItem(savedKey(last));
    } catch {
      removed = false;
    }
    profile = last.mapping === "standard" ? standard : undefined;
    selectPad(last, profile, deadzone);
    refreshSaved(last);
    pause(
      removed
        ? "Asignación restablecida."
        : "Asignación restablecida en esta sesión. No se pudo borrar el perfil almacenado.",
    );
  }
  onMount(() => {
    const sessionPreference = getPadPreference();
    let firstScan = true;
    if (sessionPreference.mode === "keyboard") {
      autoSelect = false;
      selected = -1;
    } else if (sessionPreference.mode === "pad") {
      selected = sessionPreference.index;
    }
    keyboard = readKeyboard();

    const disconnect = (event: GamepadEvent) => {
      if (event.gamepad.index === selected) {
        pause("Mando desconectado. Reconecta y activa la prueba de nuevo.");
        profile = undefined;
        last = undefined;
      }
    };
    const blur = () =>
      pause("Prueba pausada al perder el foco. Actívala para continuar.");
    const visibility = () => {
      if (document.hidden) blur();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape")
        pause("Prueba cancelada. Ningún control permanece pulsado.");
    };
    window.addEventListener("gamepaddisconnected", disconnect);
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("keydown", escape);
    window.addEventListener("keyup", keyup);
    function scan() {
      try {
        pads =
          !gamepadBlocked && typeof navigator.getGamepads === "function"
            ? Array.from(navigator.getGamepads()).filter(
                (p): p is Gamepad => !!p && p.connected,
              )
            : [];
      } catch {
        gamepadBlocked = true;
        pads = [];
        last = undefined;
        profile = undefined;
        pause(
          "El navegador ha bloqueado el acceso al mando. Puedes probar el teclado.",
        );
      }
      connection = !window.isSecureContext
        ? "Usa HTTPS o localhost para acceder al mando."
        : gamepadBlocked
          ? "El navegador ha bloqueado Gamepad API. Revisa los permisos y recarga."
          : typeof navigator.getGamepads !== "function"
            ? "Este navegador no ofrece Gamepad API."
            : pads.length
              ? `${pads.length} mando(s) detectado(s).`
              : "Ningún mando visible para el navegador. Conecta por USB y pulsa un botón del mando con esta pestaña activa.";
      if (!pads.length) selected = -1;
      if (
        autoSelect &&
        pads.length &&
        !pads.some((p) => p.index === selected)
      ) {
        selected = pads[0].index;
        choose(false);
        message = "Mando detectado y seleccionado. Activa la prueba.";
      }
      const pad = pads.find((p) => p.index === selected);
      if (last && !sameDevice(last, pad)) {
        pause(
          "El mando ha cambiado o se ha desconectado. Selecciónalo de nuevo.",
        );
        profile = undefined;
        last = undefined;
      }
      if (pad && !last) {
        last = snapshot(pad);
        profile =
          firstScan &&
          sessionPreference.mode === "pad" &&
          sessionPreference.id === pad.id
            ? sessionPreference.profile
            : pad.mapping === "standard"
              ? standard
              : undefined;
        if (
          firstScan &&
          sessionPreference.mode === "pad" &&
          sessionPreference.id === pad.id
        )
          deadzone = sessionPreference.deadzone;
        refreshSaved(pad);
      }
      firstScan = false;
      if (pad) {
        const pressed = pressedBindings(pad);
        raw =
          pressed
            .map((b) =>
              b.kind === "button"
                ? `Botón ${b.index}`
                : `Eje ${b.index} ${b.direction > 0 ? "+" : "−"}`,
            )
            .join(", ") || "Ningún control pulsado";
        if (capture) {
          if (waitingRelease) {
            if (pressed.length === 0) waitingRelease = false;
          } else if (pressed.length === 1) {
            const binding = pressed[0];
            if (Object.values(draft).some((b) => sameBinding(b, binding))) {
              message = "Ese control ya está asignado. Prueba otro.";
              waitingRelease = true;
            } else {
              draft[capture] = binding;
              const next = actions[actions.indexOf(capture) + 1];
              if (next) {
                capture = next;
                waitingRelease = true;
              } else {
                profile = parseProfile(draft, pad);
                selectPad(pad, profile, deadzone);
                capture = undefined;
                message =
                  "Asignación lista. Activa la prueba para comprobarla.";
                try {
                  localStorage.setItem(savedKey(pad), JSON.stringify(profile));
                  refreshSaved(pad);
                } catch {
                  message +=
                    " No se pudo guardar el perfil; se conserva solo en esta pestaña.";
                }
              }
            }
          }
        }
      } else raw = "";
      if (active) {
        if (!armed) {
          if (
            held.size === 0 &&
            (!pad || pressedBindings(pad, deadzone).length === 0)
          ) {
            armed = true;
            message =
              "Prueba activa. Usa las teclas indicadas en Teclado. Escape o Select+Start para salir.";
          }
        } else {
          inputState = sample(pad, profile, held, deadzone, keyboard);
          // The pause gesture also ends the test, so a pad alone can leave.
          if (inputState.select && inputState.start)
            pause("Prueba detenida. Ningún control permanece pulsado.");
        }
      }
    }
    function poll() {
      scan();
      frame = requestAnimationFrame(poll);
    }
    window.addEventListener("gamepadconnected", scan);
    scan();
    frame = requestAnimationFrame(poll);
    return () => {
      resumePadNavigation("controls");
      cancelAnimationFrame(frame);
      window.removeEventListener("gamepadconnected", scan);
      window.removeEventListener("gamepaddisconnected", disconnect);
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("keydown", escape);
      window.removeEventListener("keyup", keyup);
      held.clear();
    };
  });
</script>

<section class="controls" aria-labelledby="input-title">
  <h2 id="input-title" class="visually-hidden">Prueba y asignación</h2>
  <div class="test card">
    <div class="buttons">
      <button
        class="primary"
        onclick={activate}
        disabled={!!capture || !!keyCapture}>Activar prueba</button
      ><button
        onclick={() => pause("Prueba detenida.")}
        disabled={!active && !capture && !keyCapture}>Detener prueba</button
      >
    </div>
    <!-- A focused region separates emulator input from UI navigation. Tab always remains available. -->
    <button
      type="button"
      class="pad"
      class:armed={active}
      onclick={() => {
        if (!active && !capture && !keyCapture) activate();
      }}
      aria-label="Zona de prueba de controles"
      tabindex="0"
      bind:this={target}
      onkeydown={keydown}
      onblur={() => {
        if (active || capture || keyCapture)
          pause("Prueba pausada. Actívala para continuar.");
      }}
    >
      <span class="pad-hint" aria-hidden="true"
        >{active
          ? "Pulsa tus controles: se iluminan aquí abajo"
          : "Zona de prueba"}</span
      >
      {#each actions as action}<span
          class="visually-hidden"
          data-action={action}
          >{labels[action]}<small
            >{inputState[action] ? "Pulsado" : "Libre"}</small
          ></span
        >{/each}
    </button>
    <p data-testid="input-status" aria-live="polite">{message}</p>
  </div>

  <div class="devices">
    <article class="device card" aria-labelledby="keyboard-title">
      <header>
        <span class="device-icon">{@html icons.keyboard}</span>
        <h3 id="keyboard-title">Teclado activo</h3>
        <span class="ok" aria-hidden="true">{@html icons.check}</span>
      </header>
      <div class="keyboard-art" aria-hidden="true">
        <div class="cluster">
          <span class="cap up" class:lit={inputState.up}
            >{keyLabel(keyboard.up)}</span
          >
          <span class="cap left" class:lit={inputState.left}
            >{keyLabel(keyboard.left)}</span
          >
          <span class="cap down" class:lit={inputState.down}
            >{keyLabel(keyboard.down)}</span
          >
          <span class="cap right" class:lit={inputState.right}
            >{keyLabel(keyboard.right)}</span
          >
        </div>
        <div class="row">
          {#each buttonsRow as action}<span
              class="cap wide"
              class:lit={inputState[action]}
              ><small>{labels[action]}</small>{keyLabel(keyboard[action])}</span
            >{/each}
        </div>
      </div>
      <p class="hint">También funcionan las flechas para moverte.</p>
    </article>
    <article class="device card" aria-labelledby="pad-title">
      <header>
        <span class="device-icon">{@html icons.gamepad}</span>
        <h3 id="pad-title">
          {padConnected ? "Gamepad conectado" : "Sin mando"}
        </h3>
        {#if padConnected}<span class="ok" aria-hidden="true"
            >{@html icons.check}</span
          >{/if}
      </header>
      <svg
        class="pad-art"
        class:idle={!padConnected}
        viewBox="0 0 320 150"
        aria-hidden="true"
        focusable="false"
      >
        <path
          class="shell"
          d="M70 22h180c34 0 58 26 58 60v6c0 30-22 50-48 50-18 0-28-10-38-24l-8-10H106l-8 10c-10 14-20 24-38 24-26 0-48-20-48-50v-6c0-34 24-60 58-60z"
        />
        <g class="dpad">
          <rect class:lit={inputState.up} x="64" y="44" width="22" height="24" rx="4" />
          <rect class:lit={inputState.down} x="64" y="88" width="22" height="24" rx="4" />
          <rect class:lit={inputState.left} x="40" y="68" width="24" height="22" rx="4" />
          <rect class:lit={inputState.right} x="86" y="68" width="24" height="22" rx="4" />
          <rect x="64" y="68" width="22" height="22" />
        </g>
        <rect class="shoulder" class:lit={inputState.l} x="62" y="10" width="56" height="12" rx="6" />
        <rect class="shoulder" class:lit={inputState.r} x="202" y="10" width="56" height="12" rx="6" />
        <rect class="mini" class:lit={inputState.select} x="130" y="74" width="26" height="10" rx="5" />
        <rect class="mini" class:lit={inputState.start} x="164" y="74" width="26" height="10" rx="5" />
        <!-- Face buttons in a diamond, by position: X north, Y west, B south, A east. -->
        <circle class="face" class:lit={inputState.x} cx="249" cy="49" r="13" />
        <circle class="face" class:lit={inputState.y} cx="225" cy="72" r="13" />
        <circle class="face" class:lit={inputState.b} cx="249" cy="95" r="13" />
        <circle class="face" class:lit={inputState.a} cx="273" cy="72" r="13" />
        <text x="249" y="54" text-anchor="middle">X</text>
        <text x="225" y="77" text-anchor="middle">Y</text>
        <text x="249" y="100" text-anchor="middle">B</text>
        <text x="273" y="77" text-anchor="middle">A</text>
      </svg>
      <label for="input-pad" class="pad-label">Mando</label><select
        id="input-pad"
        bind:value={selected}
        onchange={() => choose()}
        ><option value={-1}>Solo teclado</option>{#each pads as pad}<option
            value={pad.index}
            >{pad.id} ({pad.mapping === "standard"
              ? "estándar"
              : "requiere asignación"})</option
          >{/each}</select
      >
      <p class="hint" data-testid="connection-status" aria-live="polite">
        {connection}
      </p>
      {#if selected !== -1 && last}
        <p class="raw">{raw}</p>
        {#if !profile}<p class="hint">
            Este mando necesita asignación manual. El teclado sigue disponible.
          </p>{/if}
        <div class="buttons">
          <button onclick={beginMapping}>Asignar controles</button
          >{#if savedAvailable}<button onclick={restore}
              >Aplicar perfil guardado</button
            >{/if}<button onclick={reset}>Restablecer mando</button>
        </div>
        <label class="deadzone"
          >Zona muerta: {Math.round(deadzone * 100)} %
          <input
            aria-label="Zona muerta"
            type="range"
            min="0.15"
            max="0.6"
            step="0.05"
            bind:value={deadzone}
            oninput={(e) =>
              selectPad(last, profile, Number(e.currentTarget.value))}
          /></label
        >
      {/if}
    </article>
  </div>

  <div class="chips" role="group" aria-label="Asignaciones de teclado">
    <button
      class="chip move"
      aria-expanded={advancedOpen}
      aria-controls="advanced-controls"
      onclick={() => (advancedOpen = !advancedOpen)}
    >
      <span class="mini-dpad" aria-hidden="true"
        ><i>▲</i><i>◀</i><i>▶</i><i>▼</i></span
      >
      <span class="chip-name">Mover</span>
    </button>
    {#each buttonsRow as action}<button
        class="chip"
        aria-label={"Asignar tecla " + labels[action]}
        onclick={() => assignKey(action)}
        ><span class="chip-name" data-chip={action}>{labels[action]}</span
        ><span class="visually-hidden">{" = "}</span><kbd
          >{keyLabel(keyboard[action])}</kbd
        ></button
      >{/each}
  </div>
  {#each notes as note}<p class="hint">{note}</p>{/each}
  <div class="row-end">
    <button class="link" onclick={resetKeyboard}>Restablecer teclado</button>
  </div>

  {#if keyCapture}<p class="capture">
      Pulsa la nueva tecla para <strong>{labels[keyCapture]}</strong>. Escape
      cancela.
    </p>{/if}
  {#if capture}<p class="capture">
      {waitingRelease ? "Suelta todos los controles. " : ""}Pulsa el control
      para: <strong>{labels[capture]}</strong>
    </p>{/if}

  <details class="advanced" id="advanced-controls" bind:open={advancedOpen}>
    <summary>Avanzado</summary>
    <fieldset>
      <legend>Direcciones · pulsa una asignación para cambiarla</legend>
      <div class="buttons">
        {#each directions as action}<button
            aria-label={"Asignar tecla " + labels[action]}
            onclick={() => assignKey(action)}
            >{labels[action]} = {keyLabel(keyboard[action])}</button
          >{/each}
      </div>
    </fieldset>
    <p class="note">
      Algunos navegadores no detectan el mando hasta pulsar un botón. Los
      perfiles permanecen en este dispositivo y se aplican tras confirmarlos.
    </p>
  </details>
</section>

<style>
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
  p {
    color: var(--muted);
    line-height: 1.55;
  }
  .devices {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr));
    gap: 24px;
  }
  .device {
    padding: 22px 24px;
    min-width: 0;
  }
  .device header {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .device h3 {
    margin: 0;
    font-size: 21px;
    font-weight: 650;
  }
  .device-icon {
    display: inline-flex;
    padding: 10px 12px;
    border-radius: 12px;
    background: #232737;
    color: var(--text);
  }
  .ok {
    display: inline-flex;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    align-items: center;
    justify-content: center;
    background: var(--teal);
    color: #0f1a18;
  }
  .ok :global(svg) {
    width: 16px;
    height: 16px;
    stroke-width: 3;
  }
  .keyboard-art {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: center;
    gap: 28px;
    margin: 26px 0 8px;
  }
  .cluster {
    display: grid;
    grid-template-columns: repeat(3, 52px);
    grid-template-rows: repeat(2, 52px);
    gap: 6px;
  }
  .cluster .up {
    grid-column: 2;
    grid-row: 1;
  }
  .cluster .left {
    grid-column: 1;
    grid-row: 2;
  }
  .cluster .down {
    grid-column: 2;
    grid-row: 2;
  }
  .cluster .right {
    grid-column: 3;
    grid-row: 2;
  }
  .row {
    display: grid;
    grid-template-columns: repeat(2, minmax(64px, auto));
    gap: 6px;
  }
  .cap {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 52px;
    padding: 4px 10px;
    border-radius: 9px;
    background: linear-gradient(180deg, #2a2e3d, #1f2230);
    border: 1px solid #3a3f52;
    box-shadow: 0 3px 0 #0c0d13;
    font-weight: 700;
    font-size: 17px;
  }
  .cap small {
    font-size: 10px;
    font-weight: 500;
    color: var(--muted);
  }
  .cap.lit {
    background: #1d3352;
    border-color: var(--blue);
    color: #fff;
    box-shadow:
      0 1px 0 #0c0d13,
      0 0 18px #619de580;
    transform: translateY(2px);
  }
  .hint {
    font-size: 13px;
    margin: 10px 0 0;
  }
  .pad-art {
    display: block;
    width: min(100%, 340px);
    margin: 18px auto 10px;
  }
  .pad-art .shell {
    fill: #20232f;
    stroke: #40c2ae88;
    stroke-width: 2;
  }
  .pad-art.idle .shell {
    stroke: #393c4b;
  }
  .pad-art .dpad rect {
    fill: #11131b;
  }
  .pad-art .mini,
  .pad-art .shoulder {
    fill: #11131b;
  }
  .pad-art .face {
    fill: #11131b;
    stroke: #3a3f52;
    stroke-width: 2;
  }
  .pad-art text {
    fill: var(--muted);
    font-size: 13px;
    font-weight: 700;
  }
  .pad-art .lit {
    fill: var(--teal);
  }
  .pad-label {
    display: block;
    font-size: 13px;
    color: var(--muted);
    margin-top: 8px;
  }
  select {
    display: block;
    width: 100%;
    margin: 6px 0 4px;
    background: var(--surface-2);
    color: var(--text);
    border: 1px solid var(--border);
    padding: 11px;
    border-radius: 10px;
    font: inherit;
  }
  select:focus-visible,
  input:focus-visible,
  .pad:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 4px;
  }
  .buttons {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-top: 12px;
  }
  .chips {
    display: grid;
    grid-template-columns: 1.4fr repeat(4, 1fr);
    gap: 16px;
    margin-top: 28px;
  }
  .chip {
    min-width: 0;
    flex-wrap: wrap;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 14px;
    min-height: 76px;
    border-radius: 16px;
    background: linear-gradient(180deg, #1a1d28, #151720);
    border: 1px solid #2c3040;
  }
  .chip.move[aria-expanded="true"],
  .chip:focus-visible {
    box-shadow: var(--glow);
  }
  .chip-name {
    font-weight: 700;
    font-size: 18px;
  }
  [data-chip="a"],
  [data-chip="b"] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    border: 2px solid var(--teal);
    color: var(--teal);
  }
  [data-chip="b"] {
    border-color: var(--coral);
    color: var(--coral);
  }
  [data-chip="start"],
  [data-chip="select"] {
    padding: 6px 14px;
    border: 2px solid var(--text);
    border-radius: 999px;
    font-size: 13px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  kbd {
    font: inherit;
    font-weight: 600;
    padding: 8px 12px;
    border-radius: 8px;
    background: #2a2e3d;
    border: 1px solid #3f4457;
    border-left: 1px solid #3f4457;
  }
  .mini-dpad {
    display: grid;
    grid-template-columns: repeat(3, 20px);
    grid-template-rows: repeat(3, 20px);
    font-size: 11px;
  }
  .mini-dpad i {
    font-style: normal;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1.5px solid var(--text);
    border-radius: 5px;
  }
  .mini-dpad i:nth-child(1) {
    grid-area: 1 / 2;
  }
  .mini-dpad i:nth-child(2) {
    grid-area: 2 / 1;
  }
  .mini-dpad i:nth-child(3) {
    grid-area: 2 / 3;
  }
  .mini-dpad i:nth-child(4) {
    grid-area: 3 / 2;
  }
  .row-end {
    display: flex;
    justify-content: flex-end;
  }
  .link {
    background: transparent;
    border: 0;
    color: var(--blue);
    font-size: 14px;
    padding: 8px 0;
  }
  /* The test bar sits right above the drawings that light up, so the
     player sees both at once without scrolling. */
  .test {
    margin: 0 0 20px;
    padding: 14px 18px;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 6px 16px;
  }
  .test .buttons {
    margin-top: 0;
  }
  .test p {
    grid-column: 1 / -1;
    margin: 0;
    font-size: 14px;
  }
  @media (max-width: 640px) {
    .test {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .pad {
    width: 100%;
    margin: 0;
    min-height: 56px;
    border-style: dashed;
    color: var(--muted);
    background: transparent;
  }
  .pad.armed {
    border-color: var(--blue);
    color: var(--text);
  }
  .raw,
  .note {
    font-size: 12px;
    overflow-wrap: anywhere;
  }
  .capture {
    color: var(--gold);
  }
  .deadzone {
    display: block;
    margin-top: 14px;
    color: var(--muted);
    font-size: 14px;
  }
  .deadzone input {
    display: block;
    width: min(100%, 320px);
    margin-top: 8px;
  }
  .advanced {
    margin-top: 24px;
  }
  .advanced summary {
    cursor: pointer;
    color: var(--muted);
  }
  fieldset {
    border: 1px solid var(--border);
    border-radius: 12px;
    margin: 16px 0;
    padding: 16px;
    min-width: 0;
  }
  legend {
    color: var(--muted);
    font-size: 13px;
  }
  @media (max-width: 760px) {
    .chips {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    .chip {
      gap: 8px;
      padding: 10px 8px;
      min-height: 64px;
    }
    [data-chip="start"],
    [data-chip="select"] {
      padding: 5px 10px;
      letter-spacing: 0.02em;
    }
    .chip.move {
      grid-column: 1 / -1;
    }
  }
</style>
