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
import {
  ps1DiscChd,
  ps1DiscDemo,
  ps1TwoDiscDemo,
} from "../packages/fixtures/src/ps1-disc-demo.ts";
import { prepareDisc } from "../packages/runtime/src/prepare-rom.ts";
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

test("a CD image boots from its .cue with the track, or from the .bin alone", async () => {
  await preparePcsx();
  const { cue, bin } = ps1DiscDemo();
  // 24 raw MODE2/2352 sectors: ISO 9660 volume, SYSTEM.CNF and PSX.EXE.
  assert.equal(
    createHash("sha256").update(bin).digest("hex"),
    "70b0fe391f54d20a418368dbc2c59c10844af7a90d0e0b008a6042f19ae13ebc",
  );
  const sheet = new File([cue], "Cartivo Demo.cue");
  const track = new File([bin as BlobPart], "Cartivo Demo (Track 1).bin");
  const bytes = new Map<Blob, Uint8Array>([
    [sheet, new TextEncoder().encode(cue)],
    [track, bin],
  ]);
  const read = (blob: Blob, start: number, end: number) =>
    bytes.get(blob)!.slice(start, end);
  const module = { prepare: preparePcsx };
  for (const [file, extra] of [
    [sheet, [track]],
    [track, []],
  ] as const) {
    const { disc } = await prepareDisc(module, file, extra, read);
    const core = new PcsxRearmedAdapter(disc);
    core.input({ ...neutral(), b: true });
    let frame = core.advance(3);
    for (let i = 0; i < 39; i++) frame = core.advance(3);
    assert.equal(pixel(frame.pixels, 160, 120), 0xff0000, file.name);
    core.dispose();
  }
});

const files = (list: { name: string; bytes: Uint8Array }[]) =>
  list.map(({ name, bytes }) => new File([bytes as BlobPart], name));

/** Runs a second of the program and returns the colour at the centre. */
function idleColour(core: PcsxRearmedAdapter) {
  core.input(neutral());
  let frame = core.advance(3);
  for (let i = 0; i < 19; i++) frame = core.advance(3);
  return pixel(frame.pixels, 160, 120);
}

test("an .m3u game boots disc 1, swaps to disc 2 and a new core boots it", async () => {
  await preparePcsx();
  const [m3u, ...rest] = files(ps1TwoDiscDemo());
  // Node has no FileReaderSync: the fixture's bytes are read from memory.
  const bytes = new Map(ps1TwoDiscDemo().map((f) => [f.name, f.bytes]));
  const read = (blob: Blob, start: number, end: number) =>
    (bytes.get((blob as File).name) ?? new Uint8Array(0)).slice(start, end);
  const { disc } = await prepareDisc(
    { prepare: async () => {} },
    m3u,
    rest,
    read,
  );
  const core = new PcsxRearmedAdapter(disc);
  assert.deepEqual(core.discs!.names, [
    "Cartivo Demo (Disc 1).cue",
    "Cartivo Demo (Disc 2).cue",
  ]);
  assert.equal(idleColour(core), 0x212163); // disc 1: dark blue
  core.discs!.insert(1);
  assert.equal(core.discs!.current(), 1);
  assert.throws(() => core.discs!.insert(5), /disco 6/);
  core.dispose();
  // A reset makes a new core with the disc in the tray: disc 2, dark green.
  const again = new PcsxRearmedAdapter(disc.withFirst(1));
  assert.equal(again.discs!.current(), 1);
  assert.equal(idleColour(again), 0x216321);
  again.dispose();
});

test("a CHD image boots like its .cue", async () => {
  await preparePcsx();
  const chd = ps1DiscChd();
  const part = { name: "Cartivo Demo.chd", blob: new Blob([chd as BlobPart]) };
  const core = new PcsxRearmedAdapter(
    new DiscImage([part], part, (_, start, end) => chd.slice(start, end)),
  );
  assert.equal(idleColour(core), 0x212163);
  core.dispose();
});
