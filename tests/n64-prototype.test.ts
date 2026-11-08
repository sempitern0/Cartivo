import { test } from "node:test";
import assert from "node:assert/strict";
import {
  inspectRomHeader,
  MAX_N64_ROM_BYTES,
  samplePad,
} from "../experiments/n64/preflight.ts";
import { isProbeResult } from "../experiments/n64/protocol.ts";
import { createHash } from "node:crypto";
import {
  N64_DEMO_COLORS,
  N64_DEMO_TONE,
  n64ControlDemo,
} from "../packages/fixtures/src/n64-control-demo.ts";

function header(order: "z64" | "v64" | "n64") {
  const normal = new Uint8Array(64);
  normal.set([0x80, 0x37, 0x12, 0x40]);
  normal.set(new TextEncoder().encode("CARTIVO TEST"), 0x20);
  const xor = order === "v64" ? 1 : order === "n64" ? 3 : 0;
  return Uint8Array.from(normal, (_, index) => normal[index ^ xor]);
}
for (const order of ["z64", "v64", "n64"] as const) {
  test(`N64 probe recognises ${order} without mutating or reading the full ROM`, () => {
    const input = header(order);
    const copy = input.slice();
    assert.deepEqual(inspectRomHeader(input, MAX_N64_ROM_BYTES), {
      byteOrder: order,
      title: "CARTIVO TEST",
      bytes: MAX_N64_ROM_BYTES,
    });
    assert.deepEqual(input, copy);
  });
}
test("N64 probe rejects invalid size, truncation and unknown magic", () => {
  for (const size of [0, 4095, 4097, MAX_N64_ROM_BYTES + 4, Infinity, NaN])
    assert.throws(() => inspectRomHeader(header("z64"), size));
  assert.throws(() => inspectRomHeader(new Uint8Array(63), 4096));
  assert.throws(() => inspectRomHeader(new Uint8Array(64), 4096));
});
test("N64 diagnostic mapping clears disconnected or nonstandard controllers", () => {
  const pad = {
    connected: true,
    mapping: "standard" as GamepadMappingType,
    axes: [0.7, -0.3, 1, -1],
    buttons: Array.from({ length: 16 }, () => ({
      pressed: true,
      touched: true,
      value: 1,
    })),
  };
  const state = samplePad(pad);
  assert.ok(
    state.x > 0 &&
      state.y < 0 &&
      state.a &&
      state.b &&
      state.z &&
      state.cRight &&
      state.cUp,
  );
  assert.deepEqual(samplePad({ ...pad, connected: false }), samplePad(null));
  assert.deepEqual(samplePad({ ...pad, mapping: "" }), samplePad(null));
  assert.deepEqual(
    samplePad({ connected: true, mapping: "standard", axes: [], buttons: [] }),
    samplePad(null),
  );
});
test("N64 worker result rejects malformed or unversioned messages", () => {
  const good = {
    version: 1,
    ok: true,
    webgl2: true,
    webglReason: "ok",
    wasm: true,
    isolated: false,
    elapsedMs: 1,
    headerReadBytes: 0,
  };
  assert.ok(isProbeResult(good));
  assert.ok(isProbeResult({ version: 1, ok: false, error: "unavailable" }));
  assert.ok(
    isProbeResult({
      ...good,
      headerReadBytes: 64,
      rom: inspectRomHeader(header("z64"), 4096),
    }),
  );
  for (const bad of [
    null,
    {},
    { ...good, version: 2 },
    { ...good, elapsedMs: NaN },
    { ...good, webgl2: 1 },
    { ...good, headerReadBytes: 64 },
    { ...good, rom: {} },
    { version: 1, ok: false, error: 1 },
  ])
    assert.equal(isProbeResult(bad), false);
});

test("the N64 demo cartridge is original and has a stable hash", () => {
  const rom = n64ControlDemo();
  assert.equal(rom.length, 1024 * 1024);
  assert.deepEqual(inspectRomHeader(rom.subarray(0, 64), rom.length), {
    byteOrder: "z64",
    title: "CARTIVO DEMO",
    bytes: rom.length,
  });
  // Boot program in 0x40–0xFFF, then 4 KiB of square wave; nothing else.
  const wave = new DataView(rom.buffer, 0x1000, 0x1000);
  const levels = new Set<number>();
  for (let i = 0; i < 0x1000; i += 2) levels.add(wave.getInt16(i));
  assert.deepEqual(
    [...levels].sort((a, b) => a - b),
    [-8000, 8000],
  );
  assert.equal(wave.getInt16(0), wave.getInt16(2)); // left = right
  assert.ok(rom.subarray(0x2000).every((b) => b === 0));
  assert.equal(N64_DEMO_TONE, 500);
  assert.equal(
    createHash("sha256").update(rom).digest("hex"),
    "090c9451106597066ea9ef2ac700889b0f1eac81035e96c4971278c2e4b7e105",
  );
  // RGBA5551 pairs, as the RDP fill colour expects.
  for (const color of Object.values(N64_DEMO_COLORS))
    assert.equal(color >>> 16, color & 0xffff);
});
