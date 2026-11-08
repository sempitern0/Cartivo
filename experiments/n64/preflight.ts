import { stick } from "../../packages/input/src/analog.ts";
export { MAX_N64_ROM_BYTES } from "../../packages/adapters/src/n64-header.ts";
import {
  inspectN64Header,
  type N64Header,
} from "../../packages/adapters/src/n64-header.ts";
export type RomHeader = N64Header & { bytes: number };

/** The lab's probe reads the header with production's validation. */
export const inspectRomHeader = (header: Uint8Array, bytes: number) => ({
  ...inspectN64Header(header, bytes),
  bytes,
});

export type N64Pad = {
  x: number;
  y: number;
  a: boolean;
  b: boolean;
  z: boolean;
  start: boolean;
  l: boolean;
  r: boolean;
  cUp: boolean;
  cDown: boolean;
  cLeft: boolean;
  cRight: boolean;
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
};

/** Diagnostic mapping only; production must reuse Cartivo's input ownership. */
export function samplePad(
  pad: Pick<Gamepad, "axes" | "buttons" | "connected" | "mapping"> | null,
): N64Pad {
  const active = pad?.connected && pad.mapping === "standard" ? pad : null;
  const pressed = (index: number) => active?.buttons[index]?.pressed === true;
  // The stick reading is production's (packages/input/src/analog.ts).
  const left = stick(active?.axes[0] ?? 0, active?.axes[1] ?? 0);
  const cx = Number.isFinite(active?.axes[2]) ? active!.axes[2] : 0;
  const cy = Number.isFinite(active?.axes[3]) ? active!.axes[3] : 0;
  return {
    ...left,
    a: pressed(0),
    b: pressed(2),
    z: pressed(6),
    start: pressed(9),
    l: pressed(4),
    r: pressed(5),
    cUp: cy < -0.5,
    cDown: cy > 0.5,
    cLeft: cx < -0.5,
    cRight: cx > 0.5,
    up: pressed(12),
    down: pressed(13),
    left: pressed(14),
    right: pressed(15),
  };
}
