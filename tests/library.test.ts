import { test } from "node:test";
import assert from "node:assert/strict";
import {
  byRecent,
  discFiles,
  ensureDiscCopy,
  ensureRomCopy,
  spaceProblem,
  isSha256,
  ORPHAN_AGE_MS,
  pruneOrphanRoms,
  parseEntry,
  rememberGames,
  viewGames,
  writeRemember,
  REMEMBER_KEY,
  type GameView,
  type LibraryEntry,
} from "../packages/storage/src/library.ts";
import { parseRequest } from "../packages/runtime/src/protocol.ts";
import { digest } from "../packages/storage/src/sram.ts";

const hash = "a".repeat(64);
const entry = {
  hash,
  system: "gba",
  name: "mi-juego.gba",
  size: 4096,
  addedAt: 1,
  lastPlayedAt: 2,
};

test("library entries are validated at runtime", () => {
  assert.deepEqual(parseEntry(entry), entry);
  const preview = new Uint8ClampedArray(128 * 120 * 4);
  assert.equal(parseEntry({ ...entry, preview })?.preview, preview);
  // A wrong-sized thumbnail is dropped, not trusted.
  assert.equal(
    parseEntry({ ...entry, preview: new Uint8ClampedArray(4) })?.preview,
    undefined,
  );
  for (const bad of [
    null,
    "x",
    { ...entry, hash: "A".repeat(64) },
    { ...entry, hash: "a".repeat(63) },
    { ...entry, system: "../nes" },
    { ...entry, name: "" },
    { ...entry, name: "x".repeat(256) },
    { ...entry, size: -1 },
    { ...entry, lastPlayedAt: 1.5 },
  ])
    assert.equal(parseEntry(bad), undefined);
});

test("the library lists the most recently played game first", () => {
  const old = { ...entry, hash: "b".repeat(64), lastPlayedAt: 1 };
  const recent = { ...entry, hash: "c".repeat(64), lastPlayedAt: 9 };
  const input = [old, recent];
  assert.deepEqual(
    byRecent(input).map((e) => e.lastPlayedAt),
    [9, 1],
  );
  assert.equal(input[0], old, "the input is not reordered");
});

test("games are remembered unless the player turned it off", () => {
  const data = new Map<string, string>([["cartivo:library:remember:v1", "no"]]);
  const storage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
  // The old one-time «No» (v1) no longer counts.
  assert.equal(rememberGames(storage), true);
  assert.equal(writeRemember(false, storage), true);
  assert.equal(data.get(REMEMBER_KEY), "off");
  assert.equal(rememberGames(storage), false);
  writeRemember(true, storage);
  assert.equal(data.has(REMEMBER_KEY), false);
  assert.equal(rememberGames(storage), true);
  const blocked = {
    getItem: () => {
      throw Error("blocked");
    },
    setItem: () => {
      throw Error("blocked");
    },
    removeItem: () => {
      throw Error("blocked");
    },
  };
  assert.equal(rememberGames(blocked), true);
  assert.equal(writeRemember(true, blocked), false);
});

test("the games page searches, filters by console and sorts", () => {
  const game = (name: string, system: string, lastPlayedAt: number) =>
    ({ hash, system, name, size: 1, addedAt: 0, lastPlayedAt }) as LibraryEntry;
  const games = [
    game("Pokémon Rojo", "gb", 3),
    game("Zelda", "gba", 9),
    game("Pokemon Esmeralda", "gba", 5),
  ];
  const names = (view: Partial<GameView>) =>
    viewGames(games, { query: "", system: "", sort: "recent", ...view }).map(
      (g) => g.name,
    );
  assert.deepEqual(names({}), ["Zelda", "Pokemon Esmeralda", "Pokémon Rojo"]);
  assert.deepEqual(names({ query: "POKEMON" }), [
    "Pokemon Esmeralda",
    "Pokémon Rojo",
  ]);
  assert.deepEqual(names({ query: "pokémon rojo" }), ["Pokémon Rojo"]);
  assert.deepEqual(names({ system: "gba", sort: "name" }), [
    "Pokemon Esmeralda",
    "Zelda",
  ]);
  assert.deepEqual(names({ query: "mario" }), []);
  assert.equal(games[0].name, "Pokémon Rojo", "the input is not reordered");
});

test("hashes are lowercase SHA-256 hex", () => {
  assert.equal(isSha256(hash), true);
  assert.equal(isSha256("g".repeat(64)), false);
  assert.equal(isSha256(undefined), false);
});

const base = { v: 1, session: "s", id: 1 } as const;
const file = new File([new Uint8Array(1)], "juego.gb");

test("load accepts a remembered game by hash", () => {
  const r = parseRequest({ ...base, command: "load", stored: hash });
  assert.equal(r.stored, hash);
  for (const stored of ["", "../roms", "A".repeat(64), 42])
    assert.throws(() => parseRequest({ ...base, command: "load", stored }));
  // One source per load.
  assert.throws(() =>
    parseRequest({ ...base, command: "load", stored: hash, file }),
  );
  assert.throws(() =>
    parseRequest({ ...base, command: "load", stored: hash, demo: true }),
  );
});

test("only games opened from a file can be remembered", () => {
  assert.equal(
    parseRequest({ ...base, command: "load", file, remember: true }).remember,
    true,
  );
  assert.throws(() =>
    parseRequest({ ...base, command: "load", demo: true, remember: true }),
  );
  assert.throws(() =>
    parseRequest({ ...base, command: "load", file, remember: "yes" }),
  );
  // The one-time question and its request are gone: `load` remembers.
  assert.throws(() => parseRequest({ ...base, command: "library-add" }));
});

// A minimal in-memory OPFS directory with fault injection (ADR-012).
class FakeDir {
  files = new Map<string, { bytes: Uint8Array; lastModified: number }>();
  dirs = new Map<string, FakeDir>();
  failWrites = false;
  writes = 0;
  async getDirectoryHandle(name: string, options?: { create?: boolean }) {
    if (!this.dirs.has(name)) {
      if (!options?.create) throw new DOMException("missing", "NotFoundError");
      const child = new FakeDir();
      child.failWrites = this.failWrites;
      this.dirs.set(name, child);
    }
    return this.dirs.get(name)!;
  }
  async getFileHandle(name: string, options?: { create?: boolean }) {
    if (!this.files.has(name)) {
      if (!options?.create) throw new DOMException("missing", "NotFoundError");
      this.files.set(name, { bytes: new Uint8Array(), lastModified: 0 });
    }
    const dir = this;
    return {
      kind: "file",
      async getFile() {
        const f = dir.files.get(name)!;
        return new File([f.bytes as BlobPart], name, {
          lastModified: f.lastModified,
        });
      },
      async createWritable() {
        dir.writes++;
        // Like a real truncate-and-write, a failure leaves a broken file.
        dir.files.set(name, { bytes: new Uint8Array(1), lastModified: 0 });
        let written = new Uint8Array();
        return {
          // Pieces are appended, as a stream does.
          write: async (piece: Uint8Array) => {
            if (dir.failWrites)
              throw new DOMException("full", "QuotaExceededError");
            const next = new Uint8Array(written.length + piece.length);
            next.set(written);
            next.set(piece, written.length);
            written = next;
            dir.files.set(name, { bytes: written, lastModified: 0 });
          },
          close: async () => {},
          abort: async () => {},
        };
      },
    } as unknown as FileSystemFileHandle;
  }
  async removeEntry(name: string) {
    this.files.delete(name);
    this.dirs.delete(name);
  }
  async *entries(): AsyncIterableIterator<[string, FileSystemHandle]> {
    for (const name of [...this.files.keys()])
      yield [name, (await this.getFileHandle(name)) as FileSystemHandle];
    for (const [name, dir] of this.dirs)
      yield [name, Object.assign(dir, { kind: "directory" }) as never];
  }
}

const romOf = async (text: string) => {
  const rom = new TextEncoder().encode(text);
  return { rom, hash: await digest(rom) };
};

test("a verified ROM copy is never rewritten, so a failure cannot erase it", async () => {
  const dir = new FakeDir();
  const { rom, hash } = await romOf("juego válido");
  await ensureRomCopy(dir, hash, rom);
  assert.equal(dir.writes, 1);
  dir.failWrites = true;
  await ensureRomCopy(dir, hash, rom); // remembering it again
  assert.equal(dir.writes, 1, "no second write");
  assert.deepEqual(dir.files.get(hash)!.bytes, rom);
});

test("a damaged copy is replaced; a failed write leaves no broken copy", async () => {
  const dir = new FakeDir();
  const { rom, hash } = await romOf("otro juego");
  dir.files.set(hash, { bytes: new Uint8Array([1, 2, 3]), lastModified: 0 });
  await ensureRomCopy(dir, hash, rom);
  assert.deepEqual(dir.files.get(hash)!.bytes, rom);

  const broken = new FakeDir();
  broken.failWrites = true;
  await assert.rejects(ensureRomCopy(broken, hash, rom), {
    name: "QuotaExceededError",
  });
  assert.equal(broken.files.has(hash), false);
});

test("only old files without an index entry are pruned", async () => {
  const dir = new FakeDir();
  const now = 10 * ORPHAN_AGE_MS;
  const old = now - ORPHAN_AGE_MS - 1;
  dir.files.set("a".repeat(64), {
    bytes: new Uint8Array(1),
    lastModified: old,
  });
  dir.files.set("b".repeat(64), {
    bytes: new Uint8Array(1),
    lastModified: old,
  });
  dir.files.set("c".repeat(64), {
    bytes: new Uint8Array(1),
    lastModified: now,
  });
  dir.files.set("tmp", { bytes: new Uint8Array(1), lastModified: old });
  const removed = await pruneOrphanRoms(new Set(["a".repeat(64)]), now, dir);
  assert.equal(removed, 2);
  assert.deepEqual([...dir.files.keys()].sort(), [
    "a".repeat(64),
    "c".repeat(64),
  ]);
});

const disc = () => [
  { name: "Juego.cue", blob: new Blob(['FILE "Juego (Track 1).bin" BINARY']) },
  { name: "Juego (Track 1).bin", blob: new Blob([new Uint8Array(5000)]) },
];
const DISC = "d".repeat(64);

test("a disc is copied file by file into its own folder, and kept once complete", async () => {
  const dir = new FakeDir();
  await ensureDiscCopy(dir, DISC, disc());
  const folder = dir.dirs.get(DISC)!;
  assert.deepEqual(
    [...folder.files.keys()],
    ["Juego.cue", "Juego (Track 1).bin"],
  );
  assert.equal(folder.files.get("Juego (Track 1).bin")!.bytes.length, 5000);
  assert.equal(folder.writes, 2);
  folder.failWrites = true;
  await ensureDiscCopy(dir, DISC, disc()); // remembering it again
  assert.equal(folder.writes, 2, "a complete copy is not rewritten");
});

test("an incomplete disc copy is rewritten; a failed copy leaves no folder", async () => {
  const dir = new FakeDir();
  await ensureDiscCopy(dir, DISC, disc());
  dir.dirs.get(DISC)!.files.delete("Juego (Track 1).bin");
  await ensureDiscCopy(dir, DISC, disc());
  assert.equal(dir.dirs.get(DISC)!.files.size, 2);

  const broken = new FakeDir();
  broken.failWrites = true;
  await assert.rejects(ensureDiscCopy(broken, DISC, disc()), {
    name: "QuotaExceededError",
  });
  assert.equal(broken.dirs.has(DISC), false);
});

test("disc entries keep their files; malformed lists are ignored", () => {
  const entry = {
    hash: DISC,
    system: "ps1",
    name: "Juego.cue",
    size: 5033,
    addedAt: 1,
    lastPlayedAt: 2,
  };
  const files = discFiles(disc());
  assert.deepEqual(parseEntry({ ...entry, files })?.files, files);
  assert.equal(parseEntry(entry)?.files, undefined);
  for (const bad of [
    [],
    [{ name: "../x.bin", size: 1 }],
    [{ name: "a/b.bin", size: 1 }],
    [{ name: "x.bin", size: -1 }],
    "x.bin",
  ])
    assert.equal(parseEntry({ ...entry, files: bad }), undefined);
});

test("disc folders without an entry are pruned by their newest file", async () => {
  const dir = new FakeDir();
  const now = 10 * ORPHAN_AGE_MS;
  for (const [name, at] of [
    ["e".repeat(64), now - ORPHAN_AGE_MS - 1],
    ["f".repeat(64), now],
  ] as const) {
    const folder = await dir.getDirectoryHandle(name, { create: true });
    folder.files.set("Juego.iso", {
      bytes: new Uint8Array(1),
      lastModified: at,
    });
  }
  assert.equal(await pruneOrphanRoms(new Set(), now, dir), 1);
  assert.deepEqual([...dir.dirs.keys()], ["f".repeat(64)]);
});

test("a disc that does not fit is refused before copying, with its size", async () => {
  const mb = 1024 * 1024;
  const estimate = (free: number) => async () => ({
    quota: free + mb,
    usage: mb,
  });
  assert.equal(await spaceProblem(600 * mb, estimate(700 * mb)), undefined);
  assert.match(
    (await spaceProblem(600 * mb, estimate(300 * mb)))!,
    /ocupa 600 MB.*solo deja 300 MB/,
  );
  // Without an estimate the copy is attempted (and may still fail cleanly).
  assert.equal(await spaceProblem(600 * mb, async () => ({})), undefined);
});

test("a personal entry keeps only a true «hidden» flag", () => {
  const entry = {
    hash: "a".repeat(64),
    system: "nes",
    name: "Juego.nes",
    size: 1,
    addedAt: 1,
    lastPlayedAt: 1,
  };
  assert.equal(parseEntry({ ...entry, hidden: true })?.hidden, true);
  assert.equal(parseEntry({ ...entry, hidden: "yes" })?.hidden, undefined);
});

test("a game open in any profile's tab blocks deleting its copy", async () => {
  const { gameOpen } = await import("../packages/storage/src/library.ts");
  const hash = "a".repeat(64);
  assert.equal(gameOpen(hash, []), false);
  assert.equal(gameOpen(hash, [`cartivo:game:${hash}`]), true);
  assert.equal(gameOpen(hash, [`cartivo:game:${hash}@ana`]), true);
  assert.equal(gameOpen(hash, [`cartivo:game:${"b".repeat(64)}`]), false);
  assert.equal(gameOpen(hash, ["cartivo:catalogue"]), false);
});
