/** Original Cartivo fixture, PolyForm Noncommercial-1.0.0 (repository LICENSE).
 * Tiny ARM assembler and a 64 KiB Game Boy Advance program in bitmap mode 3;
 * no third-party ROM, BIOS or artwork (the header logo area is left blank).
 * D-pad moves a square; A counts in SRAM ($0E000000) and toggles the
 * background; B plays a tone; L and R change the square's colour.
 */
export function gbaControlDemo(): Uint8Array {
  const rom = new Uint8Array(0x10000).fill(0xff);
  const base = 0x080000c0;
  const code: number[] = [];
  const labels = new Map<string, number>();
  const branches: { at: number; label: string; cond: number; link: boolean }[] =
    [];
  const literals: { at: number; value: number }[] = [];
  const here = () => base + code.length * 4;
  const emit = (word: number) => code.push(word >>> 0);
  const label = (name: string) => labels.set(name, here());

  // Condition codes (ARM): EQ 0, NE 1, GT 12, LT 11, AL 14.
  const EQ = 0x0,
    NE = 0x1,
    LT = 0xb,
    GT = 0xc,
    AL = 0xe;
  const b = (name: string, cond = AL, link = false) => {
    branches.push({ at: code.length, label: name, cond, link });
    emit(0);
  };
  /** ARM data-processing immediate: an 8-bit value rotated right by 2n. */
  const imm = (value: number) => {
    for (let rot = 0; rot < 16; rot++) {
      const v = ((value << (rot * 2)) | (value >>> (32 - rot * 2))) >>> 0;
      if (v < 256) return (rot << 8) | v;
    }
    throw Error(`immediate ${value}`);
  };
  const dp = (op: number, rd: number, rn: number, value: number, cond = AL) =>
    emit(
      (cond << 28) |
        0x02000000 |
        (op << 21) |
        (rn << 16) |
        (rd << 12) |
        imm(value),
    );
  const mov = (rd: number, value: number, cond = AL) =>
    dp(0xd, rd, 0, value, cond);
  const add = (rd: number, rn: number, value: number, cond = AL) =>
    dp(0x4, rd, rn, value, cond);
  const sub = (rd: number, rn: number, value: number, cond = AL) =>
    dp(0x2, rd, rn, value, cond);
  const subs = (rd: number, rn: number, value: number) =>
    emit((AL << 28) | 0x02500000 | (rn << 16) | (rd << 12) | imm(value));
  const cmp = (rn: number, value: number) =>
    emit((AL << 28) | 0x03500000 | (rn << 16) | imm(value));
  const tst = (rn: number, value: number) =>
    emit((AL << 28) | 0x03100000 | (rn << 16) | imm(value));
  const and = (rd: number, rn: number, value: number) => dp(0x0, rd, rn, value);
  /** LDR rd, =value (PC-relative literal pool after the code). */
  const ldr = (rd: number, value: number, cond = AL) => {
    literals.push({ at: code.length, value: value >>> 0 });
    emit((cond << 28) | 0x059f0000 | (rd << 12));
  };
  const strh = (rd: number, rn: number, offset = 0) =>
    emit(
      0xe1c000b0 |
        (rn << 16) |
        (rd << 12) |
        ((offset >> 4) << 8) |
        (offset & 15),
    );
  const ldrh = (rd: number, rn: number, offset = 0) =>
    emit(
      0xe1d000b0 |
        (rn << 16) |
        (rd << 12) |
        ((offset >> 4) << 8) |
        (offset & 15),
    );
  /** STRH rd, [rn], #2 (post-increment). */
  const strhNext = (rd: number, rn: number) =>
    emit(0xe0c000b2 | (rn << 16) | (rd << 12));
  const ldrb = (rd: number, rn: number) =>
    emit(0xe5d00000 | (rn << 16) | (rd << 12));
  const strb = (rd: number, rn: number) =>
    emit(0xe5c00000 | (rn << 16) | (rd << 12));
  const movReg = (rd: number, rm: number) => emit(0xe1a00000 | (rd << 12) | rm);
  const mvn = (rd: number, rm: number) => emit(0xe1e00000 | (rd << 12) | rm);
  const andReg = (rd: number, rn: number, rm: number) =>
    emit(0xe0000000 | (rn << 16) | (rd << 12) | rm);
  const mul = (rd: number, rm: number, rs: number) =>
    emit(0xe0000090 | (rd << 16) | (rs << 8) | rm);
  const addReg = (rd: number, rn: number, rm: number, lsl = 0) =>
    emit(0xe0800000 | (rn << 16) | (rd << 12) | (lsl << 7) | rm);
  const ret = () => emit(0xe1a0f00e); // MOV PC, LR

  // r8 I/O, r9 VRAM, r10 SRAM, r4/r5 square x/y, r6 previous keys,
  // r7 square colour, r11 background colour.
  const [IO, VRAM, SRAM, X, Y, PREV, INK, BG] = [8, 9, 10, 4, 5, 6, 7, 11];
  const GREEN = 0x03e0,
    BLUE = 0x7c00,
    WHITE = 0x7fff,
    YELLOW = 0x03ff,
    MAGENTA = 0x7c1f;

  mov(IO, 0x04000000);
  mov(VRAM, 0x06000000);
  mov(SRAM, 0x0e000000);
  ldr(0, 0x0403); // DISPCNT: mode 3, BG2 on
  strh(0, IO, 0x00);
  mov(0, 0x80); // SOUNDCNT_X: sound on
  strh(0, IO, 0x84);
  ldr(0, 0x1177); // SOUNDCNT_L: channel 1 left and right, full volume
  strh(0, IO, 0x80);
  mov(0, 2); // SOUNDCNT_H: DMG channels at 100 %
  strh(0, IO, 0x82);
  mov(X, 116);
  mov(Y, 76);
  mov(PREV, 0);
  ldr(INK, WHITE);
  ldrb(1, SRAM);
  tst(1, 1);
  ldr(BG, GREEN, EQ);
  ldr(BG, BLUE, NE);
  b("fill", AL, true);

  label("frame");
  label("vblank"); // wait for line 160
  ldrh(0, IO, 0x06);
  cmp(0, 160);
  b("vblank", NE);
  ldr(1, 0x04000130); // KEYINPUT (active low); beyond LDRH's 8-bit offset
  ldrh(0, 1, 0);
  mvn(0, 0);
  ldr(1, 0x3ff);
  andReg(0, 0, 1);
  movReg(2, BG); // erase the square at its old place
  b("square", AL, true);
  tst(0, 0x10); // right
  add(X, X, 1, NE);
  tst(0, 0x20); // left
  sub(X, X, 1, NE);
  tst(0, 0x40); // up
  sub(Y, Y, 1, NE);
  tst(0, 0x80); // down
  add(Y, Y, 1, NE);
  cmp(X, 0);
  mov(X, 0, LT);
  cmp(X, 232);
  mov(X, 232, GT);
  cmp(Y, 0);
  mov(Y, 0, LT);
  cmp(Y, 152);
  mov(Y, 152, GT);
  tst(0, 0x200); // L
  ldr(INK, YELLOW, NE);
  tst(0, 0x100); // R
  ldr(INK, MAGENTA, NE);
  // A: count each new press in SRAM and toggle the background.
  tst(0, 1);
  b("aDone", EQ);
  tst(PREV, 1);
  b("aDone", NE);
  ldrb(1, SRAM);
  add(1, 1, 1);
  strb(1, SRAM);
  tst(1, 1);
  ldr(BG, GREEN, EQ);
  ldr(BG, BLUE, NE);
  b("fill", AL, true);
  label("aDone");
  movReg(PREV, 0);
  // B: retrigger a square wave on channel 1 while held.
  tst(0, 2);
  b("silent", EQ);
  mov(1, 0);
  strh(1, IO, 0x60);
  ldr(1, 0xf780);
  strh(1, IO, 0x62);
  ldr(1, 0x8600);
  strh(1, IO, 0x64);
  label("silent");
  movReg(2, INK);
  b("square", AL, true);
  label("leave"); // wait until line 160 is over
  ldrh(0, IO, 0x06);
  cmp(0, 160);
  b("leave", EQ);
  b("frame");

  // fill: background colour (r11) over the whole 240×160 screen.
  label("fill");
  movReg(1, VRAM);
  ldr(3, 240 * 160);
  label("fillLoop");
  strhNext(BG, 1);
  subs(3, 3, 1);
  b("fillLoop", NE);
  ret();

  // square: 8×8 block of colour r2 at (r4, r5).
  label("square");
  mov(1, 240);
  mul(1, Y, 1);
  addReg(1, 1, X);
  addReg(1, VRAM, 1, 1);
  mov(3, 8);
  label("row");
  mov(12, 8);
  label("pixel");
  strhNext(2, 1);
  subs(12, 12, 1);
  b("pixel", NE);
  add(1, 1, (240 - 8) * 2);
  subs(3, 3, 1);
  b("row", NE);
  ret();

  // Literal pool, then a save-type marker other tools look for.
  const pool = new Map<number, number>();
  for (const { at, value } of literals) {
    if (!pool.has(value)) {
      pool.set(value, here());
      emit(value);
    }
    const offset = pool.get(value)! - (base + at * 4 + 8);
    if (offset < 0 || offset > 0xfff) throw Error("literal out of range");
    code[at] = (code[at] | offset) >>> 0;
  }
  for (const { at, label: name, cond, link } of branches) {
    const target = labels.get(name);
    if (target === undefined) throw Error(`label ${name}`);
    const offset = ((target - (base + at * 4 + 8)) >> 2) & 0xffffff;
    code[at] = ((cond << 28) | (link ? 0x0b000000 : 0x0a000000) | offset) >>> 0;
  }
  const marker = [..."SRAM_V113"].map((c) => c.charCodeAt(0));

  const view = new DataView(rom.buffer);
  rom.fill(0, 0, 0xc0);
  view.setUint32(0, 0xea00002e, true); // B 0x080000C0
  rom.set(
    [..."CARTIVO GBA "].map((c) => c.charCodeAt(0)),
    0xa0,
  );
  rom.set(
    [..."CRTE"].map((c) => c.charCodeAt(0)),
    0xac,
  ); // game code
  rom.set([0x30, 0x30], 0xb0); // maker "00"
  rom[0xb2] = 0x96; // fixed value
  rom[0xbd] = gbaHeaderChecksum(rom);
  code.forEach((word, i) => view.setUint32(0xc0 + i * 4, word, true));
  rom.set([...marker, 0, 0, 0], 0xc0 + code.length * 4);
  return rom;
}

/** Complement check over $A0–$BC, as the BIOS verifies it. */
export function gbaHeaderChecksum(rom: Uint8Array): number {
  let sum = 0;
  for (let i = 0xa0; i <= 0xbc; i++) sum += rom[i];
  return -(sum + 0x19) & 0xff;
}
