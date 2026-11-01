/** Original Cartivo fixture, PolyForm Noncommercial-1.0.0 (repository LICENSE).
 * Tiny SM83 assembler and a 32 KiB MBC1+RAM+battery program; no third-party
 * ROM, boot ROM or artwork (the header logo area is left blank).
 * D-pad moves a square sprite; A increments battery RAM ($A000) and toggles
 * the background colour; B plays a pulse tone. `color` sets the CGB flag.
 */
export function gbControlDemo(color = false): Uint8Array {
  const rom = new Uint8Array(0x8000);
  const code: number[] = [];
  const base = 0x150;
  const labels = new Map<string, number>();
  const fixups: { pos: number; label: string; relative: boolean }[] = [];
  const emit = (...bytes: number[]) => code.push(...bytes);
  const label = (name: string) => labels.set(name, base + code.length);
  /** JR cc/JR (0x18, 0x20 nz, 0x28 z, 0x30 nc, 0x38 c) to a label. */
  const jr = (op: number, name: string) => {
    emit(op, 0);
    fixups.push({ pos: code.length - 1, label: name, relative: true });
  };
  const jp = (name: string) => {
    emit(0xc3, 0, 0);
    fixups.push({ pos: code.length - 2, label: name, relative: false });
  };
  const ldh = (port: number, value: number) => emit(0x3e, value, 0xe0, port);
  const fill = (
    address: number,
    count: number,
    value: number,
    name: string,
  ) => {
    // LD HL,addr; LD BC,count; loop: LD A,v; LD (HL+),A; DEC BC; LD A,B; OR C
    emit(0x21, address & 255, address >> 8, 0x01, count & 255, count >> 8);
    label(name);
    emit(0x3e, value, 0x22, 0x0b, 0x78, 0xb1);
    jr(0x20, name);
  };
  const waitLine = (name: string, op: number) => {
    // loop: LDH A,(LY); CP 144; JR op,loop
    label(name);
    emit(0xf0, 0x44, 0xfe, 0x90);
    jr(op, name);
  };
  const readPad = (select: number) => {
    // Write the group, read twice to settle, invert and keep 4 bits.
    emit(0x3e, select, 0xe0, 0x00, 0xf0, 0x00, 0xf0, 0x00, 0x2f, 0xe6, 0x0f);
  };

  emit(0xf3, 0x31, 0xfe, 0xff); // DI; LD SP,$FFFE
  waitLine("boot", 0x38); // wait for VBlank before turning the LCD off
  emit(0xaf, 0xe0, 0x40); // XOR A; LDH (LCDC),A
  fill(0x8000, 16, 0x00, "tile0");
  fill(0x8010, 16, 0xff, "tile1");
  fill(0x9800, 0x400, 0x00, "map");
  fill(0xfe00, 0xa0, 0x00, "oam");
  // Sprite 0: Y, X, tile 1, attributes 0.
  emit(0x21, 0x00, 0xfe, 0x3e, 0x50, 0x22, 0x22, 0x3e, 0x01, 0x22, 0xaf, 0x77);
  ldh(0x48, 0xfc); // OBP0: sprite drawn in the darkest shade (DMG)
  // CGB object palette 0: colours 1-3 white (ignored on DMG).
  ldh(0x6a, 0x80);
  emit(0xaf, 0xe0, 0x6b, 0xe0, 0x6b);
  for (let i = 0; i < 3; i++)
    emit(0x3e, 0xff, 0xe0, 0x6b, 0x3e, 0x7f, 0xe0, 0x6b);
  emit(0x3e, 0x0a, 0xea, 0x00, 0x00); // enable cartridge RAM
  ldh(0x26, 0x80); // NR52: sound on
  ldh(0x24, 0x77); // NR50: full volume
  ldh(0x25, 0xff); // NR51: every channel to both sides
  emit(0xaf, 0xea, 0x00, 0xc0); // previous buttons = none (WRAM is random)
  ldh(0x40, 0x93); // LCD on, tiles at $8000, sprites and background on

  label("frame");
  waitLine("vblank", 0x20); // until LY == 144
  readPad(0x20); // d-pad
  emit(0xcb, 0x37, 0x47); // SWAP A; LD B,A
  readPad(0x10); // buttons
  emit(0xb0, 0x4f); // OR B; LD C,A  (C: down up left right start select B A)
  ldh(0x00, 0x30);
  for (const [bit, address, op, name] of [
    [4, 0xfe01, 0x34, "right"],
    [5, 0xfe01, 0x35, "left"],
    [6, 0xfe00, 0x35, "up"],
    [7, 0xfe00, 0x34, "down"],
  ] as const) {
    emit(0xcb, 0x41 + bit * 8); // BIT n,C
    jr(0x28, name);
    emit(0x21, address & 255, address >> 8, op); // LD HL,addr; INC/DEC (HL)
    label(name);
  }
  // A: count each new press in battery RAM through a real CPU write.
  emit(0xfa, 0x00, 0xc0, 0x47, 0x79, 0xea, 0x00, 0xc0); // B = previous, save C
  emit(0xcb, 0x41); // BIT 0,C
  jr(0x28, "aDone");
  emit(0xcb, 0x40); // BIT 0,B
  jr(0x20, "aDone");
  emit(0x21, 0x00, 0xa0, 0x34); // INC ($A000)
  label("aDone");
  // Background colour from the counter: DMG shade 0/2, CGB green/blue.
  emit(0xfa, 0x00, 0xa0, 0xe6, 0x01, 0x87, 0xe0, 0x47);
  ldh(0x68, 0x80);
  emit(0xfa, 0x00, 0xa0, 0xe6, 0x01);
  jr(0x28, "green");
  emit(0xaf, 0xe0, 0x69, 0x3e, 0x7c, 0xe0, 0x69);
  jr(0x18, "colorDone");
  label("green");
  emit(0x3e, 0xe0, 0xe0, 0x69, 0x3e, 0x03, 0xe0, 0x69);
  label("colorDone");
  // B: retrigger a square wave on channel 1 while held.
  emit(0xcb, 0x49); // BIT 1,C
  jr(0x28, "silent");
  ldh(0x10, 0x00);
  ldh(0x11, 0x80);
  ldh(0x12, 0xf3);
  ldh(0x13, 0x00);
  ldh(0x14, 0x87);
  label("silent");
  waitLine("leave", 0x28); // until LY != 144
  jp("frame");

  for (const { pos, label: name, relative } of fixups) {
    const target = labels.get(name);
    if (target === undefined) throw Error(`label ${name}`);
    if (relative) {
      const offset = target - (base + pos + 1);
      if (offset < -128 || offset > 127) throw Error(`jr ${name}`);
      code[pos] = offset & 255;
    } else {
      code[pos] = target & 255;
      code[pos + 1] = target >> 8;
    }
  }
  rom.set(code, base);
  rom.set([0x00, 0xc3, base & 255, base >> 8], 0x100); // NOP; JP $0150
  const title = color ? "CARTIVO GBC" : "CARTIVO GB";
  rom.set(
    [...title].map((c) => c.charCodeAt(0)),
    0x134,
  );
  rom[0x143] = color ? 0x80 : 0x00;
  rom[0x147] = 0x03; // MBC1 + RAM + battery
  rom[0x148] = 0x00; // 32 KiB
  rom[0x149] = 0x02; // 8 KiB RAM
  rom[0x14a] = 0x01; // non-Japanese
  let check = 0;
  for (let i = 0x134; i <= 0x14c; i++) check = (check - rom[i] - 1) & 255;
  rom[0x14d] = check;
  let sum = 0;
  for (const b of rom) sum += b;
  rom[0x14e] = (sum >> 8) & 255;
  rom[0x14f] = sum & 255;
  return rom;
}
