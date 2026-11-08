// Version 2 keeps a small metadata index alongside the unchanged snapshot bytes.
import { StorageUnavailable, request } from "./idb.ts";
import { scoped } from "./profiles.ts";
import { isStateSlot, MAX_STATE_BYTES, type StateMeta } from "./states.ts";

export function openStates(profile: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let blocked = false;
    const req = indexedDB.open(scoped("cartivo-states", profile), 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("states"))
        db.createObjectStore("states");
      const index = db.createObjectStore("meta");
      const cursor = req.transaction!.objectStore("states").openCursor();
      cursor.onsuccess = () => {
        const row = cursor.result;
        if (!row) return;
        if (validStateMeta(row.value)) {
          const { slot, core, coreVersion, frames, createdAt, size, preview } =
            row.value;
          index.put(
            { slot, core, coreVersion, frames, createdAt, size, preview },
            row.key,
          );
        }
        row.continue();
      };
    };
    req.onsuccess = () => {
      req.result.onversionchange = () => req.result.close();
      if (blocked) req.result.close();
      else resolve(req.result);
    };
    req.onerror = () =>
      reject(
        new StorageUnavailable("No se pueden consultar las partidas.", {
          cause: req.error,
        }),
      );
    req.onblocked = () => {
      blocked = true;
      reject(
        new StorageUnavailable(
          "Cierra otras pestañas de Cartivo para actualizar las partidas.",
        ),
      );
    };
  });
}
export function validStateMeta(value: unknown): value is StateMeta {
  if (!value || typeof value !== "object") return false;
  const v = value as StateMeta;
  return (
    isStateSlot(v.slot) &&
    typeof v.core === "string" &&
    typeof v.coreVersion === "string" &&
    Number.isSafeInteger(v.createdAt) &&
    v.createdAt >= 0 &&
    Number.isSafeInteger(v.size) &&
    v.size > 0 &&
    v.size <= MAX_STATE_BYTES &&
    Number.isSafeInteger(v.frames) &&
    v.frames >= 0
  );
}
export async function resumeIndex(
  profile: string,
): Promise<Map<string, StateMeta[]>> {
  const db = await openStates(profile);
  try {
    const tx = db.transaction("meta");
    const store = tx.objectStore("meta");
    const [keys, values] = await Promise.all([
      request(store.getAllKeys()),
      request(store.getAll()),
    ]);
    const result = new Map<string, StateMeta[]>();
    values.forEach((value, i) => {
      if (!validStateMeta(value) || typeof keys[i] !== "string") return;
      const [hash, slot] = String(keys[i]).split(":");
      if (!/^[a-f0-9]{64}$/.test(hash) || slot !== value.slot) return;
      result.set(hash, [...(result.get(hash) ?? []), value]);
    });
    return result;
  } finally {
    db.close();
  }
}
