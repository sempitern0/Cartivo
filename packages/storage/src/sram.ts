/** IndexedDB transaction + two verified generations. Saves never enter Cache Storage. */
type Generation = { bytes: Uint8Array; sha256: string };
type RecordValue = { current: Generation; previous?: Generation };
export async function digest(bytes: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes));
  return Array.from(new Uint8Array(hash), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
async function valid(g: Generation | undefined) {
  return (
    !!g &&
    g.bytes instanceof Uint8Array &&
    g.bytes.length === 8192 &&
    (await digest(g.bytes)) === g.sha256
  );
}
export class SramStore {
  private db: IDBDatabase;
  private key: string;
  private good: Generation | undefined;
  private release: () => void;
  recovered = false;
  private constructor(db: IDBDatabase, key: string, release: () => void) {
    this.db = db;
    this.key = key;
    this.release = release;
  }
  static async open(key: string): Promise<SramStore> {
    if (!navigator.locks)
      throw Error(
        "Este navegador no permite coordinar el guardado. Usa un navegador con Web Locks.",
      );
    let release!: () => void;
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    await new Promise<void>((resolve, reject) => {
      void navigator.locks
        .request("cartivo:sram:" + key, { ifAvailable: true }, async (lock) => {
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
        })
        .catch(reject);
    });
    try {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open("cartivo-saves", 1);
        req.onupgradeneeded = () => req.result.createObjectStore("sram");
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        req.onblocked = () =>
          reject(Error("Cierra otras pestañas para preparar el guardado."));
      });
      return new SramStore(db, key, release);
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
    if (await valid(record.current)) this.good = record.current;
    else if (await valid(record.previous)) {
      this.good = record.previous;
      this.recovered = true;
    } else
      throw Error(
        "Las generaciones de la partida están dañadas. Conserva tus copias; no se sobrescribirá el guardado.",
      );
    return this.good!.bytes.slice();
  }
  async commit(bytes: Uint8Array) {
    if (bytes.length !== 8192) throw Error("SRAM de tamaño incorrecto");
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
