// The display preview's own picture (DisplayPreview.svelte).
import { test } from "node:test";
import assert from "node:assert/strict";
import { samplePixels, spriteCentre } from "../apps/web/src/display-sample.ts";

test("the preview picture fills every console's source size, opaque", () => {
  for (const [w, h] of [
    [160, 144],
    [256, 240],
    [320, 224],
    [640, 480],
  ]) {
    const pixels = samplePixels(w, h);
    assert.equal(pixels.length, w * h * 4);
    for (let i = 3; i < pixels.length; i += 4) assert.equal(pixels[i], 255);
    // The sprite's eye is white at a fixed offset from its centre.
    const { x, y } = spriteCentre(w, h);
    const eye = ((y - 4) * w + (x - 3)) * 4;
    assert.deepEqual([...pixels.subarray(eye, eye + 3)], [250, 250, 250]);
  }
  assert.deepEqual(samplePixels(32, 32), samplePixels(32, 32));
});
