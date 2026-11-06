// SNES with Snes9x (ADR-013): header validation and the original fixture's
// oracle, against the committed WebAssembly build.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { validateSnesRom } from "../packages/adapters/src/snes-header.ts";
import {
  Snes9xAdapter,
  prepareSnes9x,
  provideSnes9xBinary,
} from "../packages/adapters/src/snes9x.ts";
import { snesControlDemo } from "../packages/fixtures/src/snes-control-demo.ts";
import { libretroInputBits } from "../packages/adapters/src/wasm-host.ts";
import { neutral, type InputState } from "../packages/input/src/nes-input.ts";

provideSnes9xBinary(
  readFileSync(new URL("../cores/snes9x/dist/snes9x.wasm", import.meta.url)),
);

const FIXTURE_SHA256 =
  "f173f52b44b65eeccc5880c41376ee6eb90534aed8456bd4b6a74a20022709d1";

/** Header byte at LoROM offset $7FC0 + `at`, with a valid checksum pair. */
function patched(changes: Record<number, number>) {
  const rom = snesControlDemo();
  for (const [at, value] of Object.entries(changes))
    rom[0x7fc0 + Number(at)] = value;
  return rom;
}

test("the fixture is stable and its header validates", () => {
  const rom = snesControlDemo();
  assert.equal(createHash("sha256").update(rom).digest("hex"), FIXTURE_SHA256);
  assert.deepEqual(validateSnesRom(rom), {
    copierHeader: 0,
    map: "LoROM",
    title: "CARTIVO CONTROL DEMO",
    sramBytes: 2048,
    battery: true,
  });
  // A 512-byte copier header is skipped.
  const copier = new Uint8Array(512 + rom.length);
  copier.set(rom, 512);
  assert.equal(validateSnesRom(copier).copierHeader, 512);
});

test("unsupported or damaged cartridges are refused with a reason", () => {
  assert.throws(() => validateSnesRom(new Uint8Array(512)), /pequeño/);
  assert.throws(() => validateSnesRom(new Uint8Array(0x8000)), /cabecera/);
  // PAL (Europe, region 2) is accepted: the core runs it at 50 Hz.
  assert.doesNotThrow(() => validateSnesRom(patched({ 0x19: 0x02 })));
  assert.throws(() => validateSnesRom(patched({ 0x16: 0xe3 })), /Game Boy/);
  assert.throws(() => validateSnesRom(patched({ 0x16: 0xe5 })), /BS-X/);
  assert.throws(
    () => validateSnesRom(patched({ 0x16: 0xf5, [-1]: 0x02 })),
    /ST018/,
  );
  const sufami = new Uint8Array(0x8000);
  sufami.set(new TextEncoder().encode("BANDAI SFC-ADX"));
  assert.throws(() => validateSnesRom(sufami), /Sufami/);
});

test("buttons follow the libretro joypad order", () => {
  const only = (action: keyof InputState) =>
    libretroInputBits({ ...neutral(), [action]: true });
  assert.equal(only("b"), 1 << 0);
  assert.equal(only("y"), 1 << 1);
  assert.equal(only("right"), 1 << 7);
  assert.equal(only("a"), 1 << 8);
  assert.equal(only("x"), 1 << 9);
  assert.equal(only("r"), 1 << 11);
});

const pixel = (frame: Uint8ClampedArray, x: number, y: number) =>
  Array.from(frame.subarray((y * 256 + x) * 4, (y * 256 + x) * 4 + 3));

/** First column with a pixel that differs from the backdrop. */
function spriteAt(frame: Uint8ClampedArray) {
  const backdrop = pixel(frame, 0, 0).join();
  for (let y = 0; y < 224; y++)
    for (let x = 0; x < 256; x++)
      if (pixel(frame, x, y).join() !== backdrop) return { x, y };
  return undefined;
}

test("Snes9x runs the fixture: D-pad, A with battery RAM, B, X/Y/L/R", async () => {
  await prepareSnes9x();
  const core = new Snes9xAdapter(snesControlDemo());
  assert.equal(core.saveBytes, 2048);
  assert.equal(core.battery, true);
  let frame = core.advance(3);
  for (let i = 0; i < 20; i++) frame = core.advance(3);
  assert.deepEqual(pixel(frame.pixels, 0, 0), [0, 0, 255]); // blue: even
  const start = spriteAt(frame.pixels)!;
  core.input({ ...neutral(), right: true });
  for (let i = 0; i < 5; i++) core.advance(2);
  core.input(neutral());
  frame = core.advance(2);
  assert.ok(spriteAt(frame.pixels)!.x > start.x, "the sprite moved right");

  core.input({ ...neutral(), a: true });
  core.advance(3);
  core.input(neutral());
  frame = core.advance(3);
  assert.equal(core.save()[0], 1, "A counted in battery RAM");
  assert.deepEqual(pixel(frame.pixels, 0, 0), [0, 255, 0]); // green: odd

  core.input({ ...neutral(), b: true });
  frame = core.advance(2);
  assert.deepEqual(pixel(frame.pixels, 0, 0), [255, 0, 0]);

  const at = spriteAt(core.advance(1).pixels)!;
  for (const [button, rgb] of [
    ["x", [255, 255, 0]],
    ["y", [0, 255, 255]],
    ["l", [255, 0, 255]],
    ["r", [255, 134, 0]],
  ] as const) {
    core.input({ ...neutral(), [button]: true });
    frame = core.advance(2);
    assert.deepEqual(pixel(frame.pixels, at.x, at.y), [...rgb], button);
  }

  // Audio: about 48 000 mono samples per second, finite.
  core.input(neutral());
  let samples = 0;
  for (let i = 0; i < 20; i++) {
    const out = core.advance(3);
    samples += out.audio.length;
    assert.ok(out.audio.every(Number.isFinite));
  }
  assert.ok(
    Math.abs(samples - 48000) < 1000,
    `${samples} samples per 60 frames`,
  );

  // Reopening with the stored battery RAM shows the stored value.
  const save = core.save();
  core.dispose();
  const again = new Snes9xAdapter(snesControlDemo(), save);
  frame = again.advance(3);
  for (let i = 0; i < 5; i++) frame = again.advance(3);
  assert.deepEqual(pixel(frame.pixels, 0, 0), [0, 255, 0]);
  const t = performance.now();
  for (let i = 0; i < 100; i++) again.advance(3);
  const ms = (performance.now() - t) / 300;
  console.log(`Snes9x WASM en Node: ${ms.toFixed(2)} ms/frame`);
  again.dispose();
});
