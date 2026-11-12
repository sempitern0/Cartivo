/** Original Cartivo fixture, PolyForm Noncommercial-1.0.0 (repository LICENSE).
 * A PlayStation executable (PS-EXE) assembled here (mips.ts), so PS1 is
 * tested without a commercial disc or Sony's BIOS: the core's own HLE BIOS
 * loads it, and its pad service (InitPad/StartPad) fills a buffer each frame.
 * Oracle: the 320×240 screen is one colour, with a white 32×32 square at
 * (16, 16), redrawn about twice per frame (a delay loop keeps the GPU idle):
 * - no button: dark blue (0x21, 0x21, 0x63 once widened from 15 bits), or
 *   the `idle` colour given (the second disc of the multi-disc fixture);
 * - Cross: red; Circle: green; Start: yellow (checked in that order).
 */

import { mipsEmitter } from "./mips.ts";

const BASE = 0x80010000;
const PAD = 0x80008000; // InitPad buffer: status, id, buttons (active low)

/** `idle`: GP0 fill colour with no button pressed (BGR, 0x00BBGGRR). */
export function ps1ControlDemo(idle = 0x602020): Uint8Array {
  // Registers used: t0-t7 (8-15), t1 also selects a BIOS function, s0 (16)
  // counts the delay, a0-a3 (4-7) for arguments, ra (31).
  const m = mipsEmitter(BASE);
  const { label, nop, ori, andi, sw, lbu, jalr, li, addiu, beq, bne, j } = m;
  /** BIOS call: table B0 (0xB0) or A0 (0xA0), function number in t1. */
  const bios = (table: 0xa0 | 0xb0, fn: number) => {
    li(8, table);
    ori(9, 0, fn);
    jalr(8);
    nop();
  };
  const GP0 = 0x1f801810,
    GP1 = 0x1f801814;

  // GPU: reset, display on, 320×240 NTSC 15-bit, drawing area the screen.
  li(10, 0x1f800000); // t2: I/O base (KUSEG mirror of 0x1F800000)
  const gpu = (port: number, commands: number[]) => {
    for (const command of commands) {
      li(11, command);
      sw(11, 10, port & 0xffff);
    }
  };
  gpu(
    GP1,
    [0x00000000, 0x03000000, 0x05000000, 0x06c60260, 0x07040010, 0x08000001],
  );
  gpu(GP0, [0xe1000400, 0xe3000000, 0xe403bd3f, 0xe5000000]);

  // Pad: InitPad(PAD, 34, PAD + 34, 34) then StartPad (BIOS B0:12h, 13h).
  li(4, PAD);
  ori(5, 0, 34);
  li(6, PAD + 34);
  ori(7, 0, 34);
  bios(0xb0, 0x12);
  bios(0xb0, 0x13);

  // Main loop: pick the colour from the pad, fill the whole screen.
  label("loop");
  li(12, PAD); // t4
  lbu(13, 12, 2); // t5: Select L3 R3 Start Up Right Down Left
  lbu(14, 12, 3); // t6: L2 R2 L1 R1 Triangle Circle Cross Square
  li(11, (0x02000000 | idle) >>> 0); // fill rectangle (GP0 colour is BGR)
  andi(15, 14, 0x40); // Cross (active low)
  beq(15, 0, "red");
  andi(15, 14, 0x20); // Circle
  beq(15, 0, "green");
  andi(15, 13, 0x08); // Start
  beq(15, 0, "yellow");
  j("fill");
  label("red");
  li(11, 0x020000ff);
  j("fill");
  label("green");
  li(11, 0x0200ff00);
  j("fill");
  label("yellow");
  li(11, 0x0200ffff);
  label("fill");
  sw(11, 10, GP0 & 0xffff);
  sw(0, 10, GP0 & 0xffff); // top-left 0,0
  li(11, (240 << 16) | 320);
  sw(11, 10, GP0 & 0xffff);
  gpu(GP0, [0x02ffffff, (16 << 16) | 16, (32 << 16) | 32]); // white square
  // About half a frame of idle CPU before the next fill.
  li(16, 100000); // s0
  label("wait");
  addiu(16, 16, -1);
  bne(16, 0, "wait");
  j("loop");

  const code = m.link();

  // PS-EXE: 2 KiB header, then the code padded to 2 KiB sectors.
  const size = Math.ceil((code.length * 4) / 2048) * 2048;
  const exe = new Uint8Array(2048 + size);
  const view = new DataView(exe.buffer);
  exe.set(new TextEncoder().encode("PS-X EXE"), 0);
  view.setUint32(0x10, BASE, true); // initial pc
  view.setUint32(0x18, BASE, true); // load address
  view.setUint32(0x1c, size, true);
  view.setUint32(0x30, 0x801ffff0, true); // stack
  code.forEach((word, i) => view.setUint32(2048 + i * 4, word, true));
  return exe;
}
