import {
  actions,
  type Action,
  type InputState,
} from "../../input/src/nes-input.ts";
import { isAnalog, type Analog } from "../../input/src/analog.ts";

/** Buttons added after protocol v1 shipped (GBA L/R, SNES X/Y, PS1 L2/R2). */
const optional: readonly Action[] = ["l", "r", "x", "y", "l2", "r2"];
import { system as findSystem } from "./systems.ts";
import { isProfileId } from "../../storage/src/profiles.ts";
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
  | "disc"
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
  /** `load` of a disc: its other files, such as the tracks a .cue names. */
  extra?: File[];
  demo?: boolean;
  /** `load` from the local library: SHA-256 of the remembered ROM. */
  stored?: string;
  /** `load` from a file: also remember it in the local library. */
  remember?: boolean;
  count?: number;
  input?: InputState;
  /** `advance`: player 1's sticks; omitted means centred (older clients). */
  analog?: Analog;
  backup?: unknown;
  /** System for `load` (systems.ts id); omitted means NES (protocol v1). */
  system?: string;
  /** Core for `load`; omitted means the system's first core in the worker. */
  core?: string;
  /** Profile for `load` whose saves, Partidas and library are used
   * (ADR-016); omitted means the first profile. */
  profile?: string;
  /** `disc`: index of the disc to put in (a multi-disc game). */
  disc?: number;
  /** Snapshot slot for state-save/state-load/state-delete/state-export. */
  slot?: StateSlot;
  /** Parsed JSON of an exported snapshot for state-import (checked in the Worker). */
  stateFile?: unknown;
  /** `load` of a system the core draws itself (systems.ts `surface`): the
   * page's game canvas, transferred (ADR-017). */
  canvas?: OffscreenCanvas;
};
/** More files than any multi-track disc needs (99 tracks and its .cue). */
const MAX_EXTRA_FILES = 100;
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
      "disc",
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
    r.extra !== undefined &&
    (!fromFile ||
      !Array.isArray(r.extra) ||
      r.extra.length > MAX_EXTRA_FILES ||
      !r.extra.every((f) => f instanceof File))
  )
    throw Error("Archivos del disco inválidos");
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
    if (r.profile !== undefined && !isProfileId(r.profile))
      throw Error("Perfil inválido");
    const canvas =
      typeof OffscreenCanvas !== "undefined" &&
      r.canvas instanceof OffscreenCanvas;
    if (target.surface ? !canvas : r.canvas !== undefined)
      throw Error(
        target.surface ? "Falta el lienzo del juego" : "Lienzo inesperado",
      );
  } else if (r.canvas !== undefined) throw Error("Lienzo inesperado");
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
  if (
    r.command === "disc" &&
    (!Number.isInteger(r.disc) || r.disc! < 0 || r.disc! > 7)
  )
    throw Error("Disco inválido");
  if (r.analog !== undefined && !isAnalog(r.analog))
    throw Error("Sticks inválidos");
  // Protocol v1 clients from before L/R send eight buttons: L/R are released.
  if (r.input) for (const a of optional) r.input[a] ??= false;
  return r;
}
/** A multi-disc game's discs (boot file names, in order) and the one in. */
export type DiscTrayState = { names: string[]; current: number };

export type EmuResult = {
  pixels?: Uint8ClampedArray;
  /** Size of `pixels` in pixels (RGBA, width × height × 4 bytes). */
  width?: number;
  height?: number;
  audio?: Float32Array;
  frames?: number;
  hash?: string;
  battery?: boolean;
  /** load: frames per second of this game (PAL 50 Hz); absent: nominal. */
  frameRate?: number;
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
  /**
   * load of a disc: bytes being copied to the library while it plays. The
   * outcome (`remembered` or `libraryError`) comes with a later advance.
   */
  remembering?: number;
  /**
   * load, disc and state-load: a multi-disc game's tray. A Partida saved on
   * another disc puts that disc back, so loading one reports it too.
   */
  discs?: DiscTrayState;
  /** load: this browser cannot save at all; the game runs without saving. */
  storageError?: string;
};
