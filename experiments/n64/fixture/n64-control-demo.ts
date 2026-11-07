/** Original Cartivo fixture, PolyForm Noncommercial-1.0.0 (repository LICENSE).
 * A 1 MiB Nintendo 64 test cartridge (big-endian .z64) with no Nintendo
 * code: the emulator's HLE PIF copies ROM 0x40–0xFFF to the RSP's DMEM and
 * jumps there, so this program runs from DMEM instead of an IPL3. It sets up
 * the VI for 320×240 RGBA5551, draws with RDP fill rectangles (so the GPU
 * renderer presents it) and reads controller 1 through the PIF.
 * Oracle (whole screen, white 32×32 square at 16,16):
 * - no button: dark blue; A: red; B: green; Start: yellow (that order).
 */

const BOOT = 0xa4000040; // DMEM, uncached
const FRAMEBUFFER = 0x00100000;
const DISPLAY_LIST = 0x00200000;
const PIF_BLOCK = 0x00300000;
const SIZE = 1024 * 1024;

/** RGBA5551 from 8-bit channels, duplicated for the 32-bit fill colour. */
function fill(r: number, g: number, b: number) {
  const c = ((r >> 3) << 11) | ((g >> 3) << 6) | ((b >> 3) << 1) | 1;
  return ((c << 16) | c) >>> 0;
}
export const N64_DEMO_COLORS = {
  idle: fill(0x20, 0x20, 0x60),
  a: fill(0xff, 0, 0),
  b: fill(0, 0xff, 0),
  start: fill(0xff, 0xff, 0),
  white: fill(0xff, 0xff, 0xff),
};

export function n64ControlDemo(): Uint8Array {
  const code: number[] = [];
  const labels = new Map<string, number>();
  const fixups: { at: number; label: string }[] = [];
  const emit = (word: number) => code.push(word >>> 0);
  const label = (name: string) => labels.set(name, code.length);
  const I = (op: number, rs: number, rt: number, imm: number) =>
    emit((op << 26) | (rs << 21) | (rt << 16) | (imm & 0xffff));
  const lui = (rt: number, imm: number) => I(0x0f, 0, rt, imm);
  const ori = (rt: number, rs: number, imm: number) => I(0x0d, rs, rt, imm);
  const andi = (rt: number, rs: number, imm: number) => I(0x0c, rs, rt, imm);
  const addiu = (rt: number, rs: number, imm: number) => I(0x09, rs, rt, imm);
  const sw = (rt: number, base: number, off: number) => I(0x2b, base, rt, off);
  const lw = (rt: number, base: number, off: number) => I(0x23, base, rt, off);
  const lbu = (rt: number, base: number, off: number) => I(0x24, base, rt, off);
  const nop = () => emit(0);
  const li = (rt: number, value: number) => {
    lui(rt, value >>> 16);
    ori(rt, rt, value & 0xffff);
  };
  /** beq/bne to a label, with the delay slot filled by a nop. */
  const branch = (op: number, rs: number, rt: number, name: string) => {
    fixups.push({ at: code.length, label: name });
    I(op, rs, rt, 0);
    nop();
  };
  const beq = (rs: number, rt: number, name: string) =>
    branch(0x04, rs, rt, name);
  const bne = (rs: number, rt: number, name: string) =>
    branch(0x05, rs, rt, name);
  const store = (base: number, offset: number, value: number) => {
    li(9, value); // t1
    sw(9, base, offset);
  };

  // t0 (8): VI registers. NTSC 320×240, 16-bit, from the VI's documented
  // reset values for this mode.
  li(8, 0xa4400000);
  const vi = [
    0x00003202,
    FRAMEBUFFER,
    320,
    2,
    0,
    0x03e52239,
    0x0000020d,
    0x00000c15,
    0x0c150c15,
    0x006c02ec,
    0x002501ff,
    0x000e0204,
    0x00000200,
    0x00000400,
  ];
  vi.forEach((value, i) => store(8, i * 4, value));

  // The PIF request for controller 1: read buttons and stick (command 1).
  li(10, 0xa0000000 | PIF_BLOCK); // t2
  store(10, 0, 0xff010401);
  store(10, 4, 0xffffffff);
  store(10, 8, 0xfe000000);
  store(10, 60, 0x00000001); // "process" flag in the last byte

  label("frame");
  // Controller: RDRAM → PIF (runs the request), then PIF → RDRAM.
  li(11, 0xa4800000); // t3: SI
  li(9, PIF_BLOCK);
  sw(9, 11, 0); // SI_DRAM_ADDR
  li(9, 0x1fc007c0);
  sw(9, 11, 0x10); // SI_PIF_ADDR_WR64B
  label("si1");
  lw(12, 11, 0x18); // SI_STATUS
  andi(12, 12, 3);
  bne(12, 0, "si1");
  li(9, PIF_BLOCK);
  sw(9, 11, 0);
  li(9, 0x1fc007c0);
  sw(9, 11, 0x04); // SI_PIF_ADDR_RD64B
  label("si2");
  lw(12, 11, 0x18);
  andi(12, 12, 3);
  bne(12, 0, "si2");
  lbu(13, 10, 4); // t5: A B Z Start Up Down Left Right
  // Reset the request bytes the PIF overwrote for the next frame.
  store(10, 0, 0xff010401);
  store(10, 4, 0xffffffff);
  store(10, 60, 0x00000001);

  li(14, N64_DEMO_COLORS.idle); // t6: fill colour
  andi(15, 13, 0x80);
  beq(15, 0, "notA");
  li(14, N64_DEMO_COLORS.a);
  branch(0x04, 0, 0, "draw");
  label("notA");
  andi(15, 13, 0x40);
  beq(15, 0, "notB");
  li(14, N64_DEMO_COLORS.b);
  branch(0x04, 0, 0, "draw");
  label("notB");
  andi(15, 13, 0x10);
  beq(15, 0, "draw");
  li(14, N64_DEMO_COLORS.start);

  label("draw");
  // RDP display list in RDRAM: fill mode, colour image, scissor, the
  // screen in t6, then the white square, then a full sync.
  li(16, 0xa0000000 | DISPLAY_LIST); // s0
  const words: (number | "color")[] = [
    0xef300000,
    0, // set other modes: fill cycle
    0xff10013f,
    FRAMEBUFFER, // colour image: RGBA 16-bit, width 320
    0xed000000,
    0x005003c0, // scissor 0,0 – 320,240
    0xf7000000,
    "color",
    0xf64fc3bc,
    0, // fill rectangle 0,0 – 319,239
    0xf7000000,
    N64_DEMO_COLORS.white,
    0xf60bc0bc,
    0x00040040, // fill rectangle 16,16 – 47,47
    0xe9000000,
    0, // sync full
  ];
  words.forEach((word, i) => {
    if (word === "color") sw(14, 16, i * 4);
    else store(16, i * 4, word);
  });
  li(17, 0xa4100000); // s1: DPC
  store(17, 0x0c, 0x00000001); // DPC_STATUS: clear XBUS (RDRAM source)
  store(17, 0x00, DISPLAY_LIST); // DPC_START
  store(17, 0x04, DISPLAY_LIST + words.length * 4); // DPC_END → run

  // Wait about a frame before drawing again.
  li(18, 400000); // s2
  label("wait");
  addiu(18, 18, -1);
  bne(18, 0, "wait");
  branch(0x04, 0, 0, "frame");

  for (const { at, label: name } of fixups) {
    const offset = labels.get(name)! - (at + 1);
    code[at] = ((code[at] & 0xffff0000) | (offset & 0xffff)) >>> 0;
  }
  if (code.length * 4 > 0xfc0) throw Error("Demo boot code is too large");

  const rom = new Uint8Array(SIZE);
  const view = new DataView(rom.buffer);
  view.setUint32(0x00, 0x80371240); // PI settings (big-endian .z64)
  view.setUint32(0x04, 0x0000000f); // clock rate
  view.setUint32(0x08, BOOT); // entry point (unused: no IPL3)
  rom.set(new TextEncoder().encode("CARTIVO DEMO".padEnd(20, " ")), 0x20);
  rom.set(new TextEncoder().encode("NCDE"), 0x3b); // homebrew id, NTSC
  code.forEach((word, i) => view.setUint32(0x40 + i * 4, word));
  return rom;
}
