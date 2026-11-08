// Device-wide titles only. Personal history and snapshots never enter this DB.
import { done, request } from "./idb.ts";
import { parseEntry, type LibraryEntry } from "./library.ts";

export const CATALOGUE_DB = "cartivo-catalogue";
/** What every profile shares: the title and, for a disc, its files. */
export function publicEntry(entry: LibraryEntry): LibraryEntry {
  const { hash, system, name, size, addedAt, files } = entry;
  const shared: LibraryEntry = {
    hash,
    system,
    name,
    size,
    addedAt,
    lastPlayedAt: 0,
  };
  if (files) shared.files = files;
  return shared;
}
export function overlayCatalogue(
  shared: readonly LibraryEntry[],
  personal: readonly LibraryEntry[],
) {
  const own = new Map(personal.map((entry) => [entry.hash, entry]));
  return shared.map((entry) => {
    const history = own.get(entry.hash);
    const card: LibraryEntry = {
      ...publicEntry(entry),
      lastPlayedAt: history?.lastPlayedAt ?? 0,
      preview: history?.preview,
    };
    if (history?.hidden) card.hidden = true;
    return card;
  });
}
async function open() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(CATALOGUE_DB, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore("games", { keyPath: "hash" });
      req.result.createObjectStore("migrated");
      req.result.createObjectStore("removed");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
export async function publishTitle(entry: LibraryEntry) {
  const db = await open();
  try {
    const tx = db.transaction(["games", "removed"], "readwrite");
    tx.objectStore("games").put(publicEntry(entry));
    tx.objectStore("removed").delete(entry.hash);
    await done(tx);
  } finally {
    db.close();
  }
}
/** One atomic, repeatable import per legacy profile. Never deletes legacy data. */
export async function migrateTitles(
  profile: string,
  entries: readonly LibraryEntry[],
) {
  const db = await open();
  try {
    const tx = db.transaction(["games", "migrated", "removed"], "readwrite");
    const markers = tx.objectStore("migrated");
    if (await request(markers.get(profile))) {
      await done(tx);
      return;
    }
    for (const entry of entries) {
      const games = tx.objectStore("games");
      if (
        !(await request(tx.objectStore("removed").get(entry.hash))) &&
        !(await request(games.get(entry.hash)))
      )
        games.put(publicEntry(entry));
    }
    markers.put(true, profile);
    await done(tx);
  } finally {
    db.close();
  }
}
export async function catalogue(): Promise<LibraryEntry[]> {
  const db = await open();
  try {
    const rows = await request(
      db.transaction("games").objectStore("games").getAll(),
    );
    return rows.map(parseEntry).filter((e): e is LibraryEntry => !!e);
  } finally {
    db.close();
  }
}
/** Logical removal only. Copies are pruned after the grace period, never mid-load. */
export async function removeTitle(hash: string) {
  const db = await open();
  try {
    const tx = db.transaction(["games", "removed"], "readwrite");
    tx.objectStore("games").delete(hash);
    tx.objectStore("removed").put(true, hash);
    await done(tx);
  } finally {
    db.close();
  }
}

/** Avoid reading every profile's thumbnails once its legacy catalogue is imported. */
export async function migratedProfiles(): Promise<Set<string>> {
  const db = await open();
  try {
    const keys = await request(
      db.transaction("migrated").objectStore("migrated").getAllKeys(),
    );
    return new Set(
      keys.filter((key): key is string => typeof key === "string"),
    );
  } finally {
    db.close();
  }
}
export async function catalogueEntry(
  hash: string,
): Promise<LibraryEntry | undefined> {
  const db = await open();
  try {
    return parseEntry(
      await request(db.transaction("games").objectStore("games").get(hash)),
    );
  } finally {
    db.close();
  }
}
