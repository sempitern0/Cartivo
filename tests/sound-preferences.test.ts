import { test } from "node:test";
import assert from "node:assert/strict";
import {
  defaultSound,
  gainOf,
  parseSound,
  readSound,
  SOUND_KEY,
  writeSound,
} from "../packages/media/src/sound-preferences.ts";

const memory = () => {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    data,
  };
};

test("sound preferences round-trip and fall back to the defaults", () => {
  const store = memory();
  assert.deepEqual(readSound(store), defaultSound);
  assert.equal(writeSound({ volume: 0.5, muted: true }, store), true);
  assert.deepEqual(readSound(store), { volume: 0.5, muted: true });
  store.data.set(SOUND_KEY, "{not json");
  assert.deepEqual(readSound(store), defaultSound);
  for (const bad of [{ volume: 2, muted: false }, { volume: 0.5 }, null])
    assert.equal(parseSound(bad), undefined);
  const full = {
    getItem: () => null,
    setItem: () => {
      throw new DOMException("full", "QuotaExceededError");
    },
  };
  assert.equal(writeSound(defaultSound, full), false);
});

test("the output gain scales the player's level and mutes to zero", () => {
  assert.equal(gainOf(defaultSound), 0.3);
  assert.equal(gainOf({ volume: 0.5, muted: false }), 0.15);
  assert.equal(gainOf({ volume: 1, muted: true }), 0);
});
