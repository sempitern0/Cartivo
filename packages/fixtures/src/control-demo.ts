/** Original Cartivo fixture, PolyForm Noncommercial-1.0.0 (repository LICENSE).
 * Tiny 6502 assembler and NROM program; no third-party ROM, BIOS or artwork.
 * D-pad moves a square; A increments battery RAM/color; B plays a pulse tone.
 */
export function controlDemo(): Uint8Array {
  const code: number[] = [];
  const labels = new Map<string, number>();
  const fixups: { pos: number; label: string; relative: boolean }[] = [];
  const emit = (...bytes: number[]) => code.push(...bytes);
  const label = (name: string) => labels.set(name, code.length);
  const branch = (op: number, name: string) => {
    emit(op, 0);
    fixups.push({ pos: code.length - 1, label: name, relative: true });
  };
  const jump = (name: string) => {
    emit(0x4c, 0, 0);
    fixups.push({ pos: code.length - 2, label: name, relative: false });
  };
  const store = (address: number, value: number) =>
    emit(0xa9, value, 0x8d, address & 255, address >> 8);
  emit(0x78, 0xd8, 0xa2, 0xff, 0x9a); // SEI CLD LDX #ff TXS
  store(0x2000, 0);
  store(0x2001, 0);
  store(0x4015, 0);
  store(0x4017, 0x40);
  label("warm1");
  emit(0x2c, 0x02, 0x20);
  branch(0x10, "warm1");
  label("warm2");
  emit(0x2c, 0x02, 0x20);
  branch(0x10, "warm2");
  // Zero working RAM; do not touch cartridge SRAM.
  emit(0xa9, 0, 0xa2, 0);
  label("clear");
  emit(0x95, 0, 0xe8);
  branch(0xd0, "clear");
  emit(0xa9, 0xff, 0xa2, 0);
  label("oam");
  emit(0x9d, 0, 2, 0xe8);
  branch(0xd0, "oam");
  store(0x0200, 100);
  store(0x0201, 1);
  store(0x0202, 0);
  store(0x0203, 100);
  // Sprite palette: white; backdrop is changed each frame from SRAM.
  store(0x2006, 0x3f);
  store(0x2006, 0x11);
  store(0x2007, 0x30);
  store(0x2001, 0x14);
  label("frame");
  emit(0x2c, 2, 0x20);
  branch(0x10, "frame");
  store(0x4016, 1);
  store(0x4016, 0);
  emit(0xa2, 0);
  label("read");
  emit(0xad, 0x16, 0x40, 0x29, 1, 0x95, 0x10, 0xe8, 0xe0, 8);
  branch(0xd0, "read");
  for (const [key, address, op, name] of [
    [0x14, 0x0200, 0xce, "up"],
    [0x15, 0x0200, 0xee, "down"],
    [0x16, 0x0203, 0xce, "left"],
    [0x17, 0x0203, 0xee, "right"],
  ] as const) {
    emit(0xa5, key);
    branch(0xf0, name);
    emit(op, address & 255, address >> 8);
    label(name);
  }
  // Increment once per A press, persist via real CPU write to $6000.
  emit(0xa5, 0x10);
  branch(0xf0, "aDone");
  emit(0xa5, 1);
  branch(0xd0, "aDone");
  emit(0xee, 0, 0x60);
  label("aDone");
  emit(0xa5, 0x10, 0x85, 1);
  emit(0xa5, 0x11);
  branch(0xf0, "silent");
  store(0x4015, 1);
  store(0x4000, 0xbf);
  store(0x4002, 0xfd);
  store(0x4003, 0x08);
  jump("soundDone");
  label("silent");
  store(0x4015, 0);
  label("soundDone");
  store(0x2003, 0);
  store(0x4014, 2);
  store(0x2006, 0x3f);
  store(0x2006, 0);
  emit(0xad, 0, 0x60, 0x29, 3, 0x18, 0x69, 0x21, 0x8d, 7, 0x20);
  store(0x2005, 0);
  store(0x2005, 0);
  jump("frame");
  for (const f of fixups) {
    const dest = labels.get(f.label);
    if (dest === undefined) throw Error("Unknown label");
    if (f.relative) {
      const delta = dest - (f.pos + 1);
      if (delta < -128 || delta > 127) throw Error("Branch overflow");
      code[f.pos] = delta & 255;
    } else {
      code[f.pos] = (0x8000 + dest) & 255;
      code[f.pos + 1] = (0x8000 + dest) >> 8;
    }
  }
  const rom = new Uint8Array(16 + 16384 + 8192);
  rom.set([0x4e, 0x45, 0x53, 0x1a, 1, 1, 2, 0]); // iNES mapper 0, battery-backed 8KB RAM
  rom.set(code, 16);
  for (const pos of [0x3ffa, 0x3ffc, 0x3ffe]) rom.set([0, 0x80], 16 + pos);
  rom.fill(255, 16 + 16384 + 16, 16 + 16384 + 24); // sprite tile 1, low plane
  return rom;
}
