import assert from "node:assert/strict";
import { test } from "node:test";
import { AudioPace } from "../packages/adapters/src/audio-pace.ts";

const block = (length: number, value = 1) =>
  new Float32Array(length).fill(value);

test("blocks of sound become one frame's worth per frame", () => {
  const pace = new AudioPace(48000, 60);
  // Nothing plays until 60 ms are held back.
  assert.equal(pace.step(block(1056), 1).length, 0);
  assert.equal(pace.step(block(1056), 1).length, 0);
  assert.equal(pace.step(block(1056), 1).length, 800);
  // Frames without a new block still play a full frame.
  assert.equal(pace.step(block(0), 1).length, 800);
  assert.equal(pace.step(block(1056), 2).length, 1600);
});

test("fractions of a sample carry over (59.94 Hz)", () => {
  const pace = new AudioPace(48000, 59.94);
  pace.step(block(9000), 1);
  let played = 0;
  for (let i = 0; i < 10; i++) played += pace.step(block(801), 1).length;
  assert.ok(Math.abs(played - 8008) <= 1, String(played));
});

test("a queue that runs dry fills again before playing", () => {
  const pace = new AudioPace(48000, 60);
  assert.equal(pace.step(block(2880), 1).length, 800);
  assert.equal(pace.step(block(0), 3).length, 2080, "what is left");
  assert.equal(pace.step(block(800), 1).length, 0, "filling again");
});

test("latency is bounded: the oldest samples are dropped", () => {
  const pace = new AudioPace(48000, 60);
  pace.step(block(9600, 1), 1);
  const out = pace.step(block(9600, 2), 1);
  assert.equal(out.length, 800);
  assert.equal(out[0], 2, "only the newest block is left");
});
