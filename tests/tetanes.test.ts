// TetaNES (WebAssembly) behind the same adapter surface as JSNES. Uses the
// committed, CI-built wasm from cores/tetanes/dist (ADR-008).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { initSync } from "../cores/tetanes/dist/tetanes.js";
import {
  TetanesAdapter,
  inputBits,
  SRAM_BYTES,
} from "../packages/adapters/src/tetanes.ts";
import { NesAdapter } from "../packages/adapters/src/jsnes.ts";
import { controlDemo } from "../packages/fixtures/src/control-demo.ts";
import { neutral } from "../packages/input/src/nes-input.ts";
import { parseNesRequest } from "../packages/runtime/src/nes-protocol.ts";
import {
  readNesCore,
  writeNesCore,
  defaultNesCore,
} from "../packages/runtime/src/core-preference.ts";

const wasm = new URL("../cores/tetanes/dist/tetanes_bg.wasm", import.meta.url);
initSync({ module: readFileSync(wasm) });

const hash = (b: Uint8Array | Uint8ClampedArray) =>
  createHash("sha256").update(b).digest("hex");

test("committed wasm matches its manifest", () => {
  const manifest = JSON.parse(
    readFileSync(
      new URL("../cores/tetanes/manifest.json", import.meta.url),
      "utf8",
    ),
  );
  const entry = manifest.files.find(
    (f: { path: string }) => f.path === "dist/tetanes_bg.wasm",
  );
  assert.equal(hash(readFileSync(wasm)), entry.sha256);
  assert.equal(manifest.upstream.version, "0.17.0");
  assert.equal(manifest.biosRequired, false);
});

test("TetaNES renders the fixture, reacts to input, plays audio and keeps SRAM", () => {
  const rom = controlDemo();
  const core = new TetanesAdapter(rom);
  let frame = core.advance(3);
  for (let i = 0; i < 19; i++) frame = core.advance(3);
  assert.equal(frame.pixels.length, 256 * 240 * 4);
  // Backdrop plus the white sprite: TetaNES draws no extra border colour.
  assert.ok(new Set(new Uint32Array(frame.pixels.buffer)).size >= 2);
  const before = hash(frame.pixels);
  core.input({ ...neutral(), a: true, b: true, right: true });
  let peak = 0;
  for (let i = 0; i < 10; i++) {
    frame = core.advance(2);
    assert.ok(frame.audio.length <= 48000);
    for (const value of frame.audio) {
      assert.ok(Number.isFinite(value));
      peak = Math.max(peak, Math.abs(value));
    }
  }
  assert.notEqual(hash(frame.pixels), before, "input changes the picture");
  assert.ok(peak > 0.001, "B produces a tone");
  assert.equal(core.save().length, SRAM_BYTES);
  assert.equal(core.save()[0], 1, "A writes battery RAM");
  core.input(neutral());
  core.advance(2);
  core.input({ ...neutral(), a: true });
  core.advance(2);
  assert.equal(core.save()[0], 2);
  const restored = new TetanesAdapter(rom, core.save());
  for (let i = 0; i < 20; i++) restored.advance(3);
  assert.equal(restored.save()[0], 2, "SRAM survives a new instance");
  core.dispose();
  restored.dispose();
});

test("a save written by JSNES loads in TetaNES and back", () => {
  const rom = controlDemo();
  const js = new NesAdapter(rom);
  for (let i = 0; i < 20; i++) js.advance(3);
  js.input({ ...neutral(), a: true });
  js.advance(3);
  const tetanes = new TetanesAdapter(rom, js.save());
  for (let i = 0; i < 20; i++) tetanes.advance(3);
  assert.equal(tetanes.save()[0], js.save()[0]);
  tetanes.input({ ...neutral(), a: true });
  tetanes.advance(3);
  const back = new NesAdapter(rom, tetanes.save());
  for (let i = 0; i < 20; i++) back.advance(3);
  assert.equal(back.save()[0], tetanes.save()[0]);
  tetanes.dispose();
});

test("mappers 1–4 run on TetaNES with the same validation gate", () => {
  const demo = controlDemo();
  for (const mapper of [1, 2, 3, 4]) {
    const prg = mapper === 3 ? 32768 : 65536;
    const chr = mapper === 3 ? 32768 : 8192;
    const rom = new Uint8Array(16 + prg + chr);
    rom.set(demo.subarray(0, 16));
    rom[4] = prg / 16384;
    rom[5] = chr / 8192;
    rom[6] = (mapper << 4) | 2;
    for (let bank = 0; bank < prg / 16384; bank++)
      rom.set(demo.subarray(16, 16 + 16384), 16 + bank * 16384);
    for (let c = 0; c < chr / 8192; c++)
      rom.set(demo.subarray(16 + 16384), 16 + prg + c * 8192);
    const core = new TetanesAdapter(rom);
    let frame = core.advance(3);
    for (let n = 0; n < 19; n++) frame = core.advance(3);
    assert.ok(
      new Set(new Uint32Array(frame.pixels.buffer)).size >= 2,
      `mapper ${mapper} renders`,
    );
    core.input({ ...neutral(), a: true });
    core.advance(3);
    // UxROM (2) and CNROM (3) boards have no PRG-RAM; TetaNES follows the
    // hardware (JSNES maps $6000 anyway). MMC1 and MMC3 keep battery RAM.
    assert.equal(
      core.save()[0],
      mapper === 1 || mapper === 4 ? 1 : 0,
      `mapper ${mapper} SRAM`,
    );
    core.dispose();
  }
  const bad = controlDemo();
  bad[6] = 0x52;
  assert.throws(() => new TetanesAdapter(bad), /Mapper 5/);
  assert.throws(() => new TetanesAdapter(controlDemo(), new Uint8Array(4)));
});

test("input bits, protocol core field and stored preference", () => {
  assert.equal(inputBits(neutral()), 0);
  assert.equal(inputBits({ ...neutral(), up: true, start: true }), 0b1000_0001);
  const load = { v: 1, session: "s", id: 1, command: "load", demo: true };
  assert.ok(parseNesRequest({ ...load, core: "tetanes" }));
  assert.ok(parseNesRequest({ ...load, core: "jsnes" }));
  assert.ok(parseNesRequest(load));
  assert.throws(() => parseNesRequest({ ...load, core: "fceux" }));
  const memory = new Map<string, string>();
  const store = {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => void memory.set(k, v),
  };
  assert.equal(readNesCore(store), defaultNesCore);
  assert.equal(defaultNesCore, "tetanes");
  writeNesCore("jsnes", store);
  assert.equal(readNesCore(store), "jsnes");
  memory.set("cartivo:core:nes:v1", "unknown");
  assert.equal(readNesCore(store), "tetanes");
});

test("frame cost of both cores (informative, not a benchmark)", () => {
  const rom = controlDemo();
  const measure = (core: { advance(n: number): unknown }) => {
    for (let i = 0; i < 30; i++) core.advance(2);
    const start = performance.now();
    for (let i = 0; i < 150; i++) core.advance(2);
    return (performance.now() - start) / 300;
  };
  const tetanes = new TetanesAdapter(rom);
  const t = measure(tetanes);
  const j = measure(new NesAdapter(rom));
  tetanes.dispose();
  console.log(
    `ms/frame (Node, CI runner): TetaNES ${t.toFixed(3)} · JSNES ${j.toFixed(3)}`,
  );
  assert.ok(t > 0 && j > 0);
});
