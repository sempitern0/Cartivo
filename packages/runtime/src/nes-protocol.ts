import { actions, type InputState } from "../../input/src/nes-input.ts";
import { nesCores, type NesCoreId } from "../../adapters/src/core-ids.ts";
import {
  isStateSlot,
  type StateMeta,
  type StateSlot,
} from "../../storage/src/states.ts";
export type NesCommand =
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
export type NesRequest = {
  v: 1;
  session: string;
  id: number;
  command: NesCommand;
  file?: File;
  demo?: boolean;
  count?: number;
  input?: InputState;
  backup?: unknown;
  /** Core for `load`; omitted means JSNES (protocol v1 compatibility). */
  core?: NesCoreId;
  /** Snapshot slot for state-save/state-load/state-delete. */
  slot?: StateSlot;
};
export function parseNesRequest(value: unknown): NesRequest {
  if (!value || typeof value !== "object") throw Error("Mensaje inválido");
  const r = value as NesRequest;
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
    throw Error("Protocolo NES inválido");
  if (
    r.command === "load" &&
    !(
      r.demo === true ||
      (typeof File !== "undefined" && r.file instanceof File)
    )
  )
    throw Error("Falta archivo local");
  if (
    r.command === "load" &&
    r.core !== undefined &&
    !(nesCores as readonly unknown[]).includes(r.core)
  )
    throw Error("Núcleo NES desconocido");
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
    throw Error("Entrada NES inválida");
  return r;
}
export type NesResult = {
  pixels?: Uint8ClampedArray;
  audio?: Float32Array;
  frames?: number;
  hash?: string;
  battery?: boolean;
  saved?: boolean;
  saveError?: string;
  recovered?: boolean;
  core?: NesCoreId;
  save?: Uint8Array;
  saveHash?: string;
  /** Snapshot slots for this game (metadata and previews only). */
  states?: StateMeta[];
};
