import type { RomHeader } from "./preflight.ts";
export type ProbeRequest = { version: 1; canvas: OffscreenCanvas; file?: Blob };
export type ProbeResult =
  | {
      version: 1;
      ok: true;
      webgl2: boolean;
      webglReason: string;
      wasm: boolean;
      isolated: boolean;
      rom?: RomHeader;
      headerReadBytes: number;
      elapsedMs: number;
    }
  | { version: 1; ok: false; error: string };

export function isProbeResult(value: unknown): value is ProbeResult {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (v.version !== 1) return false;
  if (v.ok === false) return typeof v.error === "string";
  if (
    v.ok !== true ||
    typeof v.webgl2 !== "boolean" ||
    typeof v.wasm !== "boolean" ||
    typeof v.isolated !== "boolean" ||
    typeof v.webglReason !== "string" ||
    typeof v.elapsedMs !== "number" ||
    !Number.isFinite(v.elapsedMs) ||
    v.elapsedMs < 0 ||
    (v.headerReadBytes !== 0 && v.headerReadBytes !== 64)
  )
    return false;
  if (v.rom === undefined) return v.headerReadBytes === 0;
  if (!v.rom || typeof v.rom !== "object") return false;
  const rom = v.rom as Record<string, unknown>;
  return (
    v.headerReadBytes === 64 &&
    typeof rom.byteOrder === "string" &&
    ["z64", "v64", "n64"].includes(rom.byteOrder) &&
    typeof rom.title === "string" &&
    typeof rom.bytes === "number" &&
    Number.isSafeInteger(rom.bytes) &&
    rom.bytes >= 4096 &&
    rom.bytes <= 64 * 1024 * 1024 &&
    rom.bytes % 4 === 0
  );
}
