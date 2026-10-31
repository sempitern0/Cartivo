import { test } from "node:test";
import assert from "node:assert/strict";
import {
  sample,
  standard,
  parseProfile,
  pressedBindings,
  sameDevice,
} from "../packages/input/src/nes-input.ts";
import type { Pad } from "../packages/input/src/nes-input.ts";
const pad = (): Pad => ({
  index: 0,
  id: "test",
  connected: true,
  mapping: "standard",
  buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })),
  axes: [0, 0],
});
test("standard input merges keyboard, deadzone and neutralizes opposite directions", () => {
  const p = pad();
  p.buttons[0].pressed = true;
  p.axes = [0.24, -0.8];
  const state = sample(p, standard, new Set(["KeyK", "ArrowDown"]));
  assert.equal(state.a, true);
  assert.equal(state.b, true);
  assert.equal(state.up, false);
  assert.equal(state.down, false);
  assert.equal(state.right, false);
  p.axes = [0.8, 0];
  assert.equal(sample(p, standard, new Set()).right, true);
  assert.equal(sample(p, standard, new Set(["ArrowLeft"])).right, false);
  assert.equal(sample(undefined, undefined, new Set(["KeyL"])).a, true);
  p.connected = false;
  assert.equal(sample(p, standard, new Set()).a, false);
});
test("nonstandard pad needs explicit mapping and axes", () => {
  const p = pad();
  p.mapping = "";
  p.buttons[0].pressed = true;
  p.axes = [1, 1];
  assert.equal(sample(p, undefined, new Set()).a, false);
  assert.equal(sample(p, standard, new Set()).right, false);
  const mapped = {
    ...standard,
    right: { kind: "axis" as const, index: 0, direction: 1 as const },
  };
  assert.equal(sample(p, mapped, new Set()).right, true);
});
test("profile validation rejects malformed, out-of-range and duplicate bindings", () => {
  const p = pad();
  assert.deepEqual(parseProfile(standard, p), standard);
  for (const value of [
    null,
    {},
    { ...standard, a: { kind: "button", index: 99 } },
    { ...standard, a: standard.b },
    { ...standard, a: { kind: "axis", index: 0, direction: 0 } },
    { ...standard, a: { kind: "axis", index: NaN, direction: 1 } },
  ])
    assert.equal(parseProfile(value, p), undefined);
});
test("capture rejects jitter and invalid axes; simultaneous input stays explicit", () => {
  const p = pad();
  p.axes = [0.2, NaN];
  assert.deepEqual(pressedBindings(p), []);
  p.buttons[2].pressed = true;
  p.axes = [-0.9, 0];
  assert.deepEqual(pressedBindings(p), [
    { kind: "button", index: 2 },
    { kind: "axis", index: 0, direction: -1 },
  ]);
});
test("slot reuse does not establish controller identity", () => {
  const p = pad();
  assert.equal(sameDevice(p, pad()), true);
  for (const replacement of [
    undefined,
    { ...pad(), id: "other" },
    { ...pad(), mapping: "" },
    { ...pad(), connected: false },
  ])
    assert.equal(sameDevice(p, replacement), false);
});

test("custom keyboard profiles validate complete unique safe bindings", async () => {
  const { defaultKeyboard, parseKeyboard } = await import(
    "../packages/input/src/nes-input.ts"
  );
  const custom = { ...defaultKeyboard, a: "KeyC" };
  assert.deepEqual(parseKeyboard(custom), custom);
  assert.equal(parseKeyboard({ ...custom, b: "KeyC" }), undefined);
  assert.equal(parseKeyboard({ ...custom, a: "Tab" }), undefined);
  assert.equal(parseKeyboard({}), undefined);
  assert.equal(
    sample(undefined, undefined, new Set(["KeyC"]), 0.25, custom).a,
    true,
  );
  assert.equal(
    sample(undefined, undefined, new Set(["KeyL"]), 0.25, custom).a,
    false,
  );
});

test("WASD aliases coexist with arrows and respect remapping collisions", async () => {
  const { defaultKeyboard } = await import(
    "../packages/input/src/nes-input.ts"
  );
  assert.equal(sample(undefined, undefined, new Set(["KeyW"])).up, true);
  assert.equal(sample(undefined, undefined, new Set(["KeyA"])).left, true);
  assert.equal(sample(undefined, undefined, new Set(["KeyS"])).down, true);
  assert.equal(sample(undefined, undefined, new Set(["KeyD"])).right, true);
  assert.equal(sample(undefined, undefined, new Set(["ArrowDown"])).down, true);
  const custom = { ...defaultKeyboard, a: "KeyW" };
  const state = sample(undefined, undefined, new Set(["KeyW"]), 0.25, custom);
  assert.equal(state.a, true);
  assert.equal(state.up, false);
  assert.equal(
    sample(undefined, undefined, new Set(["KeyD"]), 0.25, {
      ...defaultKeyboard,
      right: "KeyJ",
    }).right,
    false,
  );
});

test("NES direction input is identical for WASD and arrow menus", () => {
  for (const [letter, arrow, direction] of [
    ["KeyW", "ArrowUp", "up"],
    ["KeyS", "ArrowDown", "down"],
    ["KeyA", "ArrowLeft", "left"],
    ["KeyD", "ArrowRight", "right"],
  ] as const) {
    const viaWASD = sample(undefined, undefined, new Set([letter]));
    const viaArrow = sample(undefined, undefined, new Set([arrow]));
    assert.equal(viaWASD[direction], true);
    assert.deepEqual(viaWASD, viaArrow);
  }
});
