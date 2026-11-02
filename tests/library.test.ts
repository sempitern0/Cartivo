import { test } from "node:test";
import assert from "node:assert/strict";
import {
  byRecent,
  isSha256,
  parseEntry,
  readRemember,
  writeRemember,
  REMEMBER_KEY,
} from "../packages/storage/src/library.ts";
import { parseRequest } from "../packages/runtime/src/protocol.ts";

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

test("the remember choice is asked once and kept", () => {
  const data = new Map<string, string>();
  const storage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
  assert.equal(readRemember(storage), undefined);
  assert.equal(writeRemember(true, storage), true);
  assert.equal(data.get(REMEMBER_KEY), "yes");
  assert.equal(readRemember(storage), true);
  writeRemember(false, storage);
  assert.equal(readRemember(storage), false);
  const blocked = {
    getItem: () => {
      throw Error("blocked");
    },
    setItem: () => {
      throw Error("blocked");
    },
  };
  assert.equal(readRemember(blocked), undefined);
  assert.equal(writeRemember(true, blocked), false);
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
  assert.equal(
    parseRequest({ ...base, command: "library-add" }).command,
    "library-add",
  );
});
