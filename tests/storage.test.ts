import { test } from "node:test";
import assert from "node:assert/strict";
import { StateStore, snapshotFits } from "../packages/storage/src/states.ts";
import {
  MAX_BACKUP_FILE,
  backupFormat,
  sramKey,
} from "../packages/storage/src/formats.ts";
import { SramStore } from "../packages/storage/src/sram.ts";
import { StorageUnavailable } from "../packages/storage/src/idb.ts";

// Without Web Locks there is no safe single writer: the stores refuse to
// open (StorageUnavailable), never an unsafe multi-tab mode. The Worker then
// runs the game without saving anything.
test("stores refuse to open without Web Locks", async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {},
  });
  try {
    for (const opening of [StateStore.open("game"), SramStore.open("game")])
      await assert.rejects(
        opening,
        (e: Error) =>
          e instanceof StorageUnavailable && /Web Locks/.test(e.message),
      );
  } finally {
    if (original) Object.defineProperty(globalThis, "navigator", original);
  }
});

test("NES keeps its shipped storage names; other systems get their own", () => {
  assert.equal(sramKey("nes", "abc"), "nrom-sram-v1:abc");
  assert.equal(backupFormat("nes"), "cartivo-nrom-sram-v1");
  assert.equal(sramKey("gb", "abc"), "gb-sram-v1:abc");
  assert.equal(backupFormat("gb"), "cartivo-gb-sram-v1");
  // N64's battery block as a JSON byte array still fits the file cap.
  const copy = JSON.stringify({ bytes: Array(296960).fill(255) });
  assert.ok(copy.length < MAX_BACKUP_FILE);
});

test("snapshots only restore on the core and version that wrote them", () => {
  const saved = { core: "jsnes", coreVersion: "2.1.0" };
  const name = (id: string) => (id === "jsnes" ? "JSNES" : id);
  assert.doesNotThrow(() => snapshotFits(saved, "jsnes", "2.1.0"));
  assert.throws(
    () => snapshotFits(saved, "tetanes", "0.17.0", name),
    /se guardó con JSNES\. Cambia de núcleo/,
  );
  assert.throws(
    () => snapshotFits(saved, "jsnes", "2.2.0"),
    /otra versión del núcleo \(2\.1\.0\)/,
  );
  // Without labels the id is shown rather than a guessed core name.
  assert.throws(() => snapshotFits(saved, "other", "1"), /con jsnes\./);
});
