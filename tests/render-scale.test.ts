import assert from "node:assert/strict";
import { test } from "node:test";
import {
  autoRenderScale,
  renderScale,
} from "../packages/runtime/src/render-scale.ts";

test("automatic resolution is the multiple nearest to the screen", () => {
  assert.equal(autoRenderScale(768, 480), 2);
  assert.equal(autoRenderScale(1080, 480), 2);
  assert.equal(autoRenderScale(1080, 448), 2);
  assert.equal(autoRenderScale(1440, 480), 3);
  assert.equal(autoRenderScale(2160, 448), 4, "never above the maximum");
  assert.equal(autoRenderScale(320, 480), 1, "never below the original");
  assert.equal(autoRenderScale(0, 480), 1);
});

test("the device's ceiling limits automatic, not a fixed choice", () => {
  assert.equal(autoRenderScale(1440, 480, 2), 2);
  assert.equal(renderScale("auto", 1440, 480, 1), 1);
  assert.equal(renderScale(3, 1440, 480, 1), 3);
});
