// Game Boy Advance save chips (ADR-011): the original fixture stores its
// counter with each chip's real protocol; reopening must give it back.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  MgbaAdapter,
  prepareMgba,
  provideMgbaBinary,
} from "../packages/adapters/src/mgba.ts";
import {
  gbaControlDemo,
  type GbaSaveKind,
} from "../packages/fixtures/src/gba-control-demo.ts";
import { neutral } from "../packages/input/src/nes-input.ts";

provideMgbaBinary(
  readFileSync(new URL("../cores/mgba/dist/mgba.wasm", import.meta.url)),
);

/** Background colour of the first pixel: odd counter blue, even green. */
const background = (core: MgbaAdapter) => {
  const [r, g, b] = core.lastFrame();
  return r === 0 && g === 255 && b === 0
    ? "green"
    : r === 0 && g === 0 && b === 255
      ? "blue"
      : `${r},${g},${b}`;
};

/** The fixture repaints the whole screen from ROM (~4 frames): let it. */
function settle(core: MgbaAdapter) {
  for (let i = 0; i < 4; i++) core.advance(3);
}

function pressA(core: MgbaAdapter) {
  core.input({ ...neutral(), a: true });
  core.advance(2);
  core.input(neutral());
  for (let i = 0; i < 20; i++) core.advance(3); // let EEPROM settle
}

for (const kind of ["sram", "flash", "eeprom"] as GbaSaveKind[]) {
  test(`${kind}: the game reads its own save back after reopening`, async () => {
    await prepareMgba();
    const rom = gbaControlDemo(kind);
    const first = new MgbaAdapter(rom);
    settle(first);
    // Fresh chip: erased (0xFF), so the counter is odd and the screen blue.
    assert.equal(background(first), "blue");
    pressA(first);
    assert.equal(background(first), "green");
    const save = first.save();
    first.dispose();
    assert.equal(save.length, 128 * 1024);
    assert.equal(save[0], 0x00, "counter 0xFF + 1 at the chip's first byte");
    if (kind === "flash") {
      // Flash commands go to the chip, not into the data: no SRAM fallback.
      assert.equal(save[0x5555], 0xff);
      assert.equal(save[0x2aaa], 0xff);
    }
    const again = new MgbaAdapter(rom, save);
    settle(again);
    assert.equal(background(again), "green", "counter read back on boot");
    pressA(again);
    assert.equal(again.save()[0], 0x01);
    again.dispose();
  });
}

test("a game without a save chip leaves the buffer erased", async () => {
  await prepareMgba();
  const core = new MgbaAdapter(gbaControlDemo("none"));
  settle(core);
  pressA(core);
  assert.equal(background(core), "blue"); // work RAM counter 0 → 1
  const save = core.save();
  core.dispose();
  assert.ok(save.every((b) => b === 0xff));
  // SramStore writes only when the SHA-256 changes: hashing this buffer is
  // the periodic cost (every 120 frames), measured here for the record.
  const t0 = performance.now();
  for (let i = 0; i < 20; i++) await crypto.subtle.digest("SHA-256", save);
  const ms = (performance.now() - t0) / 20;
  assert.ok(ms < 20, `SHA-256 of 128 KiB took ${ms.toFixed(2)} ms`);
});
