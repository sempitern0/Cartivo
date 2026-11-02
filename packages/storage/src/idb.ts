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
