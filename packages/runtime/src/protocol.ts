import { actions, type InputState } from "../../input/src/nes-input.ts";
import { system as findSystem } from "./systems.ts";
import {
  isStateSlot,
  type StateMeta,
  type StateSlot,
} from "../../storage/src/states.ts";
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
  | "state-delete";
export type EmuRequest = {
  v: 1;
  session: string;
  id: number;
  command: EmuCommand;
  file?: File;
  demo?: boolean;
  count?: number;
  input?: InputState;
  backup?: unknown;
  /** System for `load` (systems.ts id); omitted means NES (protocol v1). */
  system?: string;
  /** Core for `load`; omitted means the system's first core in the worker. */
  core?: string;
  /** Snapshot slot for state-save/state-load/state-delete. */
  slot?: StateSlot;
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
    ].includes(r.command)
  )
    throw Error("Protocolo de emulación inválido");
  if (
    r.command === "load" &&
    !(
      r.demo === true ||
      (typeof File !== "undefined" && r.file instanceof File)
    )
  )
    throw Error("Falta archivo local");
  if (r.command === "load") {
    const target = findSystem(r.system ?? "nes");
    if (!target) throw Error("Sistema desconocido");
    if (r.core !== undefined && !target.cores.some((c) => c.id === r.core))
      throw Error(`Núcleo desconocido para ${target.name}`);
  }
  if (
    ["state-save", "state-load", "state-delete"].includes(r.command) &&
    !isStateSlot(r.slot)
  )
    throw Error("Ranura de partida inválida");
  if (
    r.command === "advance" &&
    (!Number.isInteger(r.count) ||
      r.count! < 1 ||
      r.count! > 3 ||
      !r.input ||
      actions.some((a) => typeof r.input![a] !== "boolean"))
  )
    throw Error("Entrada inválida");
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
};
