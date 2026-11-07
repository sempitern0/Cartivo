import { test } from "node:test";
import assert from "node:assert/strict";
import {
  analogOf,
  centered,
  isAnalog,
  stick,
  STICK_DEADZONE,
  toInt16,
} from "../packages/input/src/analog.ts";
import { InputCapture } from "../packages/input/src/capture.ts";
import { defaultKeyboard, type Pad } from "../packages/input/src/nes-input.ts";
import { readFileSync } from "node:fs";
import {
  SameBoyAdapter,
  prepareSameBoy,
  provideSameBoyBinary,
} from "../packages/adapters/src/sameboy.ts";
import { gbControlDemo } from "../packages/fixtures/src/gb-control-demo.ts";

const close = (a: number, b: number) =>
  assert.ok(Math.abs(a - b) < 1e-9, `${a} ≈ ${b}`);
const pad = (axes: number[], mapping = "standard"): Pad => ({
  index: 0,
  id: "pad",
  connected: true,
  mapping,
  buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })),
  axes,
});

test("a stick inside the radial deadzone is exactly centred", () => {
  assert.deepEqual(stick(0, 0), { x: 0, y: 0 });
  assert.deepEqual(stick(0.1, 0.1), { x: 0, y: 0 }); // drift, |v| ≈ 0.14
  assert.deepEqual(stick(STICK_DEADZONE, 0), { x: 0, y: 0 });
});

test("outside the deadzone the push is rescaled, keeping its direction", () => {
  // Halfway between the deadzone edge and full tilt reads as half.
  const half = stick((1 + STICK_DEADZONE) / 2, 0);
  close(half.x, 0.5);
  assert.equal(half.y, 0);
  // Full tilt is 1 in every direction; y keeps its sign (down positive).
  close(stick(0, 1).y, 1);
  close(stick(-1, 0).x, -1);
  const diagonal = stick(Math.SQRT1_2, -Math.SQRT1_2);
  close(diagonal.x, Math.SQRT1_2);
  close(diagonal.y, -Math.SQRT1_2);
});

test("square-gate corners and bad readings stay inside the unit circle", () => {
  const corner = stick(1, 1);
  close(Math.hypot(corner.x, corner.y), 1);
  assert.deepEqual(stick(Number.NaN, Infinity), { x: 0, y: 0 });
  assert.deepEqual(stick(5, 0), stick(1, 0));
  assert.throws(() => stick(0.5, 0, 1), RangeError);
});

test("only a connected standard pad has known sticks", () => {
  const sticks = analogOf(pad([0, 0.6, -1, 0]));
  assert.equal(sticks.left.x, 0);
  assert.ok(sticks.left.y > 0);
  close(sticks.right.x, -1);
  assert.deepEqual(analogOf(pad([1, 1], "")), centered());
  assert.deepEqual(analogOf({ ...pad([1, 1]), connected: false }), centered());
  assert.deepEqual(analogOf(undefined), centered());
  assert.deepEqual(analogOf(pad([])), centered()); // fewer axes than sticks
});

test("protocol shape and the 16-bit core range", () => {
  assert.ok(isAnalog(centered()));
  assert.ok(isAnalog({ left: { x: -1, y: 1 }, right: { x: 0.5, y: 0 } }));
  for (const bad of [
    null,
    { left: { x: 0, y: 0 } },
    { left: { x: 2, y: 0 }, right: { x: 0, y: 0 } },
    { left: { x: Number.NaN, y: 0 }, right: { x: 0, y: 0 } },
    { left: { x: "0", y: 0 }, right: { x: 0, y: 0 } },
  ])
    assert.equal(isAnalog(bad), false);
  assert.equal(toInt16(1), 32767);
  assert.equal(toInt16(-1), -32767);
  assert.equal(toInt16(0), 0);
  assert.equal(toInt16(0.5), 16384);
});

test("capture reports sticks only once ready, and centres them when lost", () => {
  const state = { pads: [pad([0, 0, 0, 0])] as (Pad | null)[] };
  const capture = new InputCapture(
    { ...defaultKeyboard },
    () => state.pads,
    () => ({ mode: "auto" }),
  );
  capture.start({ ...defaultKeyboard });
  // Held stick at start: digital up from the axis, nothing sent yet.
  state.pads = [pad([0, -1, 0, 0])];
  assert.deepEqual(capture.read().analog, centered());
  state.pads = [pad([0, 0, 0, 0])];
  capture.read(); // released: ready from the next frame
  state.pads = [pad([0.1, 0, 1, 0])];
  const reading = capture.read();
  assert.equal(reading.ready, true);
  assert.equal(reading.analog.left.x, 0); // inside the deadzone
  close(reading.analog.right.x, 1);
  state.pads = [];
  assert.deepEqual(capture.read().analog, centered());
});

test("a bridge without sticks ignores them (no export, no error)", async () => {
  const sameboy = readFileSync(
    new URL("../cores/sameboy/dist/sameboy.wasm", import.meta.url),
  );
  provideSameBoyBinary(sameboy);
  await prepareSameBoy();
  const core = new SameBoyAdapter(gbControlDemo(true));
  core.analog({ left: { x: 1, y: -1 }, right: { x: -1, y: 1 } });
  core.advance(1);
  assert.ok(core.frames >= 1);
});
