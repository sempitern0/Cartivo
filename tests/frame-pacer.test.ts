// The game loop's pacing: system rate, never faster to catch up, a single
// stall is absorbed, repeated stalls mean the device is too slow.
import { test } from "node:test";
import assert from "node:assert/strict";
import { FramePacer } from "../packages/media/src/frame-pacer.ts";

const frames = (step: ReturnType<FramePacer["step"]>) =>
  "frames" in step ? step.frames : "tooSlow";

test("frames follow the system rate, at most 3 per call", () => {
  const pacer = new FramePacer(60);
  pacer.start(0);
  let total = 0;
  for (let t = 1000 / 60; t <= 1000; t += 1000 / 60)
    total += frames(pacer.step(t)) as number;
  assert.ok(Math.abs(total - 60) <= 1, `${total} frames in one second`);
  assert.equal(frames(pacer.step(1000 + 100)), 3, "capped at 3");
});

test("one stall (a slow first frame) is dropped, not paused or rushed", () => {
  const pacer = new FramePacer(60);
  pacer.start(0);
  assert.equal(
    frames(pacer.step(400)),
    1,
    "24 frames owed: dropped, one frame",
  );
  assert.equal(frames(pacer.step(400 + 1000 / 60)), 1, "then the normal pace");
});

test("stalls that keep coming mean the device is too slow", () => {
  const pacer = new FramePacer(60);
  pacer.start(0);
  assert.equal(frames(pacer.step(300)), 1);
  assert.equal(frames(pacer.step(600)), 1);
  assert.equal(frames(pacer.step(900)), "tooSlow");
  // Stalls far apart do not add up; resuming clears the count.
  pacer.start(0);
  assert.equal(frames(pacer.step(300)), 1);
  assert.equal(frames(pacer.step(6000)), 1);
  assert.equal(frames(pacer.step(12000)), 1);
});
