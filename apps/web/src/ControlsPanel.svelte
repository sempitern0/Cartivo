<script lang="ts">
  import { onMount } from "svelte";
  import {
    actions,
    defaultKeyboard,
    parseKeyboard,
    allowedKey,
    keyLabel,
    neutral,
    sample,
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
  const labels: Record<Action, string> = {
    up: "Arriba",
    down: "Abajo",
    left: "Izquierda",
    right: "Derecha",
    a: "A",
    b: "B",
    select: "Select",
    start: "Start",
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
    target.focus();
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
  }
  function activate() {
    held.clear();
    armed = false;
    inputState = neutral();
    active = true;
    message = "Prueba activa. Suelta todos los controles antes de empezar.";
    target.focus();
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
    if (!active || capture || !Object.values(keyboard).includes(event.code))
      return;
    event.preventDefault();
    if (!event.repeat) held.add(event.code);
  }
  function keyup(event: KeyboardEvent) {
    held.delete(event.code);
    if (active && Object.values(keyboard).includes(event.code))
      event.preventDefault();
  }
  function beginMapping() {
    if (!last) return;
    pause("Asigna los ocho controles. Escape cancela.");
    draft = {};
    capture = actions[0];
    waitingRelease = true;
    target.focus();
  }
  function restore() {
    if (!last) return;
    try {
      const value = JSON.parse(localStorage.getItem(savedKey(last)) ?? "null");
      const parsed = parseProfile(value, last);
      if (!parsed) throw Error();
      profile = parsed;
      pause(
        "Perfil local aplicado. Comprueba los ocho controles antes de jugar.",
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
    refreshSaved(last);
    pause(
      removed
        ? "Asignación restablecida."
        : "Asignación restablecida en esta sesión. No se pudo borrar el perfil almacenado.",
    );
  }
  onMount(() => {
    try {
      const saved = localStorage.getItem(keyboardStore);
      if (saved) {
        const parsed = parseKeyboard(JSON.parse(saved));
        if (parsed) keyboard = parsed;
        else
          message =
            "Perfil de teclado inválido; se usan las teclas predeterminadas.";
      }
    } catch {
      message =
        "No se pudo recuperar el teclado guardado; se usan las teclas predeterminadas.";
    }

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
        profile = pad.mapping === "standard" ? standard : undefined;
        refreshSaved(pad);
      }
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
              "Prueba activa. Usa las teclas indicadas en Teclado. Escape para salir.";
          }
        } else inputState = sample(pad, profile, held, deadzone, keyboard);
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

<section aria-labelledby="input-title">
  <h2 id="input-title">Prueba y asignación</h2>
  <p>
    Comprueba tu teclado o mando antes de jugar. Prueba los botones y cambia las
    asignaciones a tu gusto. Perfil actual: NES · jugador 1.
  </p>
  <p data-testid="connection-status" aria-live="polite">{connection}</p>
  <label for="input-pad">Mando</label><select
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
  {#if selected !== -1 && last}
    <p class="raw">{raw}</p>
    {#if !profile}<p>
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
      /></label
    >
  {/if}
  <fieldset>
    <legend>Teclado · pulsa una asignación para cambiarla</legend>
    <div class="buttons">
      {#each actions as action}<button
          aria-label={"Asignar tecla " + labels[action]}
          onclick={() => assignKey(action)}
          >{labels[action]} = {keyLabel(keyboard[action])}</button
        >{/each}
    </div>
    <button onclick={resetKeyboard}>Restablecer teclado</button>
  </fieldset>
  {#if keyCapture}<p class="capture">
      Pulsa la nueva tecla para <strong>{labels[keyCapture]}</strong>. Escape
      cancela.
    </p>{/if}
  {#if capture}<p class="capture">
      {waitingRelease ? "Suelta todos los controles. " : ""}Pulsa el control
      para: <strong>{labels[capture]}</strong>
    </p>{/if}
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
    {#each actions as action}<span
        data-action={action}
        class:pressed={inputState[action]}
        >{labels[action]}<small
          >{inputState[action] ? "Pulsado" : "Libre"}</small
        ></span
      >{/each}
  </button>
  <p data-testid="input-status" aria-live="polite">{message}</p>
  <p class="note">
    El navegador puede ocultar mandos hasta que pulses un botón. Los perfiles se
    guardan solo aquí y requieren aplicación explícita al reconectar. No se
    envían identificadores.
  </p>
</section>

<style>
  fieldset {
    border: 1px solid var(--border);
    border-radius: 12px;
    margin: 20px 0;
    padding: 16px;
    min-width: 0;
  }
  legend {
    color: var(--muted);
    font-size: 13px;
  }
  fieldset > button {
    margin-top: 12px;
  }
  section {
    margin-top: 32px;
    padding-top: 16px;
    border-top: 1px solid var(--border);
  }
  p {
    color: var(--muted);
    line-height: 1.6;
  }
  h2 {
    font-size: 20px;
  }
  label {
    display: block;
    margin: 16px 0;
  }
  select {
    display: block;
    width: 100%;
    max-width: 620px;
    margin: 8px 0 16px;
    background: var(--surface);
    color: var(--text);
    border: 1px solid var(--border);
    padding: 12px;
    border-radius: 10px;
    font: inherit;
  }
  select:focus-visible,
  input:focus-visible,
  .pad:focus-visible {
    outline: 3px solid var(--gold);
    outline-offset: 4px;
  }
  .buttons {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }
  .pad {
    width: 100%;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin: 20px 0;
    padding: 8px;
    border-radius: 12px;
  }
  .pad span {
    background: var(--surface);
    border: 1px solid var(--border);
    padding: 14px 8px;
    border-radius: 10px;
    text-align: center;
  }
  .pad .pressed {
    background: var(--teal);
    color: var(--bg);
    border-color: var(--teal);
  }
  small {
    display: block;
    font-size: 11px;
    margin-top: 6px;
  }
  .raw,
  .note {
    font-size: 12px;
    overflow-wrap: anywhere;
  }
  .capture {
    color: var(--gold);
  }
  .deadzone input {
    display: block;
    width: min(100%, 320px);
    margin-top: 10px;
  }
  @media (max-width: 400px) {
    .pad {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
