// Discs on demand: the core opens a track by the name its .cue uses and
// reads only what it asks for; nothing else of the disc reaches wasm memory.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DiscImage,
  vfsImports,
  type ReadSync,
} from "../packages/adapters/src/disc.ts";
import { prepareDisc } from "../packages/runtime/src/prepare-rom.ts";
import {
  cueFiles,
  m3uFiles,
  matchTracks,
  MAX_SHEET_BYTES,
  resolveDisc,
  sheetText,
} from "../packages/storage/src/cue.ts";
import { parseRequest } from "../packages/runtime/src/protocol.ts";

const bin = Uint8Array.from({ length: 10_000 }, (_, i) => i & 0xff);
const parts = [
  { name: "Game.cue", blob: new Blob(['FILE "Game (Track 1).bin" BINARY']) },
  { name: "Game (Track 1).bin", blob: new Blob([bin]) },
];
// Node has no FileReaderSync: read from a copy, and count what was read.
const source = new Map<Blob, Uint8Array>([
  [parts[0].blob, new TextEncoder().encode('FILE "Game (Track 1).bin" BINARY')],
  [parts[1].blob, bin],
]);
let readBytes = 0;
const read: ReadSync = (blob, start, end) => {
  readBytes += end - start;
  return source.get(blob)!.slice(start, end);
};

test("tracks are found by the name the .cue uses", () => {
  const disc = new DiscImage(parts, parts[0], read);
  assert.equal(disc.find("GAME (TRACK 1).BIN"), parts[1]);
  assert.equal(disc.find("C:\\juegos\\Game (Track 1).bin"), parts[1]);
  assert.equal(disc.find("other.bin"), undefined);
  assert.throws(
    () => new DiscImage(parts, { name: "x", blob: new Blob() }, read),
  );
});

test("the VFS reads sectors into wasm memory, nothing more", () => {
  const memory = new WebAssembly.Memory({ initial: 1 });
  const vfs = vfsImports(
    new DiscImage(parts, parts[0], read),
    () => memory.buffer,
  );
  const name = new TextEncoder().encode("Game (Track 1).bin");
  new Uint8Array(memory.buffer).set(name, 100);
  const handle = vfs.cartivo_vfs_open(100, name.length);
  assert.ok(handle >= 1);
  assert.equal(vfs.cartivo_vfs_size(handle), bin.length);
  readBytes = 0;
  assert.equal(vfs.cartivo_vfs_read(handle, 2352, 1000, 2352), 2352);
  assert.deepEqual(
    new Uint8Array(memory.buffer, 1000, 2352),
    bin.slice(2352, 4704),
  );
  assert.equal(readBytes, 2352, "only the requested sector");
  // Past the end: a short read, then nothing.
  assert.equal(vfs.cartivo_vfs_read(handle, 9_000, 1000, 2352), 1000);
  assert.equal(vfs.cartivo_vfs_read(handle, 20_000, 1000, 10), 0);
  assert.equal(vfs.cartivo_vfs_close(handle), 0);
  assert.equal(vfs.cartivo_vfs_read(handle, 0, 1000, 1), -1);
  assert.equal(vfs.cartivo_vfs_close(handle), -1);
  new Uint8Array(memory.buffer).set(new TextEncoder().encode("nope.bin"), 100);
  assert.equal(vfs.cartivo_vfs_open(100, 8), 0);
});

test("a .cue sheet names its files, quoted or not", () => {
  const cue = [
    'FILE "Game (Track 1).bin" BINARY',
    "  TRACK 01 MODE2/2352",
    "file track2.bin binary",
    "  TRACK 02 AUDIO",
  ].join("\r\n");
  assert.deepEqual(cueFiles(cue), ["Game (Track 1).bin", "track2.bin"]);
});

test("tracks are matched by name; one renamed track is still found", () => {
  const names = ["Game (Track 1).bin", "Game (Track 2).bin"];
  const t1 = { name: "game (track 1).BIN" };
  const t2 = { name: "pista2.bin" };
  const notes = { name: "LEEME.txt" };
  assert.deepEqual(matchTracks(names, [t1, notes]).missing, [
    "Game (Track 2).bin",
  ]);
  const { tracks, missing } = matchTracks(names, [notes, t2, t1]);
  assert.deepEqual(missing, []);
  assert.equal(tracks.get("Game (Track 2).bin"), t2);
  // Two unclaimed tracks for two missing names: nothing is guessed.
  assert.deepEqual(
    matchTracks(names, [{ name: "a.bin" }, { name: "b.bin" }]).missing,
    names,
  );
});

test("an .m3u lists discs: comments and blank lines are skipped", () => {
  const m3u =
    "\uFEFF#EXTM3U\r\nGame (Disc 1).cue\r\n\r\n  Game (Disc 2).chd  \n";
  assert.deepEqual(m3uFiles(m3u), ["Game (Disc 1).cue", "Game (Disc 2).chd"]);
});

test("a sheet too large to be one, or that names no disc, is refused", async () => {
  // A disc image with the wrong extension is never read whole as text.
  const huge = { size: MAX_SHEET_BYTES + 1, text: async () => "never" };
  await assert.rejects(
    sheetText("Juego.cue", huge as unknown as Blob),
    /demasiado grande/,
  );
  assert.equal(await sheetText("a.m3u", new Blob(["a.chd\n"])), "a.chd\n");
  const empty = new File(["#EXTM3U\n"], "Vacío.m3u");
  await assert.rejects(
    prepareDisc({ prepare: async () => {} }, empty, [], read),
    /no nombra ningún disco/,
  );
});

test("a game's files: .m3u → discs → tracks, with what is missing", async () => {
  const files: Record<string, string> = {
    "Game.m3u": "Game (Disc 1).cue\nGame (Disc 2).cue\nGame (Disc 3).chd\n",
    "Game (Disc 1).cue": 'FILE "Game (Disc 1).bin" BINARY\n',
    "Game (Disc 2).cue": 'FILE "Game (Disc 2).bin" BINARY\n',
  };
  const file = (name: string) => ({ name });
  const text = async (f: { name: string }) => files[f.name] ?? "";
  const opened = [
    "Game (Disc 1).cue",
    "game (disc 1).bin",
    "Game (Disc 2).cue",
    "LEEME.txt",
  ].map(file);
  const partial = await resolveDisc(file("Game.m3u"), opened, text);
  assert.deepEqual(partial.missing, ["Game (Disc 2).bin", "Game (Disc 3).chd"]);
  const all = [...opened, file("Game (Disc 2).bin"), file("Game (Disc 3).chd")];
  const layout = await resolveDisc(file("Game.m3u"), all, text);
  assert.deepEqual(layout.missing, []);
  assert.deepEqual(layout.boots, [
    "Game (Disc 1).cue",
    "Game (Disc 2).cue",
    "Game (Disc 3).chd",
  ]);
  assert.deepEqual(
    layout.parts.map((p) => p.name),
    [
      "Game.m3u",
      "Game (Disc 1).cue",
      "game (disc 1).bin",
      "Game (Disc 2).cue",
      "Game (Disc 2).bin",
      "Game (Disc 3).chd",
    ],
  );
  // One disc by itself, or a .cue: one boot file.
  assert.deepEqual((await resolveDisc(file("x.chd"), [], text)).boots, [
    "x.chd",
  ]);
});

test("a disc is identified and prepared without reading it whole", async () => {
  let prepared = 0;
  const module = {
    prepare: async () => void prepared++,
    demo: () => ({ name: "demo.exe", bytes: new Uint8Array(2048) }),
  };
  const cue = new File(['FILE "Game (Track 1).bin" BINARY'], "Game.cue");
  const track = new File([bin], "Game (Track 1).bin");
  readBytes = 0;
  const { disc, hash } = await prepareDisc(module, cue, [track], read);
  assert.equal(disc.primary.name, "Game.cue");
  assert.equal(disc.parts.length, 2);
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.equal(readBytes, 0, "the core reads sectors later, on demand");
  // The identity keys the memory card: an unrelated file opened alongside
  // does not change it, a different track does.
  const notes = new File(["x"], "LEEME.txt");
  assert.equal(
    (await prepareDisc(module, cue, [notes, track], read)).hash,
    hash,
  );
  const other = new File([bin.subarray(1)], "Game (Track 1).bin");
  assert.notEqual((await prepareDisc(module, cue, [other], read)).hash, hash);
  // Missing tracks are named before the core starts; a renamed one and a
  // sheet saved with a UTF-8 BOM still boot, under the names the core uses.
  await assert.rejects(
    prepareDisc(module, cue, [notes], read),
    /Track 1\)\.bin/,
  );
  const bom = new File(['\uFEFFFILE "Game (Track 1).bin" BINARY'], "Game.cue");
  const renamed = new File([bin], "game.bin");
  const fixed = await prepareDisc(module, bom, [renamed], read);
  assert.equal(fixed.disc.primary.blob.size, bom.size - 3);
  assert.equal(fixed.disc.find("Game (Track 1).bin")?.blob, renamed);
  assert.equal(fixed.hash, hash, "same disc, same memory card");
  // The demo is a one-file disc.
  assert.equal(
    (await prepareDisc(module, undefined, [], read)).disc.primary.name,
    "demo.exe",
  );
  assert.equal(prepared, 5);
});

test("only a load from a file carries a disc's other files", () => {
  const base = { v: 1, session: "s", id: 1, command: "load" } as const;
  const cue = new File(["FILE"], "Game.cue");
  const track = new File([bin], "Game (Track 1).bin");
  const r = parseRequest({ ...base, system: "ps1", file: cue, extra: [track] });
  assert.deepEqual(r.extra, [track]);
  assert.throws(() => parseRequest({ ...base, demo: true, extra: [track] }));
  assert.throws(() => parseRequest({ ...base, file: cue, extra: ["x.bin"] }));
  assert.throws(() =>
    parseRequest({ ...base, file: cue, extra: Array(101).fill(track) }),
  );
});

test("a disc change names a disc by its index", () => {
  const swap = { v: 1, session: "s", id: 2, command: "disc" } as const;
  assert.equal(parseRequest({ ...swap, disc: 1 }).disc, 1);
  for (const disc of [undefined, -1, 1.5, "1"])
    assert.throws(() => parseRequest({ ...swap, disc }), /Disco inválido/);
});

test("an .m3u game boots its first disc and can boot another after a reset", async () => {
  const module = { prepare: async () => {}, demo: undefined };
  const f = (name: string, text: string) => new File([text], name);
  const { disc, parts } = await prepareDisc(
    module,
    f("Game.m3u", "Game (Disc 1).cue\nGame (Disc 2).cue\n"),
    [
      f("Game (Disc 2).bin", "2"),
      f("Game (Disc 1).cue", 'FILE "Game (Disc 1).bin" BINARY\n'),
      f("Game (Disc 1).bin", "1"),
      f("Game (Disc 2).cue", 'FILE "Game (Disc 2).bin" BINARY\n'),
    ],
    (blob, start, end) => new Uint8Array(end - start),
  );
  assert.deepEqual(disc.discs, ["Game (Disc 1).cue", "Game (Disc 2).cue"]);
  assert.equal(disc.primary.name, "Game (Disc 1).cue");
  assert.equal(parts[0].name, "Game.m3u");
  const second = disc.withFirst(1);
  assert.equal(second.primary.name, "Game (Disc 2).cue");
  assert.deepEqual(second.discs, disc.discs);
  assert.equal(second.first, 1);
  assert.throws(() => disc.withFirst(2), /disco 3/);
});
