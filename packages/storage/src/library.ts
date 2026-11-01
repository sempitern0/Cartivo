// Local library (ADR-012): games the player chose to remember on this device.
// The index lives in IndexedDB (small metadata, readable from the UI); ROM
// copies live in OPFS as roms/<sha256> and are written and read only by the
// emulator Worker. Partidas and battery RAM are keyed by the same hash in
// their own stores, so forgetting a game never touches them.
import { digest } from "./sram.ts";

export type LibraryEntry = {
  /** SHA-256 of the ROM (lowercase hex); also its OPFS file name. */
  hash: string;
  /** System id (packages/runtime/src/systems.ts). */
  system: string;
  /** File name the player opened, shown as the title. */
  name: string;
  size: number;
  addedAt: number;
  lastPlayedAt: number;
  /** RGBA 128×120 thumbnail of the last «Al salir» snapshot. */
  preview?: Uint8ClampedArray;
};

export const MAX_NAME = 255;
export const REMEMBER_KEY = "cartivo:library:remember:v1";

export const isSha256 = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{64}$/.test(value);

const isTime = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;

/** Runtime validation of a stored entry; anything malformed is ignored. */
export function parseEntry(value: unknown): LibraryEntry | undefined {
  if (!value || typeof value !== "object") return undefined;
  const e = value as Record<string, unknown>;
  if (
    !isSha256(e.hash) ||
    typeof e.system !== "string" ||
    !/^[a-z0-9-]{1,32}$/.test(e.system) ||
    typeof e.name !== "string" ||
    !e.name ||
    e.name.length > MAX_NAME ||
    !isTime(e.size) ||
    !isTime(e.addedAt) ||
    !isTime(e.lastPlayedAt)
  )
    return undefined;
  const entry: LibraryEntry = {
    hash: e.hash,
    system: e.system,
    name: e.name,
    size: e.size,
    addedAt: e.addedAt,
    lastPlayedAt: e.lastPlayedAt,
  };
  if (
    e.preview instanceof Uint8ClampedArray &&
    e.preview.length === 128 * 120 * 4
  )
    entry.preview = e.preview;
  return entry;
}

/** Most recently played first. */
export const byRecent = (entries: readonly LibraryEntry[]) =>
  [...entries].sort((a, b) => b.lastPlayedAt - a.lastPlayedAt);

/** The player's one-time answer: true, false or undefined (not asked yet). */
export function readRemember(storage?: Pick<Storage, "getItem">) {
  try {
    const value = (storage ?? localStorage).getItem(REMEMBER_KEY);
    return value === "yes" ? true : value === "no" ? false : undefined;
  } catch {
    return undefined;
  }
}

/** Returns false when the browser does not allow keeping the choice. */
export function writeRemember(
  value: boolean,
  storage?: Pick<Storage, "setItem">,
) {
  try {
    (storage ?? localStorage).setItem(REMEMBER_KEY, value ? "yes" : "no");
    return true;
  } catch {
    return false;
  }
}

function request<T>(req: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function done(tx: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? Error("Biblioteca no disponible"));
    tx.onabort = () => reject(tx.error ?? Error("Operación cancelada"));
  });
}

function openIndex() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open("cartivo-library", 1);
    req.onupgradeneeded = () =>
      req.result.createObjectStore("games", { keyPath: "hash" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withIndex<T>(use: (db: IDBDatabase) => Promise<T>) {
  const db = await openIndex();
  try {
    return await use(db);
  } finally {
    db.close();
  }
}

export function listGames(): Promise<LibraryEntry[]> {
  return withIndex(async (db) => {
    const all = await request(
      db.transaction("games", "readonly").objectStore("games").getAll(),
    );
    return byRecent(all.map(parseEntry).filter((e): e is LibraryEntry => !!e));
  });
}

export function getGame(hash: string): Promise<LibraryEntry | undefined> {
  return withIndex(async (db) =>
    parseEntry(
      await request(
        db.transaction("games", "readonly").objectStore("games").get(hash),
      ),
    ),
  );
}

/** Merges `patch` into an existing entry; does nothing if it is not there. */
export function updateGame(
  hash: string,
  patch: Partial<Pick<LibraryEntry, "lastPlayedAt" | "preview" | "name">>,
): Promise<boolean> {
  return withIndex(async (db) => {
    const tx = db.transaction("games", "readwrite");
    const store = tx.objectStore("games");
    const entry = parseEntry(await request(store.get(hash)));
    if (entry) store.put({ ...entry, ...patch });
    await done(tx);
    return !!entry;
  });
}

async function romsDir(create: boolean) {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle("roms", { create });
}

type SyncHandle = {
  truncate(size: number): void;
  write(data: Uint8Array, options: { at: number }): number;
  flush(): void;
  close(): void;
};

async function writeRom(hash: string, bytes: Uint8Array) {
  const file = await (
    await romsDir(true)
  ).getFileHandle(hash, {
    create: true,
  });
  const sync = (
    file as unknown as { createSyncAccessHandle?: () => Promise<SyncHandle> }
  ).createSyncAccessHandle;
  // Dedicated Workers (Safari included) offer synchronous handles; other
  // contexts fall back to a writable stream.
  if (typeof sync === "function") {
    const handle = await sync.call(file);
    try {
      handle.truncate(0);
      if (handle.write(bytes, { at: 0 }) !== bytes.length)
        throw Error("Escritura incompleta");
      handle.flush();
    } finally {
      handle.close();
    }
    return;
  }
  const stream = await file.createWritable();
  try {
    await stream.write(bytes as BufferSource);
    await stream.close();
  } catch (error) {
    await stream.abort().catch(() => {});
    throw error;
  }
}

/** The stored ROM copy as a File, or undefined when it is not there. */
export async function storedRom(hash: string): Promise<File | undefined> {
  if (!isSha256(hash)) return undefined;
  try {
    return await (await (await romsDir(false)).getFileHandle(hash)).getFile();
  } catch {
    return undefined;
  }
}

async function removeRom(hash: string) {
  try {
    await (await romsDir(false)).removeEntry(hash);
  } catch {
    // Already gone.
  }
}

/**
 * Copies a ROM to OPFS, reads it back to check its hash and only then adds
 * (or refreshes) its entry. Throws a readable message; leaves no copy behind
 * on failure.
 */
export async function rememberGame(game: {
  hash: string;
  system: string;
  name: string;
  rom: Uint8Array;
}) {
  if (!isSha256(game.hash)) throw Error("Juego no identificado");
  try {
    await writeRom(game.hash, game.rom);
    const copy = await storedRom(game.hash);
    if (
      !copy ||
      copy.size !== game.rom.length ||
      (await digest(new Uint8Array(await copy.arrayBuffer()))) !== game.hash
    )
      throw Error("Copia no verificada");
  } catch (error) {
    await removeRom(game.hash);
    throw Error(
      error instanceof DOMException && error.name === "QuotaExceededError"
        ? "No hay espacio para recordar este juego. Puedes seguir jugando; tus partidas se guardan igual."
        : "No se pudo recordar este juego en el dispositivo. Puedes seguir jugando; tus partidas se guardan igual.",
      { cause: error },
    );
  }
  const now = Date.now();
  await withIndex(async (db) => {
    const tx = db.transaction("games", "readwrite");
    const store = tx.objectStore("games");
    const previous = parseEntry(await request(store.get(game.hash)));
    const entry: LibraryEntry = {
      ...previous,
      hash: game.hash,
      system: game.system,
      name: (game.name || "Juego sin nombre").slice(0, MAX_NAME),
      size: game.rom.length,
      addedAt: previous?.addedAt ?? now,
      lastPlayedAt: now,
    };
    store.put(entry);
    await done(tx);
  });
}

/**
 * Removes the ROM copy and its entry. Partidas («cartivo-states») and
 * battery RAM («cartivo-saves») are separate stores and stay untouched.
 */
export async function forgetGame(hash: string) {
  if (!isSha256(hash)) return;
  await removeRom(hash);
  await withIndex(async (db) => {
    const tx = db.transaction("games", "readwrite");
    tx.objectStore("games").delete(hash);
    await done(tx);
  });
}
