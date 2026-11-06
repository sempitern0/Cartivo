// What the player runs: the built-in demo, a file the player opened, or a
// remembered game the Worker reads from this device (ADR-012). One explicit
// union instead of several optional props whose combinations were implied.
import type { EmuRequest } from "../../../packages/runtime/src/protocol.ts";
import type { LibraryEntry } from "../../../packages/storage/src/library.ts";

export type GameSource =
  | { kind: "demo" }
  | {
      kind: "file";
      file: File;
      /** A disc's other files (the tracks its .cue names), ADR-015. */
      extra?: File[];
    }
  | {
      kind: "library";
      entry: LibraryEntry;
      /** Continue from «Al salir» directly, without the offer. */
      resume: boolean;
    };

export const demo: GameSource = { kind: "demo" };

export function sourceTitle(source: GameSource): string {
  if (source.kind === "file") return source.file.name;
  if (source.kind === "library") return source.entry.name;
  return "Demo de controles";
}

/** The `load` fields for a source; only opened files can be remembered. */
export function loadFields(
  source: GameSource,
  remember: boolean,
): Pick<EmuRequest, "demo" | "file" | "extra" | "stored" | "remember"> {
  if (source.kind === "file")
    return source.extra?.length
      ? { file: source.file, extra: source.extra, remember }
      : { file: source.file, remember };
  if (source.kind === "library") return { stored: source.entry.hash };
  return { demo: true };
}
