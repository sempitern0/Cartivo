import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { NesAdapter, validateRom } from "../packages/adapters/src/jsnes.ts";
import { controlDemo } from "../packages/fixtures/src/control-demo.ts";
import { neutral } from "../packages/input/src/nes-input.ts";
import { parseRequest as parseNesRequest } from "../packages/runtime/src/protocol.ts";
test("real NES fixture renders, responds to input, produces audio and restores SRAM", () => {
  const rom = controlDemo();
  assert.equal(
    createHash("sha256").update(rom).digest("hex"),
    "5e4c943666130bd0dba705b585bd029fc19f939a6509fc956d2ae443b09afd71",
  );
  const core = new NesAdapter(rom);
  let frame = core.advance(3);
  for (let i = 0; i < 19; i++) frame = core.advance(3);
  assert.ok(new Set(new Uint32Array(frame.pixels.buffer)).size >= 3);
  const before = createHash("sha256").update(frame.pixels).digest("hex");
  core.input({ ...neutral(), a: true, b: true, right: true });
  let peak = 0;
  for (let i = 0; i < 10; i++) {
    frame = core.advance(2);
    for (const value of frame.audio) {
      assert.ok(Number.isFinite(value));
      peak = Math.max(peak, Math.abs(value));
    }
  }
  assert.notEqual(
    createHash("sha256").update(frame.pixels).digest("hex"),
    before,
  );
  assert.ok(peak > 0.01);
  assert.equal(core.save()[0], 1);
  core.input(neutral());
  core.advance(2);
  core.input({ ...neutral(), a: true });
  core.advance(2);
  assert.equal(core.save()[0], 2);
  const restored = new NesAdapter(rom, core.save());
  for (let i = 0; i < 20; i++) restored.advance(3);
  assert.equal(restored.save()[0], 2);
});
test("strict format gate rejects truncation, unsupported mapper, NES2 and trainer", () => {
  assert.equal(validateRom(controlDemo()).battery, true);
  assert.throws(() => validateRom(controlDemo().subarray(0, 20)));
  for (const [offset, value] of [
    [6, 0x52],
    [7, 8],
    [6, 6],
    [9, 1],
    [8, 2],
  ]) {
    const bytes = controlDemo();
    bytes[offset] = value;
    assert.throws(() => validateRom(bytes));
  }
  assert.throws(() => new NesAdapter(controlDemo(), new Uint8Array(4)));
});
test("worker protocol rejects malformed input and unbounded frame batches", () => {
  const r = {
    v: 1,
    session: "test",
    id: 1,
    command: "advance",
    count: 1,
    input: neutral(),
  };
  assert.equal(parseNesRequest(r), r);
  for (const bad of [
    { ...r, count: 4 },
    { ...r, input: { a: 1 } },
    { ...r, v: 2 },
    { ...r, id: -1 },
    { ...r, session: "" },
  ])
    assert.throws(() => parseNesRequest(bad));
});

test("larger cartridges on mappers 1–4 execute original fixture and restore SRAM", () => {
  const demo = controlDemo();
  for (const mapper of [1, 2, 3, 4]) {
    const prg = mapper === 3 ? 32768 : 65536;
    const chr = mapper === 3 ? 32768 : 8192;
    const rom = new Uint8Array(16 + prg + chr);
    rom.set(demo.subarray(0, 16));
    rom[4] = prg / 16384;
    rom[5] = chr / 8192;
    rom[6] = (mapper << 4) | 2;
    for (let bank = 0; bank < prg / 16384; bank++)
      rom.set(demo.subarray(16, 16 + 16384), 16 + bank * 16384);
    for (let c = 0; c < chr / 8192; c++)
      rom.set(demo.subarray(16 + 16384), 16 + prg + c * 8192);
    assert.equal(validateRom(rom).mapper, mapper);
    const core = new NesAdapter(rom);
    let frame = core.advance(3);
    for (let n = 0; n < 19; n++) frame = core.advance(3);
    assert.ok(
      new Set(new Uint32Array(frame.pixels.buffer)).size >= 3,
      `mapper ${mapper} renders`,
    );
    core.input({ ...neutral(), a: true });
    core.advance(3);
    assert.equal(core.save()[0], 1, `mapper ${mapper} writes SRAM`);
    const restored = new NesAdapter(rom, core.save());
    restored.advance(3);
    assert.equal(restored.save()[0], 1);
  }
});
