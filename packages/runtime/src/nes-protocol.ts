import { actions, type InputState } from "../../input/src/nes-input.ts";
export type NesCommand = "load" | "advance" | "pause" | "save" | "import" | "reset";
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
    !["load", "advance", "pause", "save", "import", "reset"].includes(r.command)
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
  save?: Uint8Array;
  saveHash?: string;
};
