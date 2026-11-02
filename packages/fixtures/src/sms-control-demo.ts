/** Original Cartivo fixture, PolyForm Noncommercial-1.0.0 (repository LICENSE).
 * Tiny Z80 emitter and a 64 KiB Master System program using cartridge RAM
 * with battery (Sega mapper, $FFFC bit 3; Genesis Plus GX, like real
 * hardware, only maps it on carts over 48 KiB); no third-party ROM, BIOS or
 * art.
 * Oracle:
 * - the D-pad moves a white 8×8 sprite;
 * - button 2 counts in cartridge RAM ($8000); its parity picks the
 *   background, blue (even) or green (odd), so a reopened game shows it;
 * - holding button 1 paints the sprite yellow.
 */
export function smsControlDemo(): Uint8Array {
  const rom = new Uint8Array(0x10000);
  const code: number[] = [];
  const base = 0x80;
  const labels = new Map<string, number>();
  const fixups: { pos: number; label: string; relative: boolean }[] = [];
  const emit = (...bytes: number[]) => code.push(...bytes);
  const label = (name: string) => labels.set(name, base + code.length);
  /** JR (0x18), JR NZ (0x20), JR Z (0x28) to a label. */
  const jr = (op: number, name: string) => {
    emit(op, 0);
    fixups.push({ pos: code.length - 1, label: name, relative: true });
  };
  const jp = (name: string) => {
    emit(0xc3, 0, 0);
    fixups.push({ pos: code.length - 2, label: name, relative: false });
  };
  /** OUT (port),value through A. */
  const out = (port: number, value: number) => emit(0x3e, value, 0xd3, port);
  /** VDP address (write: $4000, CRAM: $C000) on the control port. */
  const vdpAddress = (address: number) => {
    out(0xbf, address & 255);
    out(0xbf, address >> 8);
  };
  const ld = (address: number) => emit(0x3a, address & 255, address >> 8); // LD A,(nn)
  const st = (address: number) => emit(0x32, address & 255, address >> 8); // LD (nn),A
  // RAM: $C000 x, $C001 y, $C002 button 2 last frame, $C003 pad (active high).
  const X = 0xc000,
    Y = 0xc001,
    PREV = 0xc002,
    PAD = 0xc003;
  /** If `bit` of the pad is set, INC/DEC (HL) at `address`. */
  const move = (bit: number, address: number, op: 0x34 | 0x35) => {
    ld(PAD);
    emit(0xcb, 0x47 | (bit << 3)); // BIT bit,A
    emit(0x28, 4, 0x21, address & 255, address >> 8, op); // JR Z,+4; LD HL,nn; INC/DEC (HL)
  };

  label("start");
  emit(0x3e, 0x08, 0x32, 0xfc, 0xff); // cartridge RAM at $8000 (battery)
  // VDP registers: mode 4, display off, name table $3800, sprites $3F00,
  // sprite patterns $0000, backdrop from sprite palette 0.
  for (const [reg, value] of [
    [0, 0x04],
    [1, 0x00],
    [2, 0xff],
    [3, 0xff],
    [4, 0xff],
    [5, 0xff],
    [6, 0xfb],
    [7, 0x00],
    [8, 0x00],
    [9, 0x00],
    [10, 0xff],
  ]) {
    out(0xbf, value);
    out(0xbf, 0x80 | reg);
  }
  // Clear the 16 KiB of VRAM: tile 0 blank, empty name table.
  vdpAddress(0x4000);
  emit(0x01, 0x00, 0x40); // LD BC,$4000
  label("clear");
  emit(0xaf, 0xd3, 0xbe, 0x0b, 0x78, 0xb1); // XOR A; OUT ($BE),A; DEC BC; LD A,B; OR C
  jr(0x20, "clear");
  // Tile 1 ($0020): every pixel colour 1 (plane 0 set).
  vdpAddress(0x4020);
  emit(0x06, 8); // LD B,8
  label("tile");
  emit(0x3e, 0xff, 0xd3, 0xbe, 0xaf, 0xd3, 0xbe, 0xd3, 0xbe, 0xd3, 0xbe);
  emit(0x10, 0); // DJNZ tile
  fixups.push({ pos: code.length - 1, label: "tile", relative: true });
  emit(0x3e, 120);
  st(X);
  emit(0x3e, 88);
  st(Y);
  emit(0xaf);
  st(PREV);
  out(0xbf, 0x40);
  out(0xbf, 0x81); // display on

  label("main");
  label("vblank");
  emit(0xdb, 0xbf, 0xe6, 0x80); // IN A,($BF); AND $80 (frame flag)
  jr(0x28, "vblank");
  emit(0xdb, 0xdc, 0x2f); // IN A,($DC); CPL: buttons active high
  st(PAD);
  move(0, Y, 0x35); // up
  move(1, Y, 0x34); // down
  move(2, X, 0x35); // left
  move(3, X, 0x34); // right

  // Button 2: count each new press in cartridge RAM.
  ld(PAD);
  emit(0xe6, 0x20, 0x47); // AND $20; LD B,A
  jr(0x28, "noPress");
  ld(PREV);
  emit(0xb8); // CP B
  jr(0x28, "noPress");
  emit(0x21, 0x00, 0x80, 0x34); // LD HL,$8000; INC (HL)
  label("noPress");
  emit(0x78);
  st(PREV);

  // Background (CRAM 0: colour of tile 0): counter parity.
  vdpAddress(0xc000);
  emit(0x3a, 0x00, 0x80, 0xe6, 0x01); // LD A,($8000); AND 1
  emit(0x3e, 0x30); // LD A,blue (flags kept)
  jr(0x28, "even");
  emit(0x3e, 0x0c); // green
  label("even");
  emit(0xd3, 0xbe);
  // Sprite colour (CRAM 17): yellow while button 1 is held, else white.
  vdpAddress(0xc011);
  ld(PAD);
  emit(0xe6, 0x10, 0x3e, 0x3f); // AND $10; LD A,white
  jr(0x28, "white");
  emit(0x3e, 0x0f); // yellow
  label("white");
  emit(0xd3, 0xbe);
  // Sprite 0 at (x, y), tile 1; $D0 ends the list.
  vdpAddress(0x7f00);
  ld(Y);
  emit(0xd3, 0xbe);
  out(0xbe, 0xd0);
  vdpAddress(0x7f80);
  ld(X);
  emit(0xd3, 0xbe);
  out(0xbe, 0x01);
  jp("main");

  for (const { pos, label: name, relative } of fixups) {
    const target = labels.get(name)!;
    if (relative) {
      const offset = target - (base + pos + 1);
      if (offset < -128 || offset > 127) throw Error(`Salto largo: ${name}`);
      code[pos] = offset & 255;
    } else [code[pos], code[pos + 1]] = [target & 255, target >> 8];
  }
  if (base + code.length > 0x7ff0) throw Error("Programa demasiado grande");
  rom.set([0xf3, 0xed, 0x56, 0x31, 0xf0, 0xdf], 0); // DI; IM 1; LD SP,$DFF0
  rom.set([0xc3, base & 255, base >> 8], 6); // JP start
  rom.set([0xfb, 0xed, 0x4d], 0x38); // EI; RETI (unused: interrupts off)
  rom.set([0xed, 0x45], 0x66); // RETN: the Pause button's NMI
  rom.set(code, base);
  // Header at $7FF0: "TMR SEGA", checksum of the first 32 KiB, product,
  // Export SMS, 64 KiB.
  rom.set(new TextEncoder().encode("TMR SEGA"), 0x7ff0);
  let sum = 0;
  for (let i = 0; i < 0x7ff0; i++) sum = (sum + rom[i]) & 0xffff;
  rom.set([sum & 255, sum >> 8, 0x26, 0x20, 0x00, 0x4e], 0x7ffa);
  return rom;
}
