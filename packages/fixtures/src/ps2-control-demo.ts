/** Original Cartivo fixture, PolyForm Noncommercial-1.0.0 (repository LICENSE).
 * A PlayStation 2 executable (ELF, MIPS R5900) assembled here, so PS2 is
 * tested without a commercial disc or Sony's BIOS: the core's HLE kernel
 * loads it, its GS draws the picture and its PADMAN fills a pad buffer.
 * Oracle: the 640×448 screen is one colour with a white 32×32 square at
 * (16, 16), redrawn once per frame:
 * - no button: dark blue (0x21, 0x21, 0x63);
 * - Cross: red; Circle: green; Start: yellow (checked in that order).
 * It makes no sound.
 */
import { mipsEmitter } from "./mips.ts";

const BASE = 0x00100000;
const DATA = BASE + 0x1000;
// Offsets in the data area.
const REGS = 0x000; // PMODE, DISPFB2, DISPLAY2 (64 bits each)
const PACKET = 0x100; // GIF packet: 13 quadwords
const COLOUR = PACKET + 16 * 7; // the screen's RGBAQ
const INIT = 0x200; // SIF command packets
const LOAD = 0x240;
const OPEN = 0x280;
const XFERS = 0x300; // SifSetDma transfers
const PAD = 0x400; // pad area (two 128-byte structs)
const REPLY = 0x600; // where the IOP answers
const LOAD_ARGS = 0x800;
const OPEN_ARGS = 0xa00;
const SIZE = 0xc00;

export const PS2_DEMO_COLORS = {
  idle: [0x21, 0x21, 0x63],
  cross: [255, 0, 0],
  circle: [0, 255, 0],
  start: [255, 255, 0],
} as const;

/** GS colour (RGBAQ's low word): alpha 0x80 is opaque. */
const rgba = ([r, g, b]: readonly number[]) =>
  (0x80000000 | (b << 16) | (g << 8) | r) >>> 0;

/** The data area: registers, the GIF packet and the SIF requests. */
function data(): Uint8Array {
  const bytes = new Uint8Array(SIZE);
  const view = new DataView(bytes.buffer);
  const words = (at: number, values: number[]) =>
    values.forEach((v, i) => view.setUint32(at + i * 4, v >>> 0, true));

  // Display: read circuit 2 shows a 640×448 PSMCT32 buffer at page 0.
  words(REGS, [0xff62, 0]); // PMODE: EN2
  words(REGS + 8, [10 << 9, 0]); // DISPFB2: FBW 10 (640 pixels)
  words(REGS + 16, [636 | (50 << 12) | (3 << 23), 2559 | (447 << 12)]); // DISPLAY2

  // GIF: one packet of 12 register writes (A+D), end of packet.
  const xy = (x: number, y: number) => [(x << 4) | (y << 20), 0];
  const writes: [number, number[]][] = [
    [0x4c, [10 << 16, 0]], // FRAME_1: buffer at page 0, 640 wide, PSMCT32
    [0x4e, [0, 1]], // ZBUF_1: depth writes masked
    [0x18, [0, 0]], // XYOFFSET_1
    [0x40, [639 << 16, 447 << 16]], // SCISSOR_1: the whole screen
    [0x47, [0x30000, 0]], // TEST_1: depth test always passes
    [0x00, [6, 0]], // PRIM: sprite
    [0x01, [rgba(PS2_DEMO_COLORS.idle), 0x3f800000]], // RGBAQ (patched)
    [0x05, xy(0, 0)],
    [0x05, xy(640, 448)],
    [0x01, [0x80ffffff, 0x3f800000]], // white square
    [0x05, xy(16, 16)],
    [0x05, xy(48, 48)],
  ];
  words(PACKET, [writes.length | 0x8000, 0x10000000, 0x0e, 0]);
  writes.forEach(([register, value], i) =>
    words(PACKET + 16 * (i + 1), [...value, register, 0]),
  );

  // Pad area in PADMAN's «EX» layout, which it recognises by these marks;
  // the buttons of port 0 land in the second struct, all released (1s).
  bytes[PAD] = 0xff;
  bytes.fill(0xff, PAD + 0x80, PAD + 0x84);

  // SIF: tell the IOP where to answer, load PADMAN and open port 0. Each
  // RPC is its arguments followed by a call packet for the server.
  const call = (at: number, server: number, fn: number, size: number) =>
    words(at, [
      0x38, // header: packet size
      0,
      0x8000000a, // SIF_CMD_CALL
      0,
      ...[0, 0, 0, 0], // record, packet, rpc id, client
      fn,
      size,
      DATA + REPLY,
      0x40,
      0,
      server ^ 0xacacacac,
    ]);
  words(INIT, [0x14, 0, 0x80000002, 0, DATA + REPLY]); // SIF_CMD_INIT
  call(LOAD, 0x80000006, 0, 512); // LOADFILE: LoadModule
  bytes.set(new TextEncoder().encode("rom0:PADMAN"), LOAD_ARGS + 8);
  call(OPEN, 0x80000100, 1, 0x80); // PADMAN
  words(OPEN_ARGS, [0x80000100, 0, 0, 0, DATA + PAD]); // open port 0, slot 0
  const ARGS = 0xdeadbef0; // «these are the next call's arguments»
  // The command buffer address (0 here) is filled in by the program.
  words(XFERS, [DATA + INIT, 0, 0x14, 0]);
  words(XFERS + 0x10, [DATA + LOAD_ARGS, ARGS, 512, 0]);
  words(XFERS + 0x20, [DATA + LOAD, 0, 0x38, 0]);
  words(XFERS + 0x30, [DATA + OPEN_ARGS, ARGS, 0x80, 0]);
  words(XFERS + 0x40, [DATA + OPEN, 0, 0x38, 0]);
  return bytes;
}

function program(): number[] {
  const m = mipsEmitter(BASE);
  const [V0, V1, A0, A1, A2] = [2, 3, 4, 5, 6];
  const [T0, T1, T2, T3, T5, T6, T7, S0] = [8, 9, 10, 11, 13, 14, 15, 16];
  const syscall = (number: number) => {
    m.ori(V1, 0, number);
    m.syscall();
  };
  /** Waits for the next vertical blank (GS CSR, VSINT). */
  const vsync = (name: string) => {
    m.li(T1, 0x12001000);
    m.ori(T2, 0, 8);
    m.sw(T2, T1, 0); // acknowledge the previous one
    m.label(name);
    m.lw(T2, T1, 0);
    m.andi(T2, T2, 8);
    m.beq(T2, 0, name);
  };

  // Video: NTSC interlaced, field mode (SetGsCrt), then the display.
  m.ori(A0, 0, 1);
  m.ori(A1, 0, 2);
  m.ori(A2, 0, 0);
  syscall(0x02);
  m.li(T0, DATA);
  m.lui(T1, 0x1200); // GS privileged registers
  for (const [from, to] of [
    [REGS, 0x00],
    [REGS + 8, 0x90],
    [REGS + 16, 0xa0],
  ]) {
    m.ld(T2, T0, from);
    m.sd(T2, T1, to);
  }

  // Pad: the IOP's command buffer (SifGetReg 2) receives every packet.
  m.ori(A0, 0, 2);
  syscall(0x7a);
  m.li(T0, DATA);
  for (const xfer of [0x00, 0x20, 0x40]) m.sw(V0, T0, XFERS + xfer + 4);
  const send = (xfers: number, count: number) => {
    m.li(A0, DATA + xfers);
    m.ori(A1, 0, count);
    syscall(0x77); // SifSetDma
  };
  send(XFERS, 1);
  send(XFERS + 0x10, 2);
  // PADMAN starts on the IOP's own time: give it a few frames.
  m.ori(S0, 0, 8);
  m.label("starting");
  vsync("starting-vsync");
  m.addiu(S0, S0, -1);
  m.bne(S0, 0, "starting");
  send(XFERS + 0x30, 2);

  // Each frame: the colour for the buttons held, then draw (GIF, DMA 2).
  m.label("frame");
  vsync("frame-vsync");
  m.li(T0, DATA);
  m.lbu(T5, T0, PAD + 0x82); // Select L3 R3 Start Up Right Down Left
  m.lbu(T6, T0, PAD + 0x83); // L2 R2 L1 R1 Triangle Circle Cross Square
  m.li(T3, rgba(PS2_DEMO_COLORS.idle));
  m.andi(T7, T6, 0x40); // Cross (active low)
  m.beq(T7, 0, "cross");
  m.andi(T7, T6, 0x20); // Circle
  m.beq(T7, 0, "circle");
  m.andi(T7, T5, 0x08); // Start
  m.beq(T7, 0, "start");
  m.j("draw");
  for (const button of ["cross", "circle", "start"] as const) {
    m.label(button);
    m.li(T3, rgba(PS2_DEMO_COLORS[button]));
    m.j("draw");
  }
  m.label("draw");
  m.sw(T3, T0, COLOUR);
  m.li(T1, 0x1000a000); // D2: GIF channel
  m.li(T2, DATA + PACKET);
  m.sw(T2, T1, 0x10); // MADR
  m.ori(T2, 0, 13);
  m.sw(T2, T1, 0x20); // QWC
  m.ori(T2, 0, 0x101);
  m.sw(T2, T1, 0x00); // CHCR: from memory, start
  m.j("frame");
  return m.link();
}

/** `ps2-control-demo.elf`: code at 1 MiB, its data 4 KiB above. */
export function ps2ControlDemo(): Uint8Array {
  const code = program();
  if (code.length * 4 > DATA - BASE) throw Error("Programa demasiado grande");
  const image = new Uint8Array(DATA - BASE + SIZE);
  code.forEach((word, i) =>
    new DataView(image.buffer).setUint32(i * 4, word, true),
  );
  image.set(data(), DATA - BASE);

  // ELF32, little-endian, MIPS executable with one loadable segment.
  const OFFSET = 0x100;
  const elf = new Uint8Array(OFFSET + image.length);
  const view = new DataView(elf.buffer);
  elf.set([0x7f, 0x45, 0x4c, 0x46, 1, 1, 1]); // magic, 32-bit, LE, version
  view.setUint16(16, 2, true); // executable
  view.setUint16(18, 8, true); // MIPS
  view.setUint32(20, 1, true);
  view.setUint32(24, BASE, true); // entry
  view.setUint32(28, 52, true); // program headers right after this one
  view.setUint16(40, 52, true);
  view.setUint16(42, 32, true);
  view.setUint16(44, 1, true); // one program header
  view.setUint16(46, 40, true);
  view.setUint32(52, 1, true); // PT_LOAD
  view.setUint32(56, OFFSET, true);
  view.setUint32(60, BASE, true);
  view.setUint32(64, BASE, true);
  view.setUint32(68, image.length, true);
  view.setUint32(72, image.length, true);
  view.setUint32(76, 7, true); // read, write, execute
  view.setUint32(80, 16, true);
  elf.set(image, OFFSET);
  return elf;
}

const SECTOR = 2048;
/** The disc's executable: a European product code, so the game is PAL. */
export const PS2_DISC_BOOT = "SLES_000.00";

/**
 * `ps2-disc-demo.iso`: the same program on a minimal ISO 9660 disc image,
 * booted like a game (SYSTEM.CNF names the executable), to test the path a
 * real disc takes: the image is mounted and read on demand.
 */
export function ps2DiscDemo(): Uint8Array {
  const text = new TextEncoder();
  const files = [
    {
      name: "SYSTEM.CNF;1",
      bytes: text.encode(
        `BOOT2 = cdrom0:\\${PS2_DISC_BOOT};1\r\nVER = 1.00\r\nVMODE = PAL\r\n`,
      ),
    },
    { name: `${PS2_DISC_BOOT};1`, bytes: ps2ControlDemo() },
  ];
  // Layout: descriptors at 16–17, path tables at 18–19, root at 20, files.
  const ROOT = 20;
  let next = ROOT + 1;
  const placed = files.map((file) => {
    const lba = next;
    next += Math.ceil(file.bytes.length / SECTOR);
    return { ...file, lba };
  });
  const iso = new Uint8Array(next * SECTOR);
  const view = new DataView(iso.buffer);
  /** A number in both byte orders, as ISO 9660 stores them. */
  const both32 = (at: number, value: number) => {
    view.setUint32(at, value, true);
    view.setUint32(at + 4, value, false);
  };
  const both16 = (at: number, value: number) => {
    view.setUint16(at, value, true);
    view.setUint16(at + 2, value, false);
  };
  /** A directory record; returns the offset after it. */
  const record = (
    at: number,
    name: Uint8Array,
    lba: number,
    size: number,
    directory: boolean,
  ) => {
    const length = 33 + name.length + ((name.length + 1) % 2);
    iso[at] = length;
    both32(at + 2, lba);
    both32(at + 10, size);
    iso[at + 25] = directory ? 2 : 0;
    both16(at + 28, 1);
    iso[at + 32] = name.length;
    iso.set(name, at + 33);
    return at + length;
  };

  // Primary volume descriptor and the set terminator.
  const pvd = 16 * SECTOR;
  iso.set([1, ...text.encode("CD001"), 1], pvd);
  iso.fill(0x20, pvd + 8, pvd + 72); // system and volume identifiers
  iso.set(text.encode("CARTIVO_PS2_DEMO"), pvd + 40);
  both32(pvd + 80, next); // volume size in sectors
  both16(pvd + 120, 1);
  both16(pvd + 124, 1);
  both16(pvd + 128, SECTOR);
  both32(pvd + 132, 10); // path table size
  view.setUint32(pvd + 140, 18, true); // little-endian path table
  view.setUint32(pvd + 148, 19, false); // big-endian path table
  record(pvd + 156, Uint8Array.of(0), ROOT, SECTOR, true);
  iso[pvd + 881] = 1; // file structure version
  iso.set([255, ...text.encode("CD001"), 1], 17 * SECTOR);

  // Path tables: only the root directory.
  for (const [sector, littleEndian] of [
    [18, true],
    [19, false],
  ] as const) {
    const at = sector * SECTOR;
    iso[at] = 1; // name length
    view.setUint32(at + 2, ROOT, littleEndian);
    view.setUint16(at + 6, 1, littleEndian);
  }

  // Root directory: itself, its parent (itself) and the files.
  let at = ROOT * SECTOR;
  at = record(at, Uint8Array.of(0), ROOT, SECTOR, true);
  at = record(at, Uint8Array.of(1), ROOT, SECTOR, true);
  for (const { name, bytes, lba } of placed) {
    at = record(at, text.encode(name), lba, bytes.length, false);
    iso.set(bytes, lba * SECTOR);
  }
  return iso;
}
