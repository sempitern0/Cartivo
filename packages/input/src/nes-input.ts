/** Cartivo input: local, normalized NES P1 controls. No dependency on a core ABI. */
export const actions = [
  "up",
  "down",
  "left",
  "right",
  "a",
  "b",
  "select",
  "start",
] as const;
export type Action = (typeof actions)[number];
export type InputState = Record<Action, boolean>;
export type Binding =
  | { kind: "button"; index: number }
  | { kind: "axis"; index: number; direction: -1 | 1 };
export type Profile = Record<Action, Binding>;
export interface Pad {
  index: number;
  id: string;
  connected: boolean;
  mapping: string;
  buttons: readonly { pressed: boolean; value: number }[];
  axes: readonly number[];
}
export const neutral = (): InputState =>
  Object.fromEntries(actions.map((a) => [a, false])) as InputState;
export const keys: Record<string, Action> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  KeyX: "a",
  KeyZ: "b",
  ShiftRight: "select",
  Enter: "start",
};
export const standard: Profile = {
  up: { kind: "button", index: 12 },
  down: { kind: "button", index: 13 },
  left: { kind: "button", index: 14 },
  right: { kind: "button", index: 15 },
  a: { kind: "button", index: 0 },
  b: { kind: "button", index: 1 },
  select: { kind: "button", index: 8 },
  start: { kind: "button", index: 9 },
};
export function bindingPressed(
  pad: Pad,
  binding: Binding,
  deadzone: number,
): boolean {
  if (binding.kind === "button")
    return (
      !!pad.buttons[binding.index]?.pressed ||
      (pad.buttons[binding.index]?.value ?? 0) > 0.5
    );
  const value = pad.axes[binding.index];
  return Number.isFinite(value) && value * binding.direction > deadzone;
}
export function sample(
  pad: Pad | undefined,
  profile: Profile | undefined,
  held: ReadonlySet<string>,
  deadzone = 0.25,
  keyboard: KeyboardProfile = defaultKeyboard,
): InputState {
  const state = neutral();
  for (const code of held) {
    const action = keyboardAction(code, keyboard);
    if (action) state[action] = true;
  }
  if (pad?.connected && profile) {
    for (const action of actions)
      state[action] ||= bindingPressed(pad, profile[action], deadzone);
    if (pad.mapping === "standard" && profile === standard) {
      state.left ||= (pad.axes[0] ?? 0) < -deadzone;
      state.right ||= (pad.axes[0] ?? 0) > deadzone;
      state.up ||= (pad.axes[1] ?? 0) < -deadzone;
      state.down ||= (pad.axes[1] ?? 0) > deadzone;
    }
  }
  // Opposite directions neutralize deterministically; no impossible NES D-pad states.
  if (state.up && state.down) state.up = state.down = false;
  if (state.left && state.right) state.left = state.right = false;
  return state;
}
export function pressedBindings(pad: Pad, deadzone = 0.55): Binding[] {
  const out: Binding[] = [];
  pad.buttons.forEach((_, index) => {
    const b: Binding = { kind: "button", index };
    if (bindingPressed(pad, b, deadzone)) out.push(b);
  });
  pad.axes.forEach((value, index) => {
    if (Number.isFinite(value) && Math.abs(value) > deadzone)
      out.push({ kind: "axis", index, direction: value < 0 ? -1 : 1 });
  });
  return out;
}
export function sameBinding(a: Binding, b: Binding): boolean {
  return (
    a.kind === b.kind &&
    a.index === b.index &&
    (a.kind === "button" || (b.kind === "axis" && a.direction === b.direction))
  );
}
export function parseProfile(value: unknown, pad: Pad): Profile | undefined {
  if (!value || typeof value !== "object") return;
  const source = value as Record<string, unknown>;
  const result = {} as Profile;
  for (const action of actions) {
    const raw = source[action];
    if (!raw || typeof raw !== "object") return;
    const b = raw as Record<string, unknown>;
    if (!Number.isInteger(b.index) || (b.index as number) < 0) return;
    if (b.kind === "button" && (b.index as number) < pad.buttons.length)
      result[action] = { kind: "button", index: b.index as number };
    else if (
      b.kind === "axis" &&
      (b.index as number) < pad.axes.length &&
      (b.direction === 1 || b.direction === -1)
    )
      result[action] = {
        kind: "axis",
        index: b.index as number,
        direction: b.direction,
      };
    else return;
  }
  for (let i = 0; i < actions.length; i++)
    for (let j = i + 1; j < actions.length; j++)
      if (sameBinding(result[actions[i]], result[actions[j]])) return;
  return result;
}
/** An index is a slot, never identity. Any observed replacement requires explicit reactivation. */
export function sameDevice(a: Pad | undefined, b: Pad | undefined): boolean {
  return (
    !!a &&
    !!b &&
    a.connected &&
    b.connected &&
    a.index === b.index &&
    a.id === b.id &&
    a.mapping === b.mapping &&
    a.buttons.length === b.buttons.length &&
    a.axes.length === b.axes.length
  );
}

export type KeyboardProfile = Record<Action, string>;
export const defaultKeyboard = Object.fromEntries(
  Object.entries(keys).map(([code, action]) => [action, code]),
) as KeyboardProfile;
export function allowedKey(code: string): boolean {
  return /^(Key[A-Z]|Digit[0-9]|Arrow(Up|Down|Left|Right)|Space|Enter|Shift(Left|Right)|Numpad[0-9])$/.test(
    code,
  );
}
export function parseKeyboard(value: unknown): KeyboardProfile | undefined {
  if (!value || typeof value !== "object") return;
  const result = {} as KeyboardProfile;
  for (const action of actions) {
    const code = (value as Record<string, unknown>)[action];
    if (typeof code !== "string" || !allowedKey(code)) return;
    result[action] = code;
  }
  return new Set(Object.values(result)).size === actions.length
    ? result
    : undefined;
}
export function keyLabel(code: string): string {
  const names: Record<string, string> = {
    ArrowUp: "↑",
    ArrowDown: "↓",
    ArrowLeft: "←",
    ArrowRight: "→",
    ShiftRight: "Mayús derecha",
    ShiftLeft: "Mayús izquierda",
    Enter: "Enter",
    Space: "Espacio",
  };
  return (
    names[code] ?? code.replace(/^Key|^Digit/, "").replace(/^Numpad/, "Num ")
  );
}

const movementAliases: Record<string, Action> = {
  KeyW: "up",
  KeyA: "left",
  KeyS: "down",
  KeyD: "right",
};
export function keyboardAction(
  code: string,
  keyboard: KeyboardProfile,
): Action | undefined {
  const primary = actions.find((a) => keyboard[a] === code);
  if (primary) return primary;
  const alias = movementAliases[code];
  return alias && keyboard[alias] === defaultKeyboard[alias]
    ? alias
    : undefined;
}
