import { test } from "node:test";
import assert from "node:assert/strict";
import { InputCapture } from "../packages/input/src/capture.ts";
import { defaultKeyboard, type Pad } from "../packages/input/src/nes-input.ts";
import type { PadPreference } from "../packages/input/src/preferences.ts";

const pad = (index = 0, id = "pad"): Pad => ({
  index,
  id,
  connected: true,
  mapping: "standard",
  buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })),
  axes: [0, 0],
});

function setup(preference: PadPreference = { mode: "auto" }) {
  const state = { pads: [] as (Pad | null)[], preference };
  const capture = new InputCapture(
    { ...defaultKeyboard },
    () => state.pads,
    () => state.preference,
  );
  capture.start({ ...defaultKeyboard });
  return { state, capture };
}

test("input is ignored until every control is released once", () => {
  const { capture } = setup();
  capture.keyDown("KeyL");
  assert.equal(capture.read().ready, false);
  capture.keyUp("KeyL");
  assert.equal(capture.read().ready, false); // the release frame is skipped
  capture.keyDown("KeyL");
  const r = capture.read();
  assert.equal(r.ready, true);
  assert.equal(r.input.a, true);
  capture.clear();
  assert.equal(capture.read().ready, false);
});

test("only bound keys are captured and repeats are not re-pressed", () => {
  const { capture } = setup();
  assert.equal(capture.keyDown("KeyP"), false);
  assert.equal(capture.keyDown("ArrowLeft", true), true);
  capture.read();
  assert.equal(capture.read().input.left, false);
});

test("the first standard pad is chosen and its loss pauses the game", () => {
  const { state, capture } = setup();
  const p = pad(1);
  state.pads = [null, p];
  capture.read();
  p.buttons[0].pressed = true;
  let r = capture.read();
  assert.equal(r.connected, true);
  assert.equal(r.status, "Mando conectado");
  assert.equal(r.input.a, true);
  state.pads = [];
  r = capture.read();
  assert.equal(r.lost, true);
  assert.match(r.status, /desconectado/);
});

test("a manually chosen pad must keep its identity", () => {
  const { state, capture } = setup({
    mode: "pad",
    index: 0,
    id: "mine",
    deadzone: 0.25,
  });
  state.pads = [pad(0, "other")];
  const r = capture.read();
  assert.equal(r.lost, true);
  assert.match(r.status, /ha cambiado/);
});

test("on-screen taps press briefly and clear with the session", () => {
  const { capture } = setup();
  capture.read();
  capture.tap("start");
  assert.equal(capture.read().input.start, true);
  capture.clear();
  capture.read();
  assert.equal(capture.read().input.start, false);
});

test("a blocked Gamepad API leaves the keyboard working", () => {
  const capture = new InputCapture(
    { ...defaultKeyboard },
    () => {
      throw Error("blocked");
    },
    () => ({ mode: "auto" }),
  );
  capture.read();
  capture.keyDown("KeyL");
  const r = capture.read();
  assert.match(r.status, /bloqueado/);
  assert.equal(r.input.a, true);
});
