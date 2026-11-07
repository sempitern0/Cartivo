import { stick } from "../../packages/input/src/analog.ts";
export const MAX_N64_ROM_BYTES = 64 * 1024 * 1024;
export type ByteOrder = "z64" | "v64" | "n64";
export type RomHeader = { byteOrder: ByteOrder; title: string; bytes: number };

/** Inspect only the header. Recognition does not prove bootability or integrity. */
export function inspectRomHeader(header: Uint8Array, bytes: number): RomHeader {
  if (!Number.isSafeInteger(bytes) || bytes < 4096 || bytes > MAX_N64_ROM_BYTES)
    throw new Error("El prototipo admite cartuchos entre 4 KiB y 64 MiB.");
  if (bytes % 4 !== 0 || header.length < 64)
    throw new Error(
      "El cartucho está truncado o no tiene una cabecera completa.",
    );
  const magic = Array.from(header.subarray(0, 4)).join(",");
  const byteOrder: ByteOrder | undefined = {
    "128,55,18,64": "z64",
    "55,128,64,18": "v64",
    "64,18,55,128": "n64",
  }[magic] as ByteOrder | undefined;
  if (!byteOrder)
    throw new Error("No se reconoce una cabecera de cartucho N64.");
  const xor = byteOrder === "v64" ? 1 : byteOrder === "n64" ? 3 : 0;
  let title = "";
  for (let i = 0x20; i < 0x34; i++) {
    const value = header[i ^ xor];
    title += value >= 32 && value <= 126 ? String.fromCharCode(value) : " ";
  }
  return { byteOrder, title: title.trim() || "Sin título", bytes };
}

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
