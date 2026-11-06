// A disc's identity: stable for the same files, different for any change.
import { test } from "node:test";
import assert from "node:assert/strict";
import { discIdentity } from "../packages/storage/src/disc-identity.ts";
import { isSha256 } from "../packages/storage/src/library.ts";

const bytes = (n: number, seed = 1) =>
  Uint8Array.from({ length: n }, (_, i) => (i * 7 + seed) & 0xff);
const part = (name: string, data: Uint8Array) => ({
  name,
  blob: new Blob([data]),
});

test("same files, same identity; any change gives another", async () => {
  const cue = new TextEncoder().encode('FILE "game.bin" BINARY\n');
  const bin = bytes(100_000);
  const id = await discIdentity(
    [part("game.cue", cue), part("game.bin", bin)],
    4096,
  );
  assert.ok(isSha256(id));
  assert.equal(
    await discIdentity([part("GAME.CUE", cue), part("game.bin", bin)], 4096),
    id,
    "names compare without case",
  );
  const changed = bin.slice();
  changed[99_999] ^= 1;
  assert.notEqual(
    await discIdentity(
      [part("game.cue", cue), part("game.bin", changed)],
      4096,
    ),
    id,
  );
  assert.notEqual(
    await discIdentity([part("game.cue", cue), part("other.bin", bin)], 4096),
    id,
  );
  assert.notEqual(await discIdentity([part("game.bin", bin)], 4096), id);
});
