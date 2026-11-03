// Storage notices come from what the browser actually exposes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { storageHealth } from "../packages/storage/src/persistence.ts";

const opfs = (ok: boolean) => ({
  getDirectory: () => (ok ? Promise.resolve({}) : Promise.reject(Error("x"))),
});

test("storage health: ok, limited (no OPFS) or none (no locks / IndexedDB)", async () => {
  const full = { indexedDB: {}, navigator: { locks: {}, storage: opfs(true) } };
  assert.equal(await storageHealth(full), "ok");
  assert.equal(
    await storageHealth({
      ...full,
      navigator: { locks: {}, storage: opfs(false) },
    }),
    "limited",
  );
  assert.equal(
    await storageHealth({ ...full, navigator: { locks: {} } }),
    "limited",
    "no OPFS at all",
  );
  assert.equal(await storageHealth({ ...full, indexedDB: undefined }), "none");
  assert.equal(
    await storageHealth({ indexedDB: {}, navigator: { storage: opfs(true) } }),
    "none",
  );
});
