import { test } from "node:test";
import assert from "node:assert/strict";
import {
  defaultDisplay,
  parseDisplay,
  readDisplay,
  writeDisplay,
  displayKey,
} from "../packages/media/src/display-preferences.ts";

class Memory {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
}

test("display preferences round-trip per system", () => {
  const store = new Memory();
  const prefs = { scale: "integer", aspect: "native", smooth: true } as const;
  assert.equal(writeDisplay("nes", prefs, store), true);
  assert.deepEqual(readDisplay("nes", store), prefs);
  assert.deepEqual(readDisplay("snes", store), defaultDisplay);
});

test("invalid or foreign values fall back to the original look", () => {
  assert.equal(
    parseDisplay({ v: 1, scale: "huge", aspect: "native", smooth: false }),
    undefined,
  );
  assert.equal(
    parseDisplay({ v: 2, scale: "fit", aspect: "native", smooth: false }),
    undefined,
  );
  assert.equal(
    parseDisplay({ v: 1, scale: "fit", aspect: "native", smooth: "yes" }),
    undefined,
  );
  const store = new Memory();
  store.setItem(displayKey("nes"), "{not json");
  assert.deepEqual(readDisplay("nes", store), defaultDisplay);
  assert.equal(defaultDisplay.smooth, false);
});

test("unavailable storage does not throw", () => {
  const broken = {
    getItem(): string | null {
      throw Error("blocked");
    },
    setItem() {
      throw Error("blocked");
    },
  };
  assert.deepEqual(readDisplay("nes", broken), defaultDisplay);
  assert.equal(writeDisplay("nes", defaultDisplay, broken), false);
});
