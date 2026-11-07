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
import { cueFiles, matchTracks } from "../packages/storage/src/cue.ts";
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
