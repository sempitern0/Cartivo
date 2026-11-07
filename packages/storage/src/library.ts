// Local library (ADR-012): games the player chose to remember on this device.
// The index lives in IndexedDB (small metadata, readable from the UI); ROM
// copies live in OPFS as roms/<sha256> and are written and read only by the
// emulator Worker. Partidas and battery RAM are keyed by the same hash in
// their own stores, so forgetting a game never touches them.
// The catalogue is shared; personal indices retain history only (ADR-017).
import { done, request, locks } from "./idb.ts";
import { PRINCIPAL, scoped } from "./profiles.ts";
import { digest } from "./sram.ts";
import {
  catalogue,
  migrateTitles,
  overlayCatalogue,
  publishTitle,
} from "./catalogue.ts";

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
/**
 * Only stores "off": remembering is the default (ADR-012, revision). A new
 * key, so the old one-time answer (v1) simply no longer counts.
 */
export const REMEMBER_KEY = "cartivo:library:remember:v2";

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
export const byRecent = <T extends LibraryEntry>(entries: readonly T[]) =>
  [...entries].sort((a, b) => b.lastPlayedAt - a.lastPlayedAt);

/** Whether opened files are remembered: yes unless the player turned it off. */
export function rememberGames(storage?: Pick<Storage, "getItem">) {
  try {
    return (storage ?? localStorage).getItem(REMEMBER_KEY) !== "off";
  } catch {
    return true;
  }
}

/** Returns false when the browser does not allow keeping the choice. */
export function writeRemember(
  on: boolean,
  storage?: Pick<Storage, "setItem" | "removeItem">,
) {
  try {
    const store = storage ?? localStorage;
    if (on) store.removeItem(REMEMBER_KEY);
    else store.setItem(REMEMBER_KEY, "off");
    return true;
  } catch {
    return false;
  }
}

export type GameSort = "recent" | "name";
export type GameView = { query: string; system: string; sort: GameSort };

/** Lowercase and without accents, so «pokémon» finds «Pokemon». */
const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

/** The «Tus juegos» page: search by name, one console (or ""), an order. */
export function viewGames<T extends LibraryEntry>(
  entries: readonly T[],
  { query, system, sort }: GameView,
) {
  const words = fold(query).split(/\s+/).filter(Boolean);
  const shown = entries.filter(
    (e) =>
      (!system || e.system === system) &&
      words.every((w) => fold(e.name).includes(w)),
  );
  return sort === "name"
    ? shown.sort((a, b) => a.name.localeCompare(b.name, "es"))
    : byRecent(shown);
}

function openIndex(profile: string) {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(scoped("cartivo-library", profile), 1);
    req.onupgradeneeded = () =>
      req.result.createObjectStore("games", { keyPath: "hash" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withIndex<T>(
  profile: string,
  use: (db: IDBDatabase) => Promise<T>,
) {
  const db = await openIndex(profile);
  try {
    return await use(db);
  } finally {
    db.close();
  }
}

export function listGames(profile = PRINCIPAL): Promise<LibraryEntry[]> {
  return withIndex(profile, async (db) => {
    const all = await request(
      db.transaction("games", "readonly").objectStore("games").getAll(),
    );
    return byRecent(all.map(parseEntry).filter((e): e is LibraryEntry => !!e));
  });
}

/** Common catalogue, overlaid only with the selected profile's history. */
export async function sharedGames(
  profile: string,
  profiles: readonly string[],
) {
  const lists = await Promise.all(
    profiles.map(async (id) => {
      const entries = await listGames(id);
      await migrateTitles(id, entries);
      return { id, entries };
    }),
  );
  return byRecent(
    overlayCatalogue(
      await catalogue(),
      lists.find((list) => list.id === profile)?.entries ?? [],
    ),
  );
}

/** Merges `patch` into an existing entry; does nothing if it is not there. */
export function updateGame(
  hash: string,
  patch: Partial<Pick<LibraryEntry, "lastPlayedAt" | "preview" | "name">>,
  profile = PRINCIPAL,
): Promise<boolean> {
  return catalogue().then((shared) =>
    withIndex(profile, async (db) => {
      const tx = db.transaction("games", "readwrite");
      const store = tx.objectStore("games");
      const entry =
        parseEntry(await request(store.get(hash))) ??
        shared.find((game) => game.hash === hash);
      if (entry) store.put({ ...entry, ...patch });
      await done(tx);
      return !!entry;
    }),
  );
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

/** The part of an OPFS directory the library uses (tests pass a fake). */
export type RomDirectory = Pick<
  FileSystemDirectoryHandle,
  "getFileHandle" | "removeEntry"
> & {
  entries?(): AsyncIterableIterator<[string, FileSystemHandle]>;
};

async function writeRom(dir: RomDirectory, hash: string, bytes: Uint8Array) {
  const file = await dir.getFileHandle(hash, { create: true });
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

async function readCopy(dir: RomDirectory, hash: string) {
  try {
    return await (await dir.getFileHandle(hash)).getFile();
  } catch {
    return undefined;
  }
}

/** True when the copy exists and is exactly the game with this hash. */
async function verified(copy: File | undefined, hash: string, size: number) {
  return (
    !!copy &&
    copy.size === size &&
    (await digest(new Uint8Array(await copy.arrayBuffer()))) === hash
  );
}

/** The stored ROM copy as a File, or undefined when it is not there. */
export async function storedRom(hash: string): Promise<File | undefined> {
  if (!isSha256(hash)) return undefined;
  try {
    return await readCopy(await romsDir(false), hash);
  } catch {
    return undefined;
  }
}

async function removeRom(dir: RomDirectory, name: string) {
  try {
    await dir.removeEntry(name);
  } catch {
    // Already gone.
  }
}

/**
 * Makes sure roms/<hash> holds this exact ROM. Copies are content-addressed,
 * so a verified copy is kept as it is: a failed rewrite can never destroy a
 * good one. Only a missing or damaged copy is (re)written, and removed again
 * if it cannot be verified.
 */
export async function ensureRomCopy(
  dir: RomDirectory,
  hash: string,
  rom: Uint8Array,
) {
  if (await verified(await readCopy(dir, hash), hash, rom.length)) return;
  try {
    await writeRom(dir, hash, rom);
    if (!(await verified(await readCopy(dir, hash), hash, rom.length)))
      throw Error("Copia no verificada");
  } catch (error) {
    await removeRom(dir, hash);
    throw error;
  }
}

/** Copies older than this with no index entry are leftovers (ADR-012). */
export const ORPHAN_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Removes ROM files that no index entry points to: what an interrupted
 * remember or forget may leave. Recent files are kept, since the Worker
 * may be writing one right now. Returns how many were removed.
 */
export async function pruneOrphanRoms(
  known: ReadonlySet<string>,
  now = Date.now(),
  dir?: RomDirectory,
): Promise<number> {
  // entries() is in every target browser but not in all DOM typings.
  const roms: RomDirectory | undefined =
    dir ?? (await romsDir(false).catch(() => undefined));
  if (!roms?.entries) return 0;
  const stale: string[] = [];
  for await (const [name, handle] of roms.entries()) {
    if (handle.kind !== "file" || known.has(name)) continue;
    const file = await (handle as FileSystemFileHandle).getFile();
    if (now - file.lastModified > ORPHAN_AGE_MS) stale.push(name);
  }
  for (const name of stale) await removeRom(roms, name);
  return stale.length;
}

/**
 * Copies a ROM to OPFS (unless a verified copy is already there) and only
 * then adds or refreshes its entry. Throws a readable message.
 */
export async function rememberGame(
  game: {
    hash: string;
    system: string;
    name: string;
    rom: Uint8Array;
  },
  profile = PRINCIPAL,
) {
  return locks().request("cartivo:catalogue", async () => {
    if (!isSha256(game.hash)) throw Error("Juego no identificado");
    try {
      await ensureRomCopy(await romsDir(true), game.hash, game.rom);
    } catch (error) {
      throw Error(
        error instanceof DOMException && error.name === "QuotaExceededError"
          ? "No hay espacio para recordar este juego. Puedes seguir jugando; tus partidas se guardan igual."
          : "No se pudo recordar este juego en el dispositivo. Puedes seguir jugando; tus partidas se guardan igual.",
        { cause: error },
      );
    }
    const now = Date.now();
    await withIndex(profile, async (db) => {
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
      await publishTitle(entry);
    });
  });
}

/** Call only after legacy indices have been migrated. Serialize with writers. */
export function pruneSharedRoms() {
  return locks().request("cartivo:catalogue", async () =>
    pruneOrphanRoms(new Set((await catalogue()).map((entry) => entry.hash))),
  );
}
