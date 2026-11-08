// Animation preference (apps/web/src/motion.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseMotion, reducesMotion } from "../apps/web/src/motion.ts";

test("automatic follows the system; the player can force either way", () => {
  assert.equal(parseMotion("full"), "full");
  assert.equal(parseMotion("reduce"), "reduce");
  for (const value of [null, "", "on", 1])
    assert.equal(parseMotion(value), "auto");
  assert.equal(reducesMotion("auto", true), true);
  assert.equal(reducesMotion("auto", false), false);
  assert.equal(reducesMotion("full", true), false);
  assert.equal(reducesMotion("reduce", false), true);
});
