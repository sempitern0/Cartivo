// PlayStation with PCSX-ReARMed and its HLE BIOS (ADR-015): the original
// PS-EXE fixture's oracle and the memory card, against the committed build.
// The program reaches the core through the VFS, like a disc.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  PS1_FRAME,
  PcsxRearmedAdapter,
  preparePcsx,
  providePcsxBinary,
} from "../packages/adapters/src/pcsx-rearmed.ts";
import { DiscImage } from "../packages/adapters/src/disc.ts";
import { ps1ControlDemo } from "../packages/fixtures/src/ps1-control-demo.ts";
import { neutral, type InputState } from "../packages/input/src/nes-input.ts";

providePcsxBinary(
  readFileSync(
    new URL("../cores/pcsx-rearmed/dist/pcsx-rearmed.wasm", import.meta.url),
  ),
);

const exe = ps1ControlDemo();
const part = { name: "demo.exe", blob: new Blob([exe as BlobPart]) };
const demoDisc = () =>
  new DiscImage([part], part, (_, start, end) => exe.slice(start, end));

test("the fixture is a stable PS-EXE", () => {
  assert.equal(
    createHash("sha256").update(exe).digest("hex"),
    "2ec37a8d0e7b68d644b5efc4e131bd7f3c413cdb1ca85640893be1aa89a617b3",
  );
  assert.equal(new TextDecoder().decode(exe.subarray(0, 8)), "PS-X EXE");
  assert.equal(exe.length % 2048, 0);
});

/** Colour at (x, y) of the 320×240 picture, as 0xRRGGBB. */
function pixel(frame: Uint8ClampedArray, x: number, y: number) {
  const { width, height } = PS1_FRAME;
  const at =
    (Math.floor((y * height) / 240) * width + Math.floor((x * width) / 320)) *
    4;
  return (frame[at] << 16) | (frame[at + 1] << 8) | frame[at + 2];
}

test("the HLE BIOS boots the program and the pad changes its colour", async () => {
  await preparePcsx();
  const core = new PcsxRearmedAdapter(demoDisc());
  const run = (input: Partial<InputState>) => {
    core.input({ ...neutral(), ...input });
    let frame = core.advance(3);
    for (let i = 0; i < 9; i++) frame = core.advance(3);
    return frame.pixels;
  };
  const idle = run({});
  // 15-bit colour widened by the core: 0x20 → 0x21, 0x60 → 0x63.
  assert.equal(pixel(idle, 160, 120), 0x212163);
  assert.equal(pixel(idle, 30, 30), 0xffffff);
  assert.equal(pixel(run({ b: true }), 160, 120), 0xff0000); // Cross
  assert.equal(pixel(run({ a: true }), 160, 120), 0x00ff00); // Circle
  assert.equal(pixel(run({ start: true }), 160, 120), 0xffff00);
  assert.ok(core.frameRate! > 59 && core.frameRate! < 61);
  core.dispose();
});

test("memory card 1 is the battery save and survives a new core", async () => {
  await preparePcsx();
  const core = new PcsxRearmedAdapter(demoDisc());
  assert.equal(core.saveBytes, 128 * 1024);
  assert.ok(core.battery);
  const card = core.save();
  card.set([0x4d, 0x43], 0); // "MC", a formatted card's first bytes
  core.dispose();
  const again = new PcsxRearmedAdapter(demoDisc(), card);
  assert.deepEqual(again.save().subarray(0, 2), Uint8Array.from([0x4d, 0x43]));
  again.dispose();
});
