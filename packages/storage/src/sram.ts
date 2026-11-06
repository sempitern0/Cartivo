/** IndexedDB transaction + two verified generations. Saves never enter Cache Storage. */
import { locks, openDatabase } from "./idb.ts";
import { PRINCIPAL, scoped } from "./profiles.ts";
type Generation = { bytes: Uint8Array; sha256: string };
type RecordValue = { current: Generation; previous?: Generation };
export async function digest(bytes: Uint8Array): Promise<string> {
  // WebCrypto snapshots ordinary ArrayBuffer views itself; avoid another
  // ROM-sized allocation. Shared memory still needs an ordinary copy.
  const input =
    bytes.buffer instanceof ArrayBuffer
      ? (bytes as Uint8Array<ArrayBuffer>)
      : Uint8Array.from(bytes);
  const hash = await crypto.subtle.digest("SHA-256", input);
  return Array.from(new Uint8Array(hash), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
async function valid(g: Generation | undefined, size: number) {
  return (
    !!g &&
    g.bytes instanceof Uint8Array &&
    g.bytes.length === size &&
    (await digest(g.bytes)) === g.sha256
  );
}
export class SramStore {
  private db: IDBDatabase;
  private key: string;
  private good: Generation | undefined;
  private release: () => void;
  recovered = false;
  /** Battery RAM size for this cartridge (`EmulatorCore.saveBytes`). */
  private size: number;
  private constructor(
    db: IDBDatabase,
    key: string,
    release: () => void,
    size: number,
  ) {
    this.size = size;
    this.db = db;
    this.key = key;
    this.release = release;
  }
  /** `profile` picks the profile's own database (ADR-016). */
  static async open(
    key: string,
    size = 8192,
    profile = PRINCIPAL,
  ): Promise<SramStore> {
    const lockManager = locks();
    let release!: () => void;
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    await new Promise<void>((resolve, reject) => {
      void lockManager
        .request(
          scoped("cartivo:sram:" + key, profile),
          { ifAvailable: true },
          async (lock) => {
            if (!lock) {
              reject(
                Error(
                  "Este juego ya está abierto en otra pestaña. Ciérrala antes de continuar.",
                ),
              );
              return;
            }
            resolve();
            await hold;
          },
        )
        .catch(reject);
    });
    try {
      const db = await openDatabase(
        scoped("cartivo-saves", profile),
        "sram",
        "Cierra otras pestañas para preparar el guardado.",
      );
      return new SramStore(db, key, release, size);
    } catch (e) {
      release();
      throw e;
    }
  }
  async load() {
    const record = await new Promise<RecordValue | undefined>(
      (resolve, reject) => {
        const req = this.db
          .transaction("sram")
          .objectStore("sram")
          .get(this.key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      },
    );
    if (!record) return;
    if (await valid(record.current, this.size)) this.good = record.current;
    else if (await valid(record.previous, this.size)) {
      this.good = record.previous;
      this.recovered = true;
    } else
      throw Error(
        "Las generaciones de la partida están dañadas. Conserva tus copias; no se sobrescribirá el guardado.",
      );
    return this.good!.bytes.slice();
  }
  async commit(bytes: Uint8Array) {
    if (bytes.length !== this.size) throw Error("SRAM de tamaño incorrecto");
    const current = { bytes: bytes.slice(), sha256: await digest(bytes) };
    if (this.good?.sha256 === current.sha256) return;
    const record: RecordValue = { current, previous: this.good };
    await new Promise<void>((resolve, reject) => {
      const tx = this.db.transaction("sram", "readwrite");
      tx.objectStore("sram").put(record, this.key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? Error("No se pudo guardar"));
      tx.onabort = () => reject(tx.error ?? Error("Guardado cancelado"));
    });
    this.good = current;
  }
  close() {
    this.db.close();
    this.release();
  }
}
