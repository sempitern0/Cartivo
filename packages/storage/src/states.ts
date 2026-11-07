// «Partidas»: full-console snapshots stored per game and slot (ADR-009).
// Separate from battery RAM (sram.ts): a snapshot is tied to one core and
// version, battery RAM is shared by every core.
import { done, locks, request } from "./idb.ts";
import { PRINCIPAL, scoped } from "./profiles.ts";
import { digest } from "./sram.ts";
import { openStates } from "./state-index.ts";

export const stateSlots = ["auto", "1", "2", "3"] as const;
export type StateSlot = (typeof stateSlots)[number];
export const MAX_STATE_BYTES = 8 * 1024 * 1024;
export const PREVIEW_WIDTH = 128;
export const PREVIEW_HEIGHT = 120;

export type StateMeta = {
  slot: StateSlot;
  core: string;
  coreVersion: string;
  frames: number;
  createdAt: number;
  size: number;
  /** RGBA PREVIEW_WIDTH × PREVIEW_HEIGHT, or absent. */
  preview?: Uint8ClampedArray;
};
type StateRecord = StateMeta & { bytes: Uint8Array; sha256: string };
/** A complete snapshot: what is stored, exported and imported. */
export type StoredState = {
  meta: StateMeta;
  bytes: Uint8Array;
  sha256: string;
};

export function isStateSlot(value: unknown): value is StateSlot {
  return (stateSlots as readonly unknown[]).includes(value);
}

/** Nearest-neighbour preview of any RGBA frame at 128×120. */
export function makePreview(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
) {
  const out = new Uint8ClampedArray(PREVIEW_WIDTH * PREVIEW_HEIGHT * 4);
  for (let y = 0; y < PREVIEW_HEIGHT; y++) {
    const sy = Math.floor((y * height) / PREVIEW_HEIGHT);
    for (let x = 0; x < PREVIEW_WIDTH; x++) {
      const from = (sy * width + Math.floor((x * width) / PREVIEW_WIDTH)) * 4;
      out.set(pixels.subarray(from, from + 4), (y * PREVIEW_WIDTH + x) * 4);
    }
  }
  return out;
}

/**
 * A snapshot only restores on the exact core and version that wrote it;
 * otherwise explain why and leave the record untouched.
 */
export function snapshotFits(
  saved: Pick<StateMeta, "core" | "coreVersion">,
  core: string,
  coreVersion: string,
  coreName: (id: string) => string = (id) => id,
) {
  if (saved.core !== core)
    throw Error(
      `Esta partida se guardó con ${coreName(saved.core)}. Cambia de núcleo en Acerca de esta prueba para cargarla.`,
    );
  if (saved.coreVersion !== coreVersion)
    throw Error(
      `Esta partida es de otra versión del núcleo (${saved.coreVersion}) y no se puede cargar. Se conserva sin cambios.`,
    );
}

const meta = ({ bytes: _b, sha256: _s, ...rest }: StateRecord): StateMeta =>
  rest;

export class StateStore {
  private db: IDBDatabase;
  private game: string;
  private release: () => void;
  private constructor(db: IDBDatabase, game: string, release: () => void) {
    this.db = db;
    this.game = game;
    this.release = release;
  }

  /**
   * Takes the per-game writer lock (any game, battery or not) and opens the
   * store. A second tab with the same game is rejected.
   */
  static async open(game: string, profile = PRINCIPAL): Promise<StateStore> {
    const lockManager = locks();
    let release!: () => void;
    const hold = new Promise<void>((resolve) => (release = resolve));
    // A session closed a moment ago in this tab may still be releasing its
    // lock (its Worker is terminating); retry briefly before refusing.
    let acquired = false;
    for (let attempt = 0; attempt < 10 && !acquired; attempt++) {
      if (attempt) await new Promise((r) => setTimeout(r, 100));
      acquired = await new Promise<boolean>((resolve, reject) => {
        void lockManager
          .request(
            scoped("cartivo:game:" + game, profile),
            { ifAvailable: true },
            async (lock) => {
              resolve(!!lock);
              if (lock) await hold;
            },
          )
          .catch(reject);
      });
    }
    if (!acquired)
      throw Error(
        "Este juego ya está abierto en otra pestaña. Ciérrala antes de continuar.",
      );
    try {
      const db = await openStates(profile);
      return new StateStore(db, game, release);
    } catch (error) {
      release();
      throw error;
    }
  }

  private key(slot: StateSlot) {
    return `${this.game}:${slot}`;
  }

  async list(): Promise<StateMeta[]> {
    const tx = this.db.transaction("states", "readonly");
    const store = tx.objectStore("states");
    const out: StateMeta[] = [];
    for (const slot of stateSlots) {
      const value = (await request(store.get(this.key(slot)))) as
        | StateRecord
        | undefined;
      if (value) out.push(meta(value));
    }
    return out;
  }

  async save(
    slot: StateSlot,
    bytes: Uint8Array,
    info: Omit<StateMeta, "slot" | "size" | "createdAt">,
  ): Promise<StateMeta> {
    return this.put({
      meta: { ...info, slot, size: bytes.length, createdAt: Date.now() },
      bytes: Uint8Array.from(bytes),
      sha256: await digest(bytes),
    });
  }

  /**
   * Stores a complete snapshot in its slot (a new save or an imported file),
   * replacing what was there. Success only once the transaction is durable.
   */
  async put({ meta: info, bytes, sha256 }: StoredState): Promise<StateMeta> {
    // The one write path, so the size limit holds for saves and imports.
    if (!bytes.length || bytes.length > MAX_STATE_BYTES)
      throw Error("La partida supera el tamaño admitido (8 MB)");
    const record: StateRecord = { ...info, bytes, sha256 };
    const tx = this.db.transaction(["states", "meta"], "readwrite");
    tx.objectStore("states").put(record, this.key(info.slot));
    tx.objectStore("meta").put(meta(record), this.key(info.slot));
    // Only report success once the transaction is durable.
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? Error("No se pudo guardar"));
      tx.onabort = () => reject(tx.error ?? Error("Guardado cancelado"));
    });
    return meta(record);
  }

  private async read(slot: StateSlot): Promise<StateRecord> {
    const tx = this.db.transaction("states", "readonly");
    const value = (await request(
      tx.objectStore("states").get(this.key(slot)),
    )) as StateRecord | undefined;
    if (!value) throw Error("Esa ranura está vacía");
    return value;
  }

  private static async verified(value: StateRecord): Promise<StoredState> {
    if (
      !(value.bytes instanceof Uint8Array) ||
      (await digest(value.bytes)) !== value.sha256
    )
      throw Error("La partida guardada está dañada");
    return { meta: meta(value), bytes: value.bytes, sha256: value.sha256 };
  }

  /** The whole snapshot of a slot, checksum verified (to export it). */
  async record(slot: StateSlot): Promise<StoredState> {
    return StateStore.verified(await this.read(slot));
  }

  /** Returns the snapshot bytes after checking core, version and checksum. */
  async load(
    slot: StateSlot,
    core: string,
    coreVersion: string,
    coreName: (id: string) => string = (id) => id,
  ) {
    const value = await this.read(slot);
    snapshotFits(value, core, coreVersion, coreName);
    return (await StateStore.verified(value)).bytes;
  }

  async delete(slot: StateSlot) {
    const tx = this.db.transaction(["states", "meta"], "readwrite");
    tx.objectStore("states").delete(this.key(slot));
    tx.objectStore("meta").delete(this.key(slot));
    await done(tx);
  }

  close() {
    this.db.close();
    this.release();
  }
}
