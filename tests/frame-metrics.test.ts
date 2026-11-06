import { test } from "node:test";
import assert from "node:assert/strict";
import { FrameMetrics } from "../packages/media/src/frame-metrics.ts";

test("metrics count batched frames and bound the rolling window", () => {
  const metrics = new FrameMetrics();
  metrics.reset(0);
  for (let i = 1; i <= 200; i++) metrics.record(i * 50, i, 3);
  assert.deepEqual(metrics.snapshot(), {
    samples: 120,
    fps: 60,
    meanMs: 140.5,
    p95Ms: 194,
  });
});

test("resume excludes paused time and invalid observations", () => {
  const metrics = new FrameMetrics();
  metrics.record(50, 10, 3);
  metrics.reset(10000);
  metrics.record(NaN, 1, 1);
  metrics.record(10010, -1, 1);
  metrics.record(10010, 1, 0);
  metrics.record(10000, 1, 1);
  assert.equal(metrics.snapshot().samples, 0);
  metrics.record(10050, 5, 3);
  assert.deepEqual(metrics.snapshot(), {
    samples: 1,
    fps: 60,
    meanMs: 5,
    p95Ms: 5,
  });
});
