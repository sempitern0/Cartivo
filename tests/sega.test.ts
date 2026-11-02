// Master System and Mega Drive with Genesis Plus GX (ADR-014): header
// validation and the original fixtures' oracles, against the committed build.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  validateMdRom,
  validateSmsRom,
} from "../packages/adapters/src/sega-header.ts";
import {
  GenesisPlusGxAdapter,
  prepareGenesis,
  provideGenesisBinary,
  segaInputBits,
} from "../packages/adapters/src/genesis-plus-gx.ts";
import { mdControlDemo } from "../packages/fixtures/src/md-control-demo.ts";
import { smsControlDemo } from "../packages/fixtures/src/sms-control-demo.ts";
import { neutral, type InputState } from "../packages/input/src/nes-input.ts";

provideGenesisBinary(
  readFileSync(
    new URL(
      "../cores/genesis-plus-gx/dist/genesis-plus-gx.wasm",
      import.meta.url,
    ),
  ),
);

const sha = (rom: Uint8Array) => createHash("sha256").update(rom).digest("hex");

test("the fixtures are stable and their headers validate", () => {
  assert.equal(
    sha(mdControlDemo()),
    "f100be25d067e91aff81f4f2e0ecc406c372bfc1175aede409b4880c40c9e2ff",
  );
  assert.equal(
    sha(smsControlDemo()),
    "e8d347fefc7a7cb5a725195981609e0320233a849b3d4ce1bf15d3221a3f2370",
  );
  assert.deepEqual(validateMdRom(mdControlDemo()), {
    battery: true,
    title: "CARTIVO CONTROL DEMO",
  });
  assert.equal(validateSmsRom(smsControlDemo()).battery, true);
});

test("unsupported or damaged Sega cartridges are refused with a reason", () => {
  const md = (at: number, text: string) => {
    const rom = mdControlDemo();
    rom.set(new TextEncoder().encode(text), at);
    return rom;
  };
  assert.throws(() => validateMdRom(new Uint8Array(0x100)), /pequeño/);
  assert.throws(() => validateMdRom(new Uint8Array(0x8000)), /cabecera/);
  assert.throws(() => validateMdRom(new Uint8Array(0x8000 + 512)), /SMD/);
  assert.throws(() => validateMdRom(md(0x100, "SEGA 32X        ")), /32X/);
  assert.throws(() => validateMdRom(md(0, "SEGADISCSYSTEM")), /Mega-CD/);
  assert.throws(() => validateMdRom(md(0x1f0, "E  ")), /PAL/);
  assert.equal(validateMdRom(md(0x1f0, "UE ")).battery, true);

  assert.throws(() => validateSmsRom(new Uint8Array(0x1000)), /pequeño/);
  assert.throws(() => validateSmsRom(mdControlDemo()), /Mega Drive/);
  const gg = smsControlDemo();
  gg[0x7fff] = 0x6e; // region 6: Game Gear export
  assert.throws(() => validateSmsRom(gg), /Game Gear/);
  // Japanese carts may have no "TMR SEGA" header at all.
  assert.equal(validateSmsRom(new Uint8Array(0x8000)).battery, true);
});

test("buttons follow the libretro joypad order", () => {
  const only = (action: keyof InputState) =>
    segaInputBits({ ...neutral(), [action]: true });
  assert.equal(only("b"), 1 << 0);
  assert.equal(only("y"), 1 << 1);
  assert.equal(only("select"), 1 << 2);
  assert.equal(only("a"), 1 << 8);
  assert.equal(only("l"), 1 << 10);
});

const rgb = (frame: Uint8ClampedArray, width: number, x: number, y: number) =>
  Array.from(frame.subarray((y * width + x) * 4, (y * width + x) * 4 + 3));

/** First pixel that differs from the backdrop at (0, 0). */
function spriteAt(frame: Uint8ClampedArray, width: number, height: number) {
  const backdrop = rgb(frame, width, 0, 0).join();
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (rgb(frame, width, x, y).join() !== backdrop) return { x, y };
  return undefined;
}

/** Shared oracle: D-pad moves, the counter button uses battery RAM. */
async function playthrough(
  system: "md" | "sms",
  rom: Uint8Array,
  counterByte: number,
) {
  await prepareGenesis();
  const width = system === "md" ? 320 : 256;
  const height = system === "md" ? 224 : 192;
  const core = new GenesisPlusGxAdapter(system, rom);
  assert.equal(core.saveBytes, 0x10000);
  assert.equal(core.battery, true);
  let frame = core.advance(3);
  for (let i = 0; i < 20; i++) frame = core.advance(3);
  assert.equal(frame.pixels.length, width * height * 4);
  const odd = rgb(frame.pixels, width, 0, 0); // erased RAM is $FF: odd
  const start = spriteAt(frame.pixels, width, height)!;
  core.input({ ...neutral(), right: true });
  for (let i = 0; i < 5; i++) core.advance(2);
  core.input(neutral());
  frame = core.advance(2);
  assert.ok(spriteAt(frame.pixels, width, height)!.x > start.x, "moved right");

  // The counter button (Mega Drive C, Master System 2) is Cartivo's A.
  core.input({ ...neutral(), a: true });
  core.advance(3);
  core.input(neutral());
  frame = core.advance(3);
  assert.equal(core.save()[counterByte], 0x00, "$FF + one press");
  const even = rgb(frame.pixels, width, 0, 0);
  assert.notDeepEqual(even, odd, "the backdrop follows the counter");

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

  const save = core.save();
  core.dispose();
  const again = new GenesisPlusGxAdapter(system, rom, save);
  for (let i = 0; i < 20; i++) frame = again.advance(3);
  assert.deepEqual(rgb(frame.pixels, width, 0, 0), even, "RAM read back");
  const t = performance.now();
  for (let i = 0; i < 100; i++) again.advance(3);
  console.log(
    `Genesis Plus GX (${system}) WASM en Node: ${((performance.now() - t) / 300).toFixed(2)} ms/frame`,
  );
  return again;
}

test("Mega Drive: six-button pad, SRAM and B backdrop", async () => {
  const core = await playthrough("md", mdControlDemo(), 1);
  const at = spriteAt(core.advance(1).pixels, 320, 224)!;
  core.input({ ...neutral(), b: true });
  const red = rgb(core.advance(2).pixels, 320, 0, 0);
  assert.ok(red[0] > 200 && red[1] === 0 && red[2] === 0, `B red: ${red}`);
  // A, X, Y, Z (on Cartivo's Y, L, X, R) recolour the sprite.
  const shades = new Set<string>();
  for (const button of ["y", "l", "x", "r"] as const) {
    core.input({ ...neutral(), [button]: true });
    shades.add(rgb(core.advance(2).pixels, 320, at.x, at.y).join());
  }
  assert.equal(shades.size, 4, "four different colours");
  core.dispose();
});

test("Master System: button 1 recolours, cartridge RAM survives", async () => {
  const core = await playthrough("sms", smsControlDemo(), 0);
  const at = spriteAt(core.advance(1).pixels, 256, 192)!;
  const white = rgb(core.advance(1).pixels, 256, at.x, at.y);
  core.input({ ...neutral(), b: true });
  const yellow = rgb(core.advance(2).pixels, 256, at.x, at.y);
  assert.deepEqual(white, [255, 255, 255]);
  assert.deepEqual(yellow, [255, 255, 0]);
  core.dispose();
});
