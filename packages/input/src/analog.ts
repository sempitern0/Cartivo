/** Analog sticks of player 1, next to the digital InputState (nes-input.ts).
 * Normalised, core-independent: each axis in −1…1, x right and y down (the
 * Gamepad API's and libretro's orientation). A core that has no sticks never
 * receives them; one that has them scales to its own range.
 */
import type { Pad } from "./nes-input.ts";

export type Stick = { x: number; y: number };
export type Analog = { left: Stick; right: Stick };

/** Default radial deadzone: the drift of a worn stick, not a deliberate push. */
export const STICK_DEADZONE = 0.18;

export const centered = (): Analog => ({
  left: { x: 0, y: 0 },
  right: { x: 0, y: 0 },
});

/**
 * One stick with a radial deadzone: inside it, exactly centred; outside, the
 * distance is rescaled from the edge of the deadzone, so a slight push is
 * slow movement rather than a jump. Clamped to the unit circle (square-gate
 * pads report corners above 1); non-finite readings count as centred.
 */
export function stick(x: number, y: number, deadzone = STICK_DEADZONE): Stick {
  if (!Number.isFinite(deadzone) || deadzone < 0 || deadzone >= 1)
    throw RangeError(`Zona muerta inválida: ${deadzone}`);
  x = Number.isFinite(x) ? Math.max(-1, Math.min(1, x)) : 0;
  y = Number.isFinite(y) ? Math.max(-1, Math.min(1, y)) : 0;
  const length = Math.hypot(x, y);
  if (length <= deadzone) return { x: 0, y: 0 };
  const scale = (Math.min(1, length) - deadzone) / (1 - deadzone) / length;
  return { x: x * scale, y: y * scale };
}

/** A stick from four digital directions (keyboard, D-pad): full deflection,
 * diagonals on the unit circle, opposite directions cancel. */
export function digitalStick(
  up: boolean,
  down: boolean,
  left: boolean,
  right: boolean,
): Stick {
  const x = Number(right) - Number(left);
  const y = Number(down) - Number(up);
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
}

/** Both sticks of a standard-mapping pad (axes 0–1 left, 2–3 right); any
 * other mapping has no known stick layout and reads as centred. */
export function analogOf(
  pad: Pad | undefined,
  deadzone = STICK_DEADZONE,
): Analog {
  if (!pad?.connected || pad.mapping !== "standard") return centered();
  const [lx = 0, ly = 0, rx = 0, ry = 0] = pad.axes;
  return { left: stick(lx, ly, deadzone), right: stick(rx, ry, deadzone) };
}

/** A well-formed Analog (protocol validation): finite axes in −1…1. */
export function isAnalog(value: unknown): value is Analog {
  const axis = (n: unknown) =>
    typeof n === "number" && Number.isFinite(n) && n >= -1 && n <= 1;
  const isStick = (s: unknown) =>
    !!s &&
    typeof s === "object" &&
    axis((s as Stick).x) &&
    axis((s as Stick).y);
  return (
    !!value &&
    typeof value === "object" &&
    isStick((value as Analog).left) &&
    isStick((value as Analog).right)
  );
}

/** Axis −1…1 to the signed 16-bit range of libretro's RETRO_DEVICE_ANALOG. */
export const toInt16 = (axis: number) =>
  Math.max(-32768, Math.min(32767, Math.round(axis * 32767)));
