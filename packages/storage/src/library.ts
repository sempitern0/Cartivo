// Local library (ADR-012): games the player chose to remember on this device.
// The index lives in IndexedDB (small metadata, readable from the UI); ROM
// copies live in OPFS as roms/<sha256>, and a disc's files in the folder
// roms/<identity>/ (ADR-015), written and read only by the emulator Worker. Partidas and battery RAM are keyed by the same hash in
// their own stores, so forgetting a game never touches them.
// The catalogue is shared; personal indices retain history only (ADR-018).
import { done, request, locks } from "./idb.ts";
import { PRINCIPAL, scoped } from "./profiles.ts";
import { digest } from "./sram.ts";
import {
  catalogue,
  catalogueEntry,
  migratedProfiles,
  migrateTitles,
  overlayCatalogue,
  publicEntry,
  publishTitle,
  removeTitle,
} from "./catalogue.ts";
import type { DiscPart } from "./disc-identity.ts";

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
  /** «Ocultar para mí»: this profile does not list it (personal index only). */
  hidden?: true;
  /**
   * A disc (ADR-015): its files in roms/<hash>/, the boot file first. Absent
   * for a cartridge, whose copy is the single file roms/<hash>.
   */
  files?: DiscFile[];
};

export type DiscFile = { name: string; size: number };
/** As many files as a disc can have (99 tracks and its sheet). */
const MAX_DISC_FILES = 100;

const isDiscFile = (value: unknown): value is DiscFile => {
  if (!value || typeof value !== "object") return false;
  const f = value as Record<string, unknown>;
  return (
    typeof f.name === "string" &&
    /^[^/\\]{1,255}$/.test(f.name) &&
    f.name !== "." &&
    f.name !== ".." &&
    isTime(f.size)
  );
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
  if (e.hidden === true) entry.hidden = true;
  if (e.files !== undefined) {
    if (
      !Array.isArray(e.files) ||
      !e.files.length ||
      e.files.length > MAX_DISC_FILES ||
      !e.files.every(isDiscFile)
    )
      return undefined;
    entry.files = e.files.map(({ name, size }) => ({ name, size }));
  }
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
  const migrated = await migratedProfiles();
  const relevant = [...new Set([...profiles, profile])].filter(
    (id) => id === profile || !migrated.has(id),
  );
  const lists = await Promise.all(
    relevant.map(async (id) => {
      const entries = await listGames(id);
      if (!migrated.has(id)) await migrateTitles(id, entries);
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
  return catalogueEntry(hash).then((shared) =>
    withIndex(profile, async (db) => {
      const tx = db.transaction("games", "readwrite");
      const store = tx.objectStore("games");
      const entry = parseEntry(await request(store.get(hash))) ?? shared;
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
type FileDirectory = Pick<
  FileSystemDirectoryHandle,
  "getFileHandle" | "removeEntry"
> & {
  entries?(): AsyncIterableIterator<[string, FileSystemHandle]>;
};
export type RomDirectory = FileDirectory & {
  /** A disc's folder, roms/<hash>/. */
  getDirectoryHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<FileDirectory>;
};

/** Disc files are copied in pieces, so the game keeps running meanwhile. */
const COPY_CHUNK_BYTES = 4 * 1024 * 1024;

/** Writes `data` to `name`, replacing it, a piece at a time. */
async function writeFile(dir: FileDirectory, name: string, data: Blob) {
  const file = await dir.getFileHandle(name, { create: true });
  const sync = (
    file as unknown as { createSyncAccessHandle?: () => Promise<SyncHandle> }
  ).createSyncAccessHandle;
  const pieces = async function* () {
    for (let at = 0; at < data.size; at += COPY_CHUNK_BYTES)
      yield new Uint8Array(
        await data.slice(at, at + COPY_CHUNK_BYTES).arrayBuffer(),
      );
  };
  // Dedicated Workers (Safari included) offer synchronous handles; other
  // contexts fall back to a writable stream.
  if (typeof sync === "function") {
    const handle = await sync.call(file);
    try {
      handle.truncate(0);
      let at = 0;
      for await (const piece of pieces()) {
        if (handle.write(piece, { at }) !== piece.length)
          throw Error("Escritura incompleta");
        at += piece.length;
      }
      handle.flush();
    } finally {
      handle.close();
    }
    return;
  }
  const stream = await file.createWritable();
  try {
    for await (const piece of pieces())
      await stream.write(piece as BufferSource);
    await stream.close();
  } catch (error) {
    await stream.abort().catch(() => {});
    throw error;
  }
}

const writeRom = (dir: RomDirectory, hash: string, bytes: Uint8Array) =>
  writeFile(dir, hash, new Blob([bytes as BlobPart]));

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

/** Removes a cartridge copy or a disc's folder. */
async function removeRom(dir: RomDirectory, name: string) {
  try {
    await dir.removeEntry(name, { recursive: true });
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

/** The files a disc copy must hold, in order (the boot file first). */
export const discFiles = (parts: readonly DiscPart[]): DiscFile[] =>
  parts.map((p) => ({ name: p.name, size: p.blob.size }));

/** The copied disc's files in order, or undefined unless all are complete. */
async function discCopy(dir: RomDirectory, hash: string, files: DiscFile[]) {
  try {
    const folder = await dir.getDirectoryHandle(hash);
    const copies: File[] = [];
    for (const { name, size } of files) {
      const copy = await (await folder.getFileHandle(name)).getFile();
      if (copy.size !== size) return undefined;
      copies.push(copy);
    }
    return copies;
  } catch {
    return undefined;
  }
}

/**
 * Makes sure roms/<hash>/ holds these disc files. A complete copy is kept;
 * anything else is rewritten, and removed if it cannot be completed. Sizes
 * are checked here; the identity is computed again whenever the copy is
 * played (prepareDisc), so a damaged copy is refused then.
 */
export async function ensureDiscCopy(
  dir: RomDirectory,
  hash: string,
  parts: readonly DiscPart[],
) {
  const files = discFiles(parts);
  if (await discCopy(dir, hash, files)) return;
  await removeRom(dir, hash);
  try {
    const folder = await dir.getDirectoryHandle(hash, { create: true });
    for (const part of parts) await writeFile(folder, part.name, part.blob);
    if (!(await discCopy(dir, hash, files))) throw Error("Copia incompleta");
  } catch (error) {
    await removeRom(dir, hash);
    throw error;
  }
}

/** A remembered disc's files (boot file first), or undefined when missing. */
export async function storedDisc(
  hash: string,
  files: DiscFile[],
): Promise<File[] | undefined> {
  if (!isSha256(hash)) return undefined;
  try {
    return await discCopy(await romsDir(false), hash, files);
  } catch {
    return undefined;
  }
}

const MB = 1024 * 1024;
const megabytes = (bytes: number) => `${Math.ceil(bytes / MB)} MB`;

/**
 * Why a copy of `bytes` would not fit, from the browser's own estimate
 * (with a 5 % margin), or undefined when it fits or nothing is known.
 */
export async function spaceProblem(
  bytes: number,
  estimate: () => Promise<StorageEstimate> = () => navigator.storage.estimate(),
): Promise<string | undefined> {
  const { quota, usage } = await estimate().catch(
    () => ({}) as StorageEstimate,
  );
  if (quota === undefined || usage === undefined) return undefined;
  const free = Math.max(0, quota - usage);
  if (bytes * 1.05 <= free) return undefined;
  return `Este disco ocupa ${megabytes(bytes)} y el navegador solo deja ${megabytes(free)} libres para Cartivo, así que no se recordará. Sigue jugando desde tus archivos; tus partidas se guardan igual.`;
}

/** When a copy last changed: a file's date, or a disc folder's newest file. */
async function lastModified(handle: FileSystemHandle): Promise<number> {
  if (handle.kind === "file")
    return (await (handle as FileSystemFileHandle).getFile()).lastModified;
  const folder = handle as unknown as Required<Pick<RomDirectory, "entries">>;
  let newest = 0;
  for await (const [, inner] of folder.entries())
    newest = Math.max(newest, await lastModified(inner));
  return newest;
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
    if (known.has(name)) continue;
    if (now - (await lastModified(handle)) > ORPHAN_AGE_MS) stale.push(name);
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
  if (!isSha256(game.hash)) throw Error("Juego no identificado");
  return locks().request("cartivo:catalogue", async () => {
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
    await putEntry(profile, game.hash, {
      system: game.system,
      name: game.name,
      size: game.rom.length,
    });
  });
}

/**
 * Adds or refreshes the profile's history entry once the copy is in place,
 * and publishes the title to the shared catalogue (ADR-018).
 */
async function putEntry(
  profile: string,
  hash: string,
  game: Pick<LibraryEntry, "system" | "name" | "size" | "files">,
) {
  const now = Date.now();
  let entry: LibraryEntry | undefined;
  await withIndex(profile, async (db) => {
    const tx = db.transaction("games", "readwrite");
    const store = tx.objectStore("games");
    const previous = parseEntry(await request(store.get(hash)));
    entry = {
      ...previous,
      ...game,
      hash,
      name: (game.name || "Juego sin nombre").slice(0, MAX_NAME),
      addedAt: previous?.addedAt ?? now,
      lastPlayedAt: now,
    };
    if (!game.files) delete entry.files;
    // Opening the game again shows it again for this profile.
    delete entry.hidden;
    store.put(entry);
    await done(tx);
  });
  await publishTitle(entry!);
}

/**
 * Copies a disc's files to OPFS (unless a complete copy is already there)
 * and only then adds or refreshes its entry. Throws a readable message.
 * Shares the catalogue lock with the other writers and the pruning.
 */
export async function rememberDisc(
  game: {
    hash: string;
    system: string;
    name: string;
    parts: readonly DiscPart[];
  },
  profile = PRINCIPAL,
) {
  if (!isSha256(game.hash)) throw Error("Juego no identificado");
  const files = discFiles(game.parts);
  const bytes = files.reduce((total, f) => total + f.size, 0);
  const tooBig = await spaceProblem(bytes);
  if (tooBig) throw Error(tooBig);
  return locks().request("cartivo:catalogue", async () => {
    try {
      await ensureDiscCopy(await romsDir(true), game.hash, game.parts);
    } catch (error) {
      throw Error(
        error instanceof DOMException && error.name === "QuotaExceededError"
          ? "No hay espacio para recordar este disco. Puedes seguir jugando desde tus archivos; tus partidas se guardan igual."
          : "No se pudo recordar este disco en el dispositivo. Puedes seguir jugando desde tus archivos; tus partidas se guardan igual.",
        { cause: error },
      );
    }
    await putEntry(profile, game.hash, {
      system: game.system,
      name: game.name,
      size: bytes,
      files,
    });
  });
}

/** «Ocultar para mí» / «Mostrar»: only this profile's list changes. */
export async function setHidden(
  entry: LibraryEntry,
  hidden: boolean,
  profile = PRINCIPAL,
) {
  await withIndex(profile, async (db) => {
    const tx = db.transaction("games", "readwrite");
    const store = tx.objectStore("games");
    const own = parseEntry(await request(store.get(entry.hash)));
    // A title this profile never played gets a history entry to hold it.
    const next: LibraryEntry = own ?? { ...publicEntry(entry) };
    if (hidden) next.hidden = true;
    else delete next.hidden;
    store.put(next);
    await done(tx);
  });
}

/**
 * «Eliminar del dispositivo»: the title leaves every profile's list and its
 * copy is deleted now, under the lock writers and pruning share. Partidas
 * and battery RAM are separate stores and stay.
 */
export function deleteTitle(hash: string) {
  if (!isSha256(hash)) return Promise.resolve();
  return locks().request("cartivo:catalogue", async () => {
    await removeTitle(hash);
    const roms = await romsDir(false).catch(() => undefined);
    if (roms) await removeRom(roms, hash);
  });
}

/** Call only after legacy indices have been migrated. Serialize with writers. */
export function pruneSharedRoms() {
  return locks().request("cartivo:catalogue", async () =>
    pruneOrphanRoms(new Set((await catalogue()).map((entry) => entry.hash))),
  );
}
