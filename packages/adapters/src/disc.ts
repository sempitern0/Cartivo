// CD images read on demand (ADR-015). A disc stays in the player's files: the
// core opens them by name through libretro's VFS, which the bridge forwards
// to the cartivo_vfs_* imports below, and only the sectors it asks for are
// read (synchronously: FileReaderSync is allowed in Workers).
import type { DiscPart } from "../../storage/src/disc-identity.ts";
import { trackName } from "../../storage/src/cue.ts";

/** Reads [start, end) of a Blob synchronously (FileReaderSync in a Worker). */
export type ReadSync = (blob: Blob, start: number, end: number) => Uint8Array;

// Worker-only API; the project's types are the DOM's.
declare const FileReaderSync: new () => {
  readAsArrayBuffer(blob: Blob): ArrayBuffer;
};

export const fileReaderSync: ReadSync = (blob, start, end) =>
  new Uint8Array(
    new FileReaderSync().readAsArrayBuffer(blob.slice(start, end)),
  );

export class DiscImage {
  readonly parts: readonly DiscPart[];
  /** The file the core opens first (the .cue, .chd, .iso…). */
  readonly primary: DiscPart;
  readonly #read: ReadSync;

  constructor(parts: readonly DiscPart[], primary: DiscPart, read: ReadSync) {
    if (!parts.includes(primary)) throw Error("Disco sin archivo principal");
    this.parts = parts;
    this.primary = primary;
    this.#read = read;
  }

  /** A part by the name the core uses (any folder, any case). */
  find(path: string): DiscPart | undefined {
    const name = trackName(path);
    return this.parts.find((p) => trackName(p.name) === name);
  }

  read(part: DiscPart, offset: number, length: number): Uint8Array {
    const start = Math.min(Math.max(0, offset), part.blob.size);
    return this.#read(
      part.blob,
      start,
      Math.min(start + length, part.blob.size),
    );
  }
}

/**
 * The cartivo_vfs_* imports for a core with a disc: open by name (handle ≥ 1,
 * 0 if missing), size, read at an offset into wasm memory (bytes read, or
 * -1), close. Handles are this core's own; nothing is shared between cores.
 */
export function vfsImports(disc: DiscImage, memory: () => ArrayBuffer) {
  const open = new Map<number, DiscPart>();
  let next = 1;
  const text = (pointer: number, length: number) =>
    new TextDecoder().decode(new Uint8Array(memory(), pointer, length));
  return {
    cartivo_vfs_open(path: number, length: number) {
      const part = disc.find(text(path, length));
      if (!part) return 0;
      open.set(next, part);
      return next++;
    },
    cartivo_vfs_size(handle: number) {
      return open.get(handle)?.blob.size ?? -1;
    },
    cartivo_vfs_read(
      handle: number,
      offset: number,
      pointer: number,
      length: number,
    ) {
      const part = open.get(handle);
      if (!part) return -1;
      const bytes = disc.read(part, offset, length);
      new Uint8Array(memory(), pointer, bytes.length).set(bytes);
      return bytes.length;
    },
    cartivo_vfs_close(handle: number) {
      return open.delete(handle) ? 0 : -1;
    },
  };
}
