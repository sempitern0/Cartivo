// PlayStation 2 in the app (ADR-022): what runs without a browser. The core
// itself needs threads and WebGL2 and is covered by tests/e2e/ps2.spec.ts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { isZip } from "../packages/adapters/src/ps2.ts";
import { findCoreModule } from "../packages/adapters/src/registry.ts";
import { mipsEmitter } from "../packages/fixtures/src/mips.ts";
import {
  PS2_DEMO_COLORS,
  PS2_DISC_BOOT,
  ps2ControlDemo,
  ps2DiscDemo,
} from "../packages/fixtures/src/ps2-control-demo.ts";
import { system } from "../packages/runtime/src/systems.ts";

const sha256 = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");

test("PS2 is a disc system that draws on the canvas and runs threads", () => {
  const ps2 = system("ps2")!;
  assert.equal(ps2.disc, true);
  assert.equal(ps2.surface, "webgl2");
  assert.equal(ps2.threads, true);
  assert.equal(ps2.experimental, true);
  const module = findCoreModule("ps2", ps2.defaultCore)!;
  assert.equal(module.disc, true);
  assert.equal(module.surface, "webgl2");
  assert.equal(module.version, ps2.cores[0].version);
  assert.deepEqual(module.video, { width: 640, height: 448 });
  assert.equal(module.demo!().name, "cartivo-demo.elf");
  // No other system needs threads, so none depends on isolation.
  for (const other of ["nes", "gba", "ps1", "n64"])
    assert.equal(system(other)!.threads, undefined, other);
});

test("the PS2 demo is a MIPS executable, the same on every build", () => {
  const elf = ps2ControlDemo();
  const view = new DataView(elf.buffer);
  assert.deepEqual([...elf.subarray(0, 7)], [0x7f, 0x45, 0x4c, 0x46, 1, 1, 1]);
  assert.equal(view.getUint16(16, true), 2, "executable");
  assert.equal(view.getUint16(18, true), 8, "MIPS");
  assert.equal(view.getUint32(24, true), 0x100000, "entry");
  assert.equal(view.getUint16(44, true), 1, "one segment");
  // The segment is the rest of the file, loaded at the entry point.
  assert.equal(view.getUint32(60, true), 0x100000);
  assert.equal(view.getUint32(56, true) + view.getUint32(68, true), elf.length);
  assert.equal(sha256(elf), sha256(ps2ControlDemo()));
  for (const colour of Object.values(PS2_DEMO_COLORS))
    assert.equal(colour.length, 3);
});

test("the PS2 disc demo is an ISO 9660 image that names its executable", () => {
  const iso = ps2DiscDemo();
  const text = (at: number, length: number) =>
    new TextDecoder().decode(iso.subarray(at, at + length));
  assert.equal(iso.length % 2048, 0);
  // Primary volume descriptor at sector 16.
  assert.equal(iso[16 * 2048], 1);
  assert.equal(text(16 * 2048 + 1, 5), "CD001");
  const whole = new TextDecoder("latin1").decode(iso);
  assert.ok(whole.includes("SYSTEM.CNF;1"));
  assert.ok(whole.includes(`BOOT2 = cdrom0:\\${PS2_DISC_BOOT};1`));
  // The executable is on the disc, byte for byte.
  const elf = ps2ControlDemo();
  const at = whole.indexOf("\x7fELF");
  assert.deepEqual(iso.subarray(at, at + elf.length), elf);
});

test("a Partida that is not a zip never reaches the core", () => {
  const eocd = [0x50, 0x4b, 5, 6, ...new Array<number>(18).fill(0)];
  const zip = new Uint8Array([
    0x50,
    0x4b,
    3,
    4,
    ...new Array(30).fill(0),
    ...eocd,
  ]);
  assert.equal(isZip(zip), true);
  // With a trailing comment, as the format allows.
  assert.equal(isZip(new Uint8Array([...zip, 1, 2, 3])), true);
  assert.equal(isZip(new Uint8Array(0)), false);
  assert.equal(isZip(new Uint8Array([1, 2, 3])), false);
  assert.equal(isZip(zip.subarray(0, 30)), false, "no directory");
  assert.equal(isZip(zip.subarray(4)), false, "no first header");
});

test("the MIPS emitter resolves branches and jumps, and names what is missing", () => {
  const m = mipsEmitter(0x1000);
  m.label("top");
  m.li(8, 0x12345678); // lui + ori
  m.beq(8, 0, "top"); // back 3 instructions, plus its delay slot
  m.j("top");
  assert.deepEqual(
    m.link().map((w) => w.toString(16).padStart(8, "0")),
    ["3c081234", "35085678", "1100fffd", "00000000", "08000400", "00000000"],
  );
  const broken = mipsEmitter(0);
  broken.j("nowhere");
  assert.throws(() => broken.link(), /nowhere/);
});
