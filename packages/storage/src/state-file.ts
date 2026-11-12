// Exported «Partidas» (ADR-009): one snapshot per file, versioned JSON with
// the bytes in base64 and their SHA-256. Pure functions: the Worker reads and
// writes the store, the UI only downloads or picks the file.
import { digest } from "./sram.ts";
import {
  isStateSlot,
  MAX_STATE_BYTES,
  PREVIEW_HEIGHT,
  PREVIEW_WIDTH,
  type StateSlot,
  type StoredState,
} from "./states.ts";

export const STATE_FILE_FORMAT = "cartivo-state-v1";
/** Upper bound before parsing: base64 (×4/3) of a snapshot plus the preview. */
export const MAX_STATE_FILE =
  Math.ceil((MAX_STATE_BYTES * 4) / 3) + 1024 * 1024;

export type StateFile = {
  format: typeof STATE_FILE_FORMAT;
  system: string;
  /** SHA-256 of the ROM the snapshot belongs to. */
  game: string;
  slot: StateSlot;
  core: string;
  coreVersion: string;
  frames: number;
  createdAt: number;
  sha256: string;
  bytes: string;
  preview?: string;
};

const CHUNK = 0x8000;
function toBase64(bytes: Uint8Array | Uint8ClampedArray) {
  let text = "";
  for (let i = 0; i < bytes.length; i += CHUNK)
    text += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(text);
}
function fromBase64(text: string) {
  const binary = atob(text);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export function serializeState(
  record: StoredState,
  system: string,
  game: string,
): StateFile {
  const { meta, bytes, sha256 } = record;
  return {
    format: STATE_FILE_FORMAT,
    system,
    game,
    slot: meta.slot,
    core: meta.core,
    coreVersion: meta.coreVersion,
    frames: meta.frames,
    createdAt: meta.createdAt,
    sha256,
    bytes: toBase64(bytes),
    ...(meta.preview ? { preview: toBase64(meta.preview) } : {}),
  };
}

const isCount = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;

/**
 * Validates an exported snapshot for the running game. Another game or a
 * core version that could never load it is refused; another core of the same
 * system is accepted, since the player can switch cores to load it.
 */
export async function parseStateFile(
  value: unknown,
  expect: {
    system: string;
    game: string;
    coreVersion: (core: string) => string | undefined;
  },
): Promise<StoredState> {
  const f = value as Partial<Record<keyof StateFile, unknown>> | null;
  if (!f || typeof f !== "object" || f.format !== STATE_FILE_FORMAT)
    throw Error("El archivo no es una partida de Cartivo.");
  if (f.system !== expect.system || f.game !== expect.game)
    throw Error("Esta partida es de otro juego.");
  if (
    !isStateSlot(f.slot) ||
    typeof f.core !== "string" ||
    typeof f.coreVersion !== "string" ||
    !isCount(f.frames) ||
    !isCount(f.createdAt) ||
    typeof f.sha256 !== "string" ||
    typeof f.bytes !== "string" ||
    (f.preview !== undefined && typeof f.preview !== "string") ||
    f.bytes.length > Math.ceil((MAX_STATE_BYTES * 4) / 3) + 4
  )
    throw Error("La partida tiene un formato incompatible.");
  const installed = expect.coreVersion(f.core);
  if (installed === undefined)
    throw Error("Esta partida es de un núcleo que este sistema no tiene.");
  if (installed !== f.coreVersion)
    throw Error(
      `Esta partida es de otra versión del núcleo (${f.coreVersion}) y no se puede cargar.`,
    );
  let bytes: Uint8Array;
  let preview: Uint8ClampedArray | undefined;
  try {
    bytes = fromBase64(f.bytes);
    if (f.preview !== undefined)
      preview = new Uint8ClampedArray(fromBase64(f.preview).buffer);
  } catch {
    throw Error("La partida está dañada.");
  }
  if (preview && preview.length !== PREVIEW_WIDTH * PREVIEW_HEIGHT * 4)
    throw Error("La partida tiene un formato incompatible.");
  if ((await digest(bytes)) !== f.sha256)
    throw Error("La partida está dañada.");
  return {
    meta: {
      slot: f.slot,
      core: f.core,
      coreVersion: f.coreVersion,
      frames: f.frames,
      createdAt: f.createdAt,
      size: bytes.length,
      ...(preview ? { preview } : {}),
    },
    bytes,
    sha256: f.sha256,
  };
}

/** File name for a download: cartivo-<system>-<slot>-<yyyymmdd-hhmm>.json */
export function stateFileName(system: string, slot: StateSlot, time: number) {
  const d = new Date(time);
  const two = (n: number) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}${two(d.getMonth() + 1)}${two(d.getDate())}-${two(d.getHours())}${two(d.getMinutes())}`;
  return `cartivo-${system}-${slot === "auto" ? "al-salir" : `ranura-${slot}`}-${stamp}.json`;
}
