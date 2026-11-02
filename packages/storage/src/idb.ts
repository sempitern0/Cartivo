// Promise adapters for IndexedDB, shared by every store in this package.

export function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Resolves once the transaction is durable; rejects on error or abort. */
export function done(tx: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () =>
      reject(tx.error ?? Error("Almacenamiento no disponible"));
    tx.onabort = () => reject(tx.error ?? Error("Operación cancelada"));
  });
}

/**
 * The browser offers no safe local storage here (no Web Locks, no IndexedDB,
 * or IndexedDB refuses to open: some private windows and restricted
 * profiles). The game can still run; nothing is saved.
 */
export class StorageUnavailable extends Error {}

/** Web Locks, the single-writer guarantee every store relies on. */
export function locks(): LockManager {
  if (typeof navigator === "undefined" || !navigator.locks)
    throw new StorageUnavailable(
      "Este navegador no permite coordinar el guardado. Usa un navegador con Web Locks.",
    );
  return navigator.locks;
}

/** Opens (and on first use creates) a database with one object store. */
export function openDatabase(
  name: string,
  store: string,
  blocked?: string,
): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined")
    return Promise.reject(
      new StorageUnavailable("Este navegador no permite guardar partidas."),
    );
  return new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(name, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(store);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () =>
      reject(
        new StorageUnavailable("Este navegador no permite guardar partidas.", {
          cause: req.error,
        }),
      );
    if (blocked) req.onblocked = () => reject(Error(blocked));
  });
}
