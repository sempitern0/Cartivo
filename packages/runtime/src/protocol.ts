import {
  actions,
  type Action,
  type InputState,
} from "../../input/src/nes-input.ts";

/** Buttons added after protocol v1 shipped (GBA L/R, SNES X/Y). */
const optional: readonly Action[] = ["l", "r", "x", "y"];
import { system as findSystem } from "./systems.ts";
import {
  isStateSlot,
  type StateMeta,
  type StateSlot,
} from "../../storage/src/states.ts";
import { isSha256 } from "../../storage/src/library.ts";
import type { StateFile } from "../../storage/src/state-file.ts";
export type EmuCommand =
  | "load"
  | "advance"
  | "pause"
  | "save"
  | "import"
  | "reset"
  | "state-list"
  | "state-save"
  | "state-load"
  | "state-delete"
  | "state-export"
  | "state-import";
export type EmuRequest = {
  v: 1;
  session: string;
  id: number;
  command: EmuCommand;
  file?: File;
  demo?: boolean;
  /** `load` from the local library: SHA-256 of the remembered ROM. */
  stored?: string;
  /** `load` from a file: also remember it in the local library. */
  remember?: boolean;
  count?: number;
  input?: InputState;
  backup?: unknown;
  /** System for `load` (systems.ts id); omitted means NES (protocol v1). */
  system?: string;
  /** Core for `load`; omitted means the system's first core in the worker. */
  core?: string;
  /** Snapshot slot for state-save/state-load/state-delete/state-export. */
  slot?: StateSlot;
  /** Parsed JSON of an exported snapshot for state-import (checked in the Worker). */
  stateFile?: unknown;
};
export function parseRequest(value: unknown): EmuRequest {
  if (!value || typeof value !== "object") throw Error("Mensaje inválido");
  const r = value as EmuRequest;
  if (
    r.v !== 1 ||
    typeof r.session !== "string" ||
    !r.session ||
    r.session.length > 128 ||
    !Number.isSafeInteger(r.id) ||
    r.id < 1 ||
    ![
      "load",
      "advance",
      "pause",
      "save",
      "import",
      "reset",
      "state-list",
      "state-save",
      "state-load",
      "state-delete",
      "state-export",
      "state-import",
    ].includes(r.command)
  )
    throw Error("Protocolo de emulación inválido");
  const fromFile = typeof File !== "undefined" && r.file instanceof File;
  if (
    r.command === "load" &&
    !(r.demo === true || fromFile || isSha256(r.stored))
  )
    throw Error("Falta archivo local");
  if (r.stored !== undefined && (!isSha256(r.stored) || fromFile || r.demo))
    throw Error("Juego guardado inválido");
  if (
    r.remember !== undefined &&
    (typeof r.remember !== "boolean" || !fromFile)
  )
    throw Error("Solo se recuerdan juegos abiertos desde un archivo");
  if (r.command === "load") {
    const target = findSystem(r.system ?? "nes");
    if (!target) throw Error("Sistema desconocido");
    if (r.core !== undefined && !target.cores.some((c) => c.id === r.core))
      throw Error(`Núcleo desconocido para ${target.name}`);
  }
  if (
    ["state-save", "state-load", "state-delete", "state-export"].includes(
      r.command,
    ) &&
    !isStateSlot(r.slot)
  )
    throw Error("Ranura de partida inválida");
  if (
    r.command === "state-import" &&
    (!r.stateFile || typeof r.stateFile !== "object")
  )
    throw Error("Falta la partida que importar");
  if (
    r.command === "advance" &&
    (!Number.isInteger(r.count) ||
      r.count! < 1 ||
      r.count! > 3 ||
      !r.input ||
      actions.some(
        (a) =>
          typeof r.input![a] !== "boolean" &&
          !(optional.includes(a) && r.input![a] === undefined),
      ))
  )
    throw Error("Entrada inválida");
  // Protocol v1 clients from before L/R send eight buttons: L/R are released.
  if (r.input) for (const a of optional) r.input[a] ??= false;
  return r;
}
export type EmuResult = {
  pixels?: Uint8ClampedArray;
  /** Size of `pixels` in pixels (RGBA, width × height × 4 bytes). */
  width?: number;
  height?: number;
  audio?: Float32Array;
  frames?: number;
  hash?: string;
  battery?: boolean;
  saved?: boolean;
  saveError?: string;
  recovered?: boolean;
  core?: string;
  save?: Uint8Array;
  saveHash?: string;
  /** Snapshot slots for this game (metadata and previews only). */
  states?: StateMeta[];
  /** state-export: the snapshot as a versioned file, ready to download. */
  stateFile?: StateFile;
  /** The game is now in the local library (load with remember). */
  remembered?: boolean;
  /** Why the game could not be remembered; the session goes on. */
  libraryError?: string;
  /** load: this browser cannot save at all; the game runs without saving. */
  storageError?: string;
};
