// Game Boy specifics beyond the generic conformance battery (ADR-010).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  SameBoyAdapter,
  prepareSameBoy,
  provideSameBoyBinary,
} from "../packages/adapters/src/sameboy.ts";
import { headerChecksum } from "../packages/adapters/src/gb-header.ts";
import { gbControlDemo } from "../packages/fixtures/src/gb-control-demo.ts";
import { neutral } from "../packages/input/src/nes-input.ts";

provideSameBoyBinary(
  readFileSync(new URL("../cores/sameboy/dist/sameboy.wasm", import.meta.url)),
);

/** Runs past the boot ROM animation (the CGB one is the longest). */
function boot(core: SameBoyAdapter) {
  for (let i = 0; i < 100; i++) core.advance(3);
  return core.lastFrame();
}

function greyOnly(pixels: Uint8ClampedArray) {
  for (let i = 0; i < pixels.length; i += 4)
    if (pixels[i] !== pixels[i + 1] || pixels[i + 1] !== pixels[i + 2])
      return false;
  return true;
}

test("the cartridge header picks DMG (grey) or CGB (colour) hardware", async () => {
  await prepareSameBoy();
  const dmg = new SameBoyAdapter(gbControlDemo(false));
  assert.ok(greyOnly(boot(dmg)), "DMG-only cartridge shows shades of grey");
  dmg.dispose();
  const cgb = new SameBoyAdapter(gbControlDemo(true));
  assert.ok(!greyOnly(boot(cgb)), "CGB-compatible cartridge shows colour");
  cgb.dispose();
});

test("MBC3 clock is saved with the battery RAM and keeps time while closed", async () => {
  await prepareSameBoy();
  const rom = gbControlDemo();
  rom[0x147] = 0x10; // MBC3 + timer + RAM + battery
  rom[0x14d] = headerChecksum(rom);
  const first = new SameBoyAdapter(rom);
  // 8 KiB of RAM plus the 48-byte clock footer (vba64 layout).
  assert.equal(first.saveBytes, 8192 + 48);
  boot(first);
  first.input({ ...neutral(), a: true });
  first.advance(2);
  first.input(neutral());
  first.advance(2);
  const save = first.save();
  first.dispose();
  const footer = new DataView(save.buffer, 8192, 48);
  const now = BigInt(Math.floor(Date.now() / 1000));
  const stamp = footer.getBigUint64(40, true);
  assert.ok(stamp > now - 60n && stamp <= now + 1n, "timestamp is wall time");
  // Pretend the app was closed three hours ago with the clock at zero.
  for (let i = 0; i < 40; i += 4) footer.setUint32(i, 0, true);
  footer.setBigUint64(40, now - 3n * 3600n, true);
  const again = new SameBoyAdapter(rom, save);
  again.advance(3);
  const later = again.save();
  again.dispose();
  const hours = new DataView(later.buffer, 8192, 48).getUint32(8, true);
  assert.ok(hours >= 2 && hours <= 3, `clock advanced ~3 h (got ${hours})`);
  assert.equal(later[0], save[0], "the A counter in RAM survives too");
});
