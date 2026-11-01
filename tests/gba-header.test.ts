import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  gbaHeaderChecksum,
  validateGbaRom,
} from "../packages/adapters/src/gba-header.ts";
import { gbaControlDemo } from "../packages/fixtures/src/gba-control-demo.ts";

const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

test("the original GBA fixture has a valid header and no artwork", () => {
  const rom = gbaControlDemo();
  assert.equal(rom.length, 0x10000);
  assert.deepEqual(validateGbaRom(rom), { battery: true });
  assert.equal(rom[0xb2], 0x96);
  // Logo area left blank: mGBA's HLE BIOS does not check it.
  assert.ok(rom.subarray(0x04, 0xa0).every((b) => b === 0));
  assert.equal(sha(gbaControlDemo()), sha(rom));
});

test("damaged or foreign files are rejected", () => {
  assert.throws(() => validateGbaRom(new Uint8Array(64)), /demasiado pequeño/);
  const bad = gbaControlDemo();
  bad[0xa0] ^= 1;
  assert.throws(() => validateGbaRom(bad), /cabecera del cartucho está dañada/);
  const fixed = gbaControlDemo();
  fixed[0xb2] = 0;
  fixed[0xbd] = gbaHeaderChecksum(fixed);
  assert.throws(() => validateGbaRom(fixed), /Game Boy Advance/);
});
