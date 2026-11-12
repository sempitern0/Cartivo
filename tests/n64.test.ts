// Nintendo 64 in the app (ADR-017): what runs without a browser. The core
// itself needs WebGL2 and is covered by tests/e2e/n64.spec.ts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Downmix } from "../packages/adapters/src/n64.ts";
import {
  MAX_N64_ROM_BYTES,
  validateN64Rom,
} from "../packages/adapters/src/n64-header.ts";
import { n64ControlDemo } from "../packages/fixtures/src/n64-control-demo.ts";
import { parseRequest } from "../packages/runtime/src/protocol.ts";
import { system } from "../packages/runtime/src/systems.ts";
import { findCoreModule } from "../packages/adapters/src/registry.ts";

test("N64 cartridges: the demo is accepted, other files are refused", () => {
  assert.deepEqual(validateN64Rom(n64ControlDemo()), { battery: true });
  assert.throws(() => validateN64Rom(new Uint8Array(4096)), /cabecera/);
  const tooBig = { length: MAX_N64_ROM_BYTES + 4 } as Uint8Array;
  assert.throws(() => validateN64Rom(tooBig), /64 MiB/);
});

test("N64 is a surface system in the UI and in the Worker", () => {
  const n64 = system("n64")!;
  assert.equal(n64.surface, "webgl2");
  const module = findCoreModule("n64", n64.defaultCore)!;
  assert.equal(module.surface, "webgl2");
  assert.equal(module.version, n64.cores[0].version);
  // Every other system keeps returning RGBA frames.
  for (const other of ["nes", "gba", "snes", "md", "ps1"])
    assert.equal(system(other)!.surface, undefined, other);
});

test("loading a surface system needs the transferred game canvas", () => {
  const base = { v: 1, session: "s", id: 1, command: "load", demo: true };
  // Node has no OffscreenCanvas: no value can stand for one.
  assert.throws(
    () => parseRequest({ ...base, system: "n64" }),
    /lienzo del juego/,
  );
  assert.throws(
    () => parseRequest({ ...base, system: "n64", canvas: {} }),
    /lienzo del juego/,
  );
  assert.throws(
    () => parseRequest({ ...base, system: "gba", canvas: {} }),
    /Lienzo inesperado/,
  );
  assert.throws(
    () => parseRequest({ ...base, command: "save", canvas: {}, system: "gba" }),
    /Lienzo inesperado/,
  );
  // A rendering resolution only goes with a canvas, at load.
  assert.throws(
    () => parseRequest({ ...base, system: "gba", scale: 2 }),
    /Resolución inválida/,
  );
  assert.throws(
    () => parseRequest({ ...base, command: "save", scale: 2 }),
    /Lienzo inesperado/,
  );
  assert.equal(parseRequest({ ...base, system: "gba" }).system, "gba");
});

/** Stereo frames of a constant level on both channels. */
const level = (frames: number, left: number, right = left) =>
  Int16Array.from({ length: frames * 2 }, (_, i) => (i % 2 ? right : left));

test("N64 audio: 44.1 kHz stereo becomes 48 kHz mono", () => {
  const downmix = new Downmix(44100);
  const out: number[] = [];
  // One second in frame-sized batches (735 stereo frames at 60 Hz).
  for (let i = 0; i < 60; i++) downmix.push(level(735, 16384, -16384), out);
  assert.ok(Math.abs(out.length - 48000) <= 2, `${out.length} samples`);
  // Opposite channels cancel in the mono mix.
  for (const v of out) assert.equal(v, 0);
});

test("N64 audio keeps its phase and level across batches", () => {
  const whole: number[] = [];
  new Downmix(44100).push(level(2000, 8192), whole);
  const split: number[] = [];
  const downmix = new Downmix(44100);
  for (const frames of [1, 700, 299, 1000])
    downmix.push(level(frames, 8192), split);
  assert.deepEqual(split, whole);
  // Past the ramp up from silence (the first two samples) the level holds.
  for (const v of split.slice(2)) assert.equal(v, 0.25);
  // An empty batch changes nothing.
  const before = split.length;
  downmix.push(new Int16Array(0), split);
  assert.equal(split.length, before);
  assert.throws(() => new Downmix(0), RangeError);
});
