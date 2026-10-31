import { test } from "node:test";
import assert from "node:assert/strict";
import {
  displayLayout,
  NES_VIDEO,
} from "../packages/media/src/display-scaler.ts";

test("NES 4:3 fit uses full vertical area without clipping", () => {
  assert.deepEqual(displayLayout(1920, 1080, NES_VIDEO), {
    width: 1440,
    height: 1080,
    offsetX: 240,
    offsetY: 0,
    actualMode: "fit",
    fallback: false,
  });
  assert.equal(displayLayout(2560, 1080, NES_VIDEO).width, 1440);
});
test("native pixel integer and NES corrected integer produce exact grid", () => {
  const native = displayLayout(1920, 1080, NES_VIDEO, "integer", "native");
  assert.deepEqual(
    [native.width, native.height, native.actualMode],
    [1024, 960, "integer"],
  );
  const corrected = displayLayout(1920, 1080, NES_VIDEO, "corrected-integer");
  assert.deepEqual(
    [corrected.width, corrected.height, corrected.actualMode],
    [1280, 960, "corrected-integer"],
  );
});
test("portrait/small areas fall back without crop or negative offsets", () => {
  for (const [w, h] of [
    [360, 780],
    [1280, 800],
    [2560, 1440],
    [80, 80],
    [0, 600],
    [NaN, 900],
  ]) {
    for (const mode of ["fit", "integer", "corrected-integer"] as const) {
      const result = displayLayout(w, h, NES_VIDEO, mode);
      assert.ok(result.width >= 0 && result.height >= 0);
      assert.ok(result.width <= (Number.isFinite(w) ? w : 0));
      assert.ok(result.height <= h);
      assert.ok(result.offsetX >= 0 && result.offsetY >= 0);
    }
  }
  assert.equal(displayLayout(360, 780, NES_VIDEO, "integer").fallback, false);
  assert.equal(displayLayout(200, 180, NES_VIDEO, "integer").fallback, true);
});
test("other consoles use own descriptor and do not inherit NES 4:3", () => {
  const psp = {
    ...NES_VIDEO,
    sourceWidth: 480,
    sourceHeight: 272,
    displayAspect: 30 / 17,
  };
  const fitted = displayLayout(1920, 1080, psp);
  assert.deepEqual([fitted.width, fitted.height], [1905, 1079]);
  assert.equal(
    displayLayout(1920, 1080, psp, "corrected-integer").actualMode,
    "fit",
  );
});
