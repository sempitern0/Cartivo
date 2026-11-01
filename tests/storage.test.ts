import { test } from "node:test";
import assert from "node:assert/strict";
import { StateStore } from "../packages/storage/src/states.ts";
import { SramStore } from "../packages/storage/src/sram.ts";

// Without Web Locks there is no safe single writer: refuse explicitly
// instead of falling back to an unsafe multi-tab mode.
test("stores refuse to open without Web Locks", async () => {
  const nav = globalThis.navigator as Navigator & { locks?: unknown };
  assert.equal(nav?.locks, undefined, "Node has no Web Locks");
  await assert.rejects(StateStore.open("game"), /Web Locks/);
  await assert.rejects(SramStore.open("game"), /Web Locks/);
});
