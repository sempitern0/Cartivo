// Sizes in the interface (apps/web/src/format.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { megabytes } from "../apps/web/src/format.ts";

test("sizes show binary megabytes with one decimal at most", () => {
  assert.equal(megabytes(0), "0 MB");
  assert.equal(megabytes(1024 * 1024), "1 MB");
  assert.equal(megabytes(1.25 * 1024 * 1024), "1,3 MB");
});
