// Player 1 input for a running game: held keys, the chosen gamepad and
// on-screen taps merged into one InputState per frame. DOM listeners, Tab,
// Escape and the accessible toolbar stay in the UI; this class keeps the
// state and the decisions, so it runs (and is tested) without a browser.
import {
  keyboardAction,
  neutral,
  sameDevice,
  sample,
  standard,
  type Action,
  type InputState,
  type KeyboardProfile,
  type Pad,
} from "./nes-input.ts";
import type { PadPreference } from "./preferences.ts";

export type InputReading = {
  input: InputState;
  /** False until every control has been released once (no stuck input). */
  ready: boolean;
  /** The chosen pad disappeared or changed: the game must pause. */
  lost: boolean;
  connected: boolean;
  status: string;
};

const TAP_MS = 180;

export class InputCapture {
  status = "Sin mando";
  #keyboard: KeyboardProfile;
  #pads: () => Iterable<Pad | null>;
  #preference: () => PadPreference;
  #held = new Set<string>();
  #virtual = new Set<Action>();
  #release: ReturnType<typeof setTimeout> | undefined;
  #ready = false;
  #lastPad: Pad | undefined;
  #chosen: number | undefined;
  #selected = false;

  constructor(
    keyboard: KeyboardProfile,
    pads: () => Iterable<Pad | null>,
    preference: () => PadPreference,
  ) {
    this.#keyboard = keyboard;
    this.#pads = pads;
    this.#preference = preference;
  }

  /** New play session: fresh profile, pad chosen again, release required. */
  start(keyboard: KeyboardProfile) {
    this.#keyboard = keyboard;
    this.#lastPad = undefined;
    this.#selected = false;
    this.#chosen = undefined;
    this.clear();
  }

  /** Neutral input (pause, reset, teardown); controls must be released. */
  clear() {
    this.#held.clear();
    this.#virtual.clear();
    clearTimeout(this.#release);
    this.#ready = false;
  }

  /** Records a game key; returns false for keys that are not bound. */
  keyDown(code: string, repeat = false) {
    if (!keyboardAction(code, this.#keyboard)) return false;
    if (!repeat) this.#held.add(code);
    return true;
  }

  keyUp(code: string) {
    this.#held.delete(code);
  }

  /** Presses an on-screen control (Start/Select) for a short moment. */
  tap(action: Action) {
    clearTimeout(this.#release);
    this.#virtual.clear();
    this.#virtual.add(action);
    this.#release = setTimeout(() => this.#virtual.clear(), TAP_MS);
  }

  read(): InputReading {
    const pref = this.#preference();
    let pads: Pad[] = [];
    try {
      pads = [...this.#pads()].filter((p): p is Pad => !!p && p.connected);
    } catch {
      this.status = "Mando bloqueado por el navegador; teclado disponible.";
    }
    const auto = () => pads.find((p) => p.mapping === "standard")?.index;
    if (!this.#selected) {
      this.#chosen =
        pref.mode === "pad"
          ? pref.index
          : pref.mode === "auto"
            ? auto()
            : undefined;
      this.#selected = true;
    }
    // Hot-plug without switching away from an already chosen controller.
    if (this.#chosen === undefined && pref.mode === "auto")
      this.#chosen = auto();
    const pad = pads.find((p) => p.index === this.#chosen);
    if (this.#lastPad && !sameDevice(this.#lastPad, pad)) {
      this.status =
        "Mando desconectado o sustituido. Compruébalo en Controles.";
      return this.#lost();
    }
    if (pad) {
      if (pref.mode === "pad" && pad.id !== pref.id) {
        this.status = "El mando ha cambiado. Selecciónalo en Controles.";
        return this.#lost();
      }
      this.#lastPad = {
        index: pad.index,
        id: pad.id,
        mapping: pad.mapping,
        connected: pad.connected,
        buttons: [...pad.buttons],
        axes: [...pad.axes],
      };
      this.status = "Mando conectado";
    }
    if (!pad && this.status === "Mando conectado") this.status = "Sin mando";
    const profile =
      pref.mode === "pad"
        ? pref.profile
        : pad?.mapping === "standard"
          ? standard
          : undefined;
    if (pad && !profile)
      this.status = "Configura este mando en Controles; teclado disponible.";
    const input = sample(
      pad,
      profile,
      this.#held,
      pref.mode === "pad" ? pref.deadzone : 0.25,
      this.#keyboard,
    );
    for (const action of this.#virtual) input[action] = true;
    if (!this.#ready && !Object.values(input).some(Boolean)) {
      this.#ready = true;
      return this.#reading(input, false, !!pad);
    }
    return this.#reading(input, this.#ready, !!pad);
  }

  #lost(): InputReading {
    return this.#reading(neutral(), false, false, true);
  }

  #reading(
    input: InputState,
    ready: boolean,
    connected: boolean,
    lost = false,
  ): InputReading {
    return { input, ready, lost, connected, status: this.status };
  }
}
