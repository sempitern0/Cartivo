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
  /** The boot file of each disc of the game (an .m3u's list), in order. */
  readonly discs: readonly string[];
  /** Index in `discs` of the disc the core boots. */
  readonly first: number;
  /** The file the core opens first: the .cue, .chd, .iso… of disc `first`. */
  readonly primary: DiscPart;
  readonly #disc1: DiscPart;
  readonly #read: ReadSync;

  /**
   * `disc1` is the boot file of the game's first disc and `others` those of
   * its other discs, in order; `first` picks the one the core boots.
   */
  constructor(
    parts: readonly DiscPart[],
    disc1: DiscPart,
    read: ReadSync,
    others: readonly string[] = [],
    first = 0,
  ) {
    if (!parts.includes(disc1)) throw Error("Disco sin archivo principal");
    this.parts = parts;
    this.#disc1 = disc1;
    this.discs = [disc1.name, ...others];
    this.#read = read;
    for (const name of others)
      if (!this.find(name)) throw Error(`Falta el disco «${name}»`);
    if (!this.discs[first]) throw Error(`No hay disco ${first + 1}`);
    this.first = first;
    this.primary = first ? this.find(this.discs[first])! : disc1;
  }

  /** The same game booting disc `index` (a reset keeps the disc in the tray). */
  withFirst(index: number): DiscImage {
    return new DiscImage(
      this.parts,
      this.#disc1,
      this.#read,
      this.discs.slice(1),
      index,
    );
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
