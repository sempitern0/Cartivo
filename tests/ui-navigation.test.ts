// Menus with a gamepad: intents per frame and spatial focus moves.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  nearest,
  PadIntents,
  type Box,
} from "../packages/input/src/ui-navigation.ts";
import type { Pad } from "../packages/input/src/nes-input.ts";

const pad = (down: number[] = [], axes = [0, 0]): Pad => ({
  index: 0,
  id: "test",
  connected: true,
  mapping: "standard",
  buttons: Array.from({ length: 17 }, (_, i) => ({
    pressed: down.includes(i),
    value: down.includes(i) ? 1 : 0,
  })),
  axes,
});

test("A and B fire once per press, never while held", () => {
  const intents = new PadIntents();
  assert.deepEqual(intents.read(pad([0]), 0), ["accept"]);
  assert.deepEqual(intents.read(pad([0]), 500), []);
  assert.deepEqual(intents.read(pad(), 600), []);
  assert.deepEqual(intents.read(pad([1]), 700), ["back"]);
  assert.deepEqual(intents.read(pad([0, 1]), 800), ["accept"]);
  // Select+Start is the game's pause gesture, not a menu intent.
  assert.deepEqual(intents.read(pad([8, 9]), 900), []);
});

test("a held direction repeats after a delay; the stick counts too", () => {
  const intents = new PadIntents();
  assert.deepEqual(intents.read(pad([15]), 0), ["right"]);
  assert.deepEqual(intents.read(pad([15]), 300), []);
  assert.deepEqual(intents.read(pad([15]), 400), ["right"]);
  assert.deepEqual(intents.read(pad([15]), 450), []);
  assert.deepEqual(intents.read(pad([15]), 520), ["right"]);
  assert.deepEqual(intents.read(pad([], [0, 0.9]), 600), ["down"]);
  assert.deepEqual(intents.read(pad([], [0.3, 0]), 700), [], "inside deadzone");
});

test("absorb ignores what is still held when navigation resumes", () => {
  const intents = new PadIntents();
  intents.absorb(pad([1]), 0);
  assert.deepEqual(intents.read(pad([1]), 16), []);
  assert.deepEqual(intents.read(pad(), 32), []);
  assert.deepEqual(intents.read(pad([1]), 48), ["back"]);
  assert.deepEqual(intents.read(undefined, 64), []);
});

test("nearest follows rows and columns, without wrapping", () => {
  // A 3×2 grid of cards, 100×50 with 20 px gaps.
  const grid: Box[] = [0, 1, 2, 3, 4, 5].map((i) => ({
    x: (i % 3) * 120,
    y: Math.floor(i / 3) * 70,
    width: 100,
    height: 50,
  }));
  assert.equal(nearest(grid[0], grid, "right"), 1);
  assert.equal(nearest(grid[0], grid, "down"), 3);
  assert.equal(nearest(grid[4], grid, "up"), 1);
  assert.equal(nearest(grid[4], grid, "left"), 3);
  assert.equal(nearest(grid[2], grid, "right"), -1, "no wrap");
  assert.equal(nearest(grid[0], grid, "up"), -1);
  // A wide button below the grid is reached from any column.
  const wide = [...grid, { x: 0, y: 160, width: 340, height: 40 }];
  assert.equal(nearest(grid[5], wide, "down"), 6);
});
