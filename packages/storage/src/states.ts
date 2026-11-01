// «Partidas»: full-console snapshots stored per game and slot (ADR-009).
// Separate from battery RAM (sram.ts): a snapshot is tied to one core and
// version, battery RAM is shared by every core.
import { digest } from "./sram.ts";

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

export function isStateSlot(value: unknown): value is StateSlot {
  return (stateSlots as readonly unknown[]).includes(value);
}

/** Halves a 256×240 RGBA frame into a 128×120 preview. */
export function makePreview(pixels: Uint8ClampedArray, width = 256) {
  const out = new Uint8ClampedArray(PREVIEW_WIDTH * PREVIEW_HEIGHT * 4);
  for (let y = 0; y < PREVIEW_HEIGHT; y++)
    for (let x = 0; x < PREVIEW_WIDTH; x++) {
      const from = (y * 2 * width + x * 2) * 4;
      out.set(pixels.subarray(from, from + 4), (y * PREVIEW_WIDTH + x) * 4);
    }
  return out;
}

const meta = ({ bytes: _b, sha256: _s, ...rest }: StateRecord): StateMeta =>
  rest;

function request<T>(req: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

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
  static async open(game: string): Promise<StateStore> {
    if (!navigator.locks)
      throw Error(
        "Este navegador no permite coordinar el guardado. Usa un navegador con Web Locks.",
      );
    let release!: () => void;
    const hold = new Promise<void>((resolve) => (release = resolve));
    // A session closed a moment ago in this tab may still be releasing its
    // lock (its Worker is terminating); retry briefly before refusing.
    let acquired = false;
    for (let attempt = 0; attempt < 10 && !acquired; attempt++) {
      if (attempt) await new Promise((r) => setTimeout(r, 100));
      acquired = await new Promise<boolean>((resolve, reject) => {
        void navigator.locks
          .request(
            "cartivo:game:" + game,
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
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open("cartivo-states", 1);
        req.onupgradeneeded = () => req.result.createObjectStore("states");
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
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
    if (!bytes.length || bytes.length > MAX_STATE_BYTES)
      throw Error("La partida supera el tamaño admitido (8 MB)");
    const record: StateRecord = {
      ...info,
      slot,
      size: bytes.length,
      createdAt: Date.now(),
      bytes: Uint8Array.from(bytes),
      sha256: await digest(bytes),
    };
    const tx = this.db.transaction("states", "readwrite");
    tx.objectStore("states").put(record, this.key(slot));
    // Only report success once the transaction is durable.
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? Error("No se pudo guardar"));
      tx.onabort = () => reject(tx.error ?? Error("Guardado cancelado"));
    });
    return meta(record);
  }

  /** Returns the snapshot bytes after checking core, version and checksum. */
  async load(slot: StateSlot, core: string, coreVersion: string) {
    const tx = this.db.transaction("states", "readonly");
    const value = (await request(
      tx.objectStore("states").get(this.key(slot)),
    )) as StateRecord | undefined;
    if (!value) throw Error("Esa ranura está vacía");
    if (value.core !== core)
      throw Error(
        `Esta partida se guardó con ${value.core === "jsnes" ? "JSNES" : "TetaNES"}. Cambia de núcleo en Acerca de esta prueba para cargarla.`,
      );
    if (value.coreVersion !== coreVersion)
      throw Error(
        `Esta partida es de otra versión del núcleo (${value.coreVersion}) y no se puede cargar. Se conserva sin cambios.`,
      );
    if (
      !(value.bytes instanceof Uint8Array) ||
      (await digest(value.bytes)) !== value.sha256
    )
      throw Error("La partida guardada está dañada");
    return value.bytes;
  }

  async delete(slot: StateSlot) {
    const tx = this.db.transaction("states", "readwrite");
    tx.objectStore("states").delete(this.key(slot));
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  close() {
    this.db.close();
    this.release();
  }
}
