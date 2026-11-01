import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  headerChecksum,
  validateGbRom,
} from "../packages/adapters/src/gb-header.ts";
import { gbControlDemo } from "../packages/fixtures/src/gb-control-demo.ts";

const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
const fix = (rom: Uint8Array) => {
  rom[0x14d] = headerChecksum(rom);
  return rom;
};

test("the original fixture is a valid MBC1 cartridge in both variants", () => {
  const gb = gbControlDemo();
  const gbc = gbControlDemo(true);
  assert.equal(gb.length, 0x8000);
  assert.deepEqual(validateGbRom(gb), {
    battery: true,
    cgb: false,
    mapper: "MBC1+RAM+BATTERY",
  });
  assert.equal(validateGbRom(gbc).cgb, true);
  // The logo area stays blank: no Nintendo artwork in the fixture.
  assert.ok(gb.subarray(0x104, 0x134).every((b) => b === 0));
  // Deterministic output, so the hash can be recorded as the oracle.
  assert.equal(sha(gbControlDemo()), sha(gb));
  assert.notEqual(sha(gbc), sha(gb));
});

test("damaged, truncated or unsupported cartridges are rejected", () => {
  assert.throws(() => validateGbRom(new Uint8Array(16)), /demasiado pequeño/);
  const bad = gbControlDemo();
  bad[0x134] ^= 1;
  assert.throws(() => validateGbRom(bad), /cabecera del cartucho está dañada/);
  const big = gbControlDemo();
  big[0x148] = 0x01; // claims 64 KiB
  assert.throws(() => validateGbRom(fix(big)), /incompleto/);
  const camera = gbControlDemo();
  camera[0x147] = 0xfc;
  assert.throws(() => validateGbRom(fix(camera)), /Pocket Camera/);
  const unknown = gbControlDemo();
  unknown[0x147] = 0x42;
  assert.throws(() => validateGbRom(fix(unknown)), /desconocido \(\$42\)/);
  const rtc = gbControlDemo();
  rtc[0x147] = 0x10;
  assert.equal(validateGbRom(fix(rtc)).mapper, "MBC3+TIMER+RAM+BATTERY");
});
