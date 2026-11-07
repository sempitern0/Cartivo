import { test } from "node:test";
import assert from "node:assert/strict";
import {
  analogStick,
  inspectRomHeader,
  MAX_N64_ROM_BYTES,
  samplePad,
} from "../experiments/n64/preflight.ts";
import { isProbeResult } from "../experiments/n64/protocol.ts";

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
test("N64 radial stick retains intensity and diagonal direction", () => {
  assert.deepEqual(analogStick(0.05, -0.05), { x: 0, y: 0 });
  assert.deepEqual(analogStick(0, 0, 0), { x: 0, y: 0 });
  assert.deepEqual(analogStick(NaN, Infinity), { x: 0, y: 0 });
  assert.deepEqual(analogStick(9, 0), { x: 1, y: 0 });
  const half = analogStick(0.59, 0);
  assert.ok(Math.abs(half.x - 0.5) < 1e-9);
  const diagonal = analogStick(1, -1);
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.y) - 1) < 1e-9);
  assert.equal(diagonal.x, -diagonal.y);
  for (const deadzone of [-1, 1, NaN])
    assert.throws(() => analogStick(0, 0, deadzone));
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

test("the original N64 demo cartridge has no Nintendo code and a stable hash", async () => {
  const { createHash } = await import("node:crypto");
  const { n64ControlDemo, N64_DEMO_COLORS } =
    await import("../experiments/n64/fixture/n64-control-demo.ts");
  const rom = n64ControlDemo();
  assert.equal(rom.length, 1024 * 1024);
  assert.deepEqual(inspectRomHeader(rom.subarray(0, 64), rom.length), {
    byteOrder: "z64",
    title: "CARTIVO DEMO",
    bytes: rom.length,
  });
  // Our boot program fills DMEM 0x40–0xFFF; the rest of the cartridge is empty.
  assert.ok(rom.subarray(0x1000).every((b) => b === 0));
  assert.equal(
    createHash("sha256").update(rom).digest("hex"),
    "c3b9084c6174e1a01684ca4d3314d8633802bde667660f3b75cc3ddf80a43f2d",
  );
  // RGBA5551 pairs, as the RDP fill colour expects.
  for (const color of Object.values(N64_DEMO_COLORS))
    assert.equal(color >>> 16, color & 0xffff);
});
