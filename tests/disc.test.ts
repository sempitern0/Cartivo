// Discs on demand: the core opens a track by the name its .cue uses and
// reads only what it asks for; nothing else of the disc reaches wasm memory.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DiscImage,
  vfsImports,
  type ReadSync,
} from "../packages/adapters/src/disc.ts";

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
