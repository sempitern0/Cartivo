/** Original Cartivo fixture, PolyForm Noncommercial-1.0.0 (repository LICENSE).
 * Tiny 68000 emitter and a 64 KiB Mega Drive program with battery SRAM
 * (odd bytes at $200001, declared in the header); no third-party ROM, TMSS
 * BIOS or art. Reads the six-button pad.
 * Oracle:
 * - the D-pad moves a white 8×8 sprite;
 * - C counts in SRAM; its parity picks the backdrop, blue (even) or green
 *   (odd), so a reopened game shows the stored value;
 * - holding B turns the backdrop red;
 * - A, X, Y and Z paint the sprite yellow, cyan, magenta and orange.
 */
export function mdControlDemo({ pal = false } = {}): Uint8Array {
  const rom = new Uint8Array(0x10000);
  const code: number[] = [];
  const base = 0x200;
  const labels = new Map<string, number>();
  const fixups: { pos: number; label: string; size: 8 | 16 }[] = [];
  const w = (...words: number[]) => {
    for (const v of words) code.push((v >> 8) & 255, v & 255);
  };
  const l = (v: number) => w(v >>> 16, v & 0xffff);
  const label = (name: string) => labels.set(name, base + code.length);
  /** Bcc.S (BRA 60, BNE 66, BEQ 67) to a label. */
  const branch = (cc: number, name: string) => {
    w(cc << 8);
    fixups.push({ pos: code.length - 1, label: name, size: 8 });
  };
  /** BRA.W / DBRA D7 to a label (16-bit displacement). */
  const branchWord = (op: number, name: string) => {
    w(op, 0);
    fixups.push({ pos: code.length - 2, label: name, size: 16 });
  };
  const VDP_DATA = 0xc00000,
    VDP_CTRL = 0xc00004;
  const moveL = (value: number, address: number) => {
    w(0x23fc);
    l(value);
    l(address);
  };
  const moveW = (value: number, address: number) => {
    w(0x33fc, value);
    l(address);
  };
  /** Writes a 9-bit colour at CRAM byte address `at`. */
  const color = (at: number, value: number) => {
    moveL(0xc0000000 | (at << 16), VDP_CTRL);
    moveW(value, VDP_DATA);
  };
  // RAM: $FF0000 x+128 (word), $FF0002 y+128 (word), $FF0004 C last frame.
  const X = 0xff0000,
    Y = 0xff0002,
    PREV = 0xff0004,
    SRAM = 0x200001;
  /** If bit `bit` of Dn is clear (pressed: pads are active low): `then`. */
  const ifPressed = (
    dn: number,
    bit: number,
    skip: string,
    then: () => void,
  ) => {
    w(0x0800 | dn, bit); // BTST #bit,Dn
    branch(0x66, skip); // BNE: released
    then();
  };

  label("start");
  w(0x46fc, 0x2700); // MOVE #$2700,SR: interrupts off
  // VDP: mode 5, H40, display off, planes at $C000/$E000, sprites at $F800.
  for (const reg of [
    0x8004, 0x8104, 0x8230, 0x8407, 0x857c, 0x8700, 0x8b00, 0x8c81, 0x8d3f,
    0x8f02, 0x9001, 0x9100, 0x9200,
  ])
    moveW(reg, VDP_CTRL);
  // Clear the 64 KiB of VRAM: tile 0 blank, empty planes.
  moveL(0x40000000, VDP_CTRL);
  w(0x7e00 | 0, 0x3e3c, 0x7fff); // MOVEQ #0,D7; MOVE.W #$7FFF,D7
  label("clear");
  moveW(0, VDP_DATA);
  branchWord(0x51cf, "clear"); // DBRA D7
  // Tile 1 ($0020): every pixel colour 1.
  moveL(0x40200000, VDP_CTRL);
  for (let i = 0; i < 8; i++) moveL(0x11111111, VDP_DATA);
  moveW(128 + 156, X);
  moveW(128 + 104, Y);
  w(0x4239);
  l(PREV); // CLR.B PREV
  w(0x41f9);
  l(0xa10003); // LEA $A10003,A0 (pad 1 data)
  w(0x117c, 0x0040, 0x0006); // MOVE.B #$40,6(A0): TH as output
  moveW(0x8144, VDP_CTRL); // display on

  label("main");
  label("leaveVblank");
  w(0x3039);
  l(VDP_CTRL); // MOVE.W VDP_CTRL,D0
  w(0x0800, 3); // BTST #3,D0 (vertical blank)
  branch(0x66, "leaveVblank");
  label("waitVblank");
  w(0x3039);
  l(VDP_CTRL);
  w(0x0800, 3);
  branch(0x67, "waitVblank");
  // Six-button read: TH high → C B R L D U; TH low → Start A;
  // after three more pulses, TH high → Mode X Y Z.
  const th = (value: number) => w(0x10bc, value, 0x4e71, 0x4e71); // MOVE.B #v,(A0); NOP; NOP
  th(0x40);
  w(0x1210); // MOVE.B (A0),D1
  th(0x00);
  w(0x1410); // MOVE.B (A0),D2
  th(0x40);
  th(0x00);
  th(0x40);
  th(0x00);
  th(0x40);
  w(0x1610); // MOVE.B (A0),D3

  ifPressed(1, 0, "noUp", () => (w(0x5379), l(Y))); // SUBQ.W #1,Y
  label("noUp");
  ifPressed(1, 1, "noDown", () => (w(0x5279), l(Y))); // ADDQ.W #1,Y
  label("noDown");
  ifPressed(1, 2, "noLeft", () => (w(0x5379), l(X)));
  label("noLeft");
  ifPressed(1, 3, "noRight", () => (w(0x5279), l(X)));
  label("noRight");

  // C: count each new press in SRAM (D4 = 1 when held).
  w(0x7800); // MOVEQ #0,D4
  ifPressed(1, 5, "noC", () => w(0x7801)); // MOVEQ #1,D4
  label("noC");
  w(0xb839);
  l(PREV); // CMP.B PREV,D4
  branch(0x67, "same");
  w(0x13c4);
  l(PREV); // MOVE.B D4,PREV
  w(0x4a04); // TST.B D4
  branch(0x67, "same");
  w(0x5239);
  l(SRAM); // ADDQ.B #1,SRAM
  label("same");

  // Backdrop (CRAM 0): red while B is held, else the counter's parity.
  ifPressed(1, 4, "notB", () => {
    color(0, 0x000e);
    branch(0x60, "backdropDone");
  });
  label("notB");
  w(0x1039);
  l(SRAM); // MOVE.B SRAM,D0
  w(0x0800, 0); // BTST #0,D0
  branch(0x67, "even");
  color(0, 0x00e0);
  branch(0x60, "backdropDone");
  label("even");
  color(0, 0x0e00);
  label("backdropDone");

  // Sprite colour (palette 0 colour 1, CRAM byte 2).
  const shades: [number, number, number][] = [
    [2, 4, 0x00ee], // A: yellow
    [3, 2, 0x0ee0], // X: cyan
    [3, 1, 0x0e0e], // Y: magenta
    [3, 0, 0x008e], // Z: orange
  ];
  shades.forEach(([dn, bit, shade], i) => {
    ifPressed(dn, bit, `shade${i}`, () => {
      color(2, shade);
      branchWord(0x6000, "shadeDone");
    });
    label(`shade${i}`);
  });
  color(2, 0x0eee);
  label("shadeDone");

  // Sprite 0 ($F800): y+128, size 8×8 and no link, tile 1, x+128.
  moveL(0x78000003, VDP_CTRL);
  w(0x33f9); // MOVE.W Y,VDP_DATA
  l(Y);
  l(VDP_DATA);
  moveW(0x0000, VDP_DATA);
  moveW(0x0001, VDP_DATA);
  w(0x33f9);
  l(X);
  l(VDP_DATA);
  branchWord(0x6000, "main");
  label("rte");
  w(0x4e73);

  for (const { pos, label: name, size } of fixups) {
    const target = labels.get(name)!;
    if (size === 8) {
      const offset = target - (base + pos + 1);
      if (offset < -128 || offset > 127 || offset === 0)
        throw Error(`Salto corto inválido: ${name}`);
      code[pos] = offset & 255;
    } else {
      const offset = target - (base + pos);
      code[pos] = (offset >> 8) & 255;
      code[pos + 1] = offset & 255;
    }
  }
  if (base + code.length > rom.length) throw Error("Programa demasiado grande");
  rom.set(code, base);

  const be32 = (at: number, v: number) =>
    rom.set([v >>> 24, (v >> 16) & 255, (v >> 8) & 255, v & 255], at);
  const text = (at: number, s: string, size: number) =>
    rom.set(new TextEncoder().encode(s.padEnd(size, " ")), at);
  // Vectors: stack at the top of RAM, reset to `start`, the rest to RTE.
  be32(0, 0x00fffe00);
  be32(4, labels.get("start")!);
  for (let v = 8; v < 0x100; v += 4) be32(v, labels.get("rte")!);
  // Header.
  text(0x100, "SEGA MEGA DRIVE", 16);
  text(0x110, "(C)CRTV 2026.NOV", 16);
  text(0x120, "CARTIVO CONTROL DEMO", 48);
  text(0x150, "CARTIVO CONTROL DEMO", 48);
  text(0x180, "GM 00000000-00", 14);
  text(0x190, "J6", 16); // three- and six-button pads
  be32(0x1a0, 0);
  be32(0x1a4, rom.length - 1);
  be32(0x1a8, 0xff0000);
  be32(0x1ac, 0xffffff);
  rom.set([0x52, 0x41, 0xf8, 0x20], 0x1b0); // "RA", battery, odd bytes
  be32(0x1b4, 0x200001);
  be32(0x1b8, 0x203fff);
  text(0x1bc, "", 52);
  // Every region, or Europe only for the PAL (50 Hz) variant.
  text(0x1f0, pal ? "E" : "JUE", 16);
  let sum = 0;
  for (let i = 0x200; i < rom.length; i += 2)
    sum = (sum + ((rom[i] << 8) | rom[i + 1])) & 0xffff;
  rom.set([sum >> 8, sum & 255], 0x18e);
  return rom;
}
