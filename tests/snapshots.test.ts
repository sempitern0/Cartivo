// «Partidas»: full-console snapshots on both NES cores (ADR-009).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { initSync } from "../cores/tetanes/dist/tetanes.js";
import { TetanesAdapter } from "../packages/adapters/src/tetanes.ts";
import { NesAdapter } from "../packages/adapters/src/jsnes.ts";
import { controlDemo } from "../packages/fixtures/src/control-demo.ts";
import { neutral, type InputState } from "../packages/input/src/nes-input.ts";
import {
  makePreview,
  isStateSlot,
  PREVIEW_WIDTH,
  PREVIEW_HEIGHT,
} from "../packages/storage/src/states.ts";
import { parseRequest as parseNesRequest } from "../packages/runtime/src/protocol.ts";

initSync({
  module: readFileSync(
    new URL("../cores/tetanes/dist/tetanes_bg.wasm", import.meta.url),
  ),
});
const hash = (b: Uint8ClampedArray) =>
  createHash("sha256").update(b).digest("hex");

// UxROM without battery, like Contra: no SRAM, so only snapshots can save.
function uxrom() {
  const demo = controlDemo();
  const rom = new Uint8Array(16 + 65536 + 8192);
  rom.set(demo.subarray(0, 16));
  rom[4] = 4;
  rom[6] = 0x20; // mapper 2, no battery
  for (let bank = 0; bank < 4; bank++)
    rom.set(demo.subarray(16, 16 + 16384), 16 + bank * 16384);
  rom.set(demo.subarray(16 + 16384), 16 + 65536);
  return rom;
}

type Core = {
  input(s: InputState): void;
  advance(n: number): { pixels: Uint8ClampedArray };
  snapshot(): Uint8Array;
  restore(b: Uint8Array): void;
};

function determinism(core: Core) {
  for (let i = 0; i < 20; i++) core.advance(3);
  const right = { ...neutral(), right: true };
  core.input(right);
  core.advance(3);
  const state = core.snapshot();
  const reference = hash(core.advance(3).pixels);
  core.input({ ...neutral(), left: true, down: true });
  for (let i = 0; i < 15; i++) core.advance(3);
  assert.notEqual(hash(core.advance(3).pixels), reference);
  core.restore(state);
  core.input(right);
  assert.equal(hash(core.advance(3).pixels), reference, "same frame again");
  return state;
}

test("TetaNES snapshot restores the exact moment, even without battery", () => {
  const core = new TetanesAdapter(uxrom());
  assert.equal(core.battery, false);
  const state = determinism(core);
  assert.ok(state.length > 0 && state.length < 8 * 1024 * 1024);
  console.log(`TetaNES state: ${state.length} bytes`);
  assert.throws(() => core.restore(new Uint8Array([1, 2, 3])), /dañada/);
  // A state from another cartridge is rejected by TetaNES.
  const other = new TetanesAdapter(controlDemo());
  other.advance(3);
  assert.throws(() => other.restore(state));
  core.dispose();
  other.dispose();
});

test("JSNES snapshot restores the exact moment", () => {
  const core = new NesAdapter(uxrom());
  const state = determinism(core);
  console.log(`JSNES state: ${state.length} bytes`);
  assert.throws(() => core.restore(new Uint8Array([123])), /dañada/);
});

test("previews, slots and protocol validation", () => {
  const frame = new Uint8ClampedArray(256 * 240 * 4);
  frame.set([10, 20, 30, 255], (2 * 256 + 4) * 4);
  const preview = makePreview(frame, 256, 240);
  assert.equal(preview.length, PREVIEW_WIDTH * PREVIEW_HEIGHT * 4);
  assert.deepEqual(
    [...preview.subarray((128 + 2) * 4, (128 + 2) * 4 + 4)],
    [10, 20, 30, 255],
  );
  for (const slot of ["auto", "1", "2", "3"]) assert.ok(isStateSlot(slot));
  assert.equal(isStateSlot("4"), false);
  const base = { v: 1, session: "s", id: 1 };
  assert.ok(parseNesRequest({ ...base, command: "state-list" }));
  assert.ok(parseNesRequest({ ...base, command: "state-save", slot: "2" }));
  assert.throws(() => parseNesRequest({ ...base, command: "state-load" }));
  assert.throws(() =>
    parseNesRequest({ ...base, command: "state-delete", slot: "x" }),
  );
});

test("protocol v1 input without L/R is still accepted (released)", () => {
  const base = { v: 1, session: "s", id: 1, command: "advance", count: 1 };
  const eight = {
    up: false,
    down: false,
    left: false,
    right: true,
    a: false,
    b: false,
    select: false,
    start: false,
  };
  const request = parseNesRequest({ ...base, input: { ...eight } });
  assert.equal(request.input?.l, false);
  assert.equal(request.input?.r, false);
  assert.equal(request.input?.right, true);
  assert.throws(() => parseNesRequest({ ...base, input: { ...eight, l: 1 } }));
  const { right: _right, ...seven } = eight;
  assert.throws(() => parseNesRequest({ ...base, input: seven }));
});
