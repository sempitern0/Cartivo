/** Original Cartivo fixture, PolyForm Noncommercial-1.0.0 (repository LICENSE).
 * Tiny 65816 emitter and a 32 KiB LoROM program with 2 KiB battery RAM; no
 * third-party ROM, firmware or artwork.
 * Oracle:
 * - the D-pad moves a white 8×8 sprite;
 * - A increments battery RAM ($70:0000); its parity picks the backdrop,
 *   blue (even) or green (odd), so a reopened game shows the stored value;
 * - holding B turns the backdrop red;
 * - X, Y, L and R paint the sprite yellow, cyan, magenta and orange.
 */
export function snesControlDemo(): Uint8Array {
  const rom = new Uint8Array(0x8000);
  const code: number[] = [];
  const base = 0x8000;
  const labels = new Map<string, number>();
  const fixups: { pos: number; label: string; relative: boolean }[] = [];
  const emit = (...bytes: number[]) => code.push(...bytes);
  const label = (name: string) => labels.set(name, base + code.length);
  const word = (v: number) => [v & 255, (v >> 8) & 255];
  /** Branch (BPL 10, BMI 30, BNE D0, BEQ F0, BCS B0, BRA 80) to a label. */
  const branch = (op: number, name: string) => {
    emit(op, 0);
    fixups.push({ pos: code.length - 1, label: name, relative: true });
  };
  const jmp = (name: string) => {
    emit(0x4c, 0, 0);
    fixups.push({ pos: code.length - 2, label: name, relative: false });
  };
  const lda = (value: number) => emit(0xa9, value); // 8-bit accumulator
  const sta = (address: number) => emit(0x8d, ...word(address));
  const stz = (address: number) => emit(0x9c, ...word(address));
  const ldaAbs = (address: number) => emit(0xad, ...word(address));
  const ldaSram = () => emit(0xaf, 0x00, 0x00, 0x70); // LDA $700000
  const staSram = () => emit(0x8f, 0x00, 0x00, 0x70); // STA $700000
  const ldaDp = (d: number) => emit(0xa5, d);
  const staDp = (d: number) => emit(0x85, d);
  const andImm = (value: number) => emit(0x29, value);
  /** Writes a BGR555 colour at the current CGRAM address. */
  const color = (bgr: number) => {
    lda(bgr & 255);
    sta(0x2122);
    lda(bgr >> 8);
    sta(0x2122);
  };
  /** If `bit` of joypad byte `pad` ($03 high, $04 low) is set: `then`. */
  const ifButton = (
    pad: number,
    bit: number,
    skip: string,
    then: () => void,
  ) => {
    ldaDp(pad);
    andImm(bit);
    branch(0xf0, skip);
    then();
  };
  // Direct page: $00 x, $01 y, $02 A held last frame, $03/$04 joypad, $05 A now.

  emit(0x78, 0x18, 0xfb); // SEI; CLC; XCE (native mode)
  emit(0xc2, 0x10, 0xa2, ...word(0x1fff), 0x9a); // REP #$10; LDX #$1FFF; TXS
  emit(0xe2, 0x30); // SEP #$30: 8-bit A, X and Y from here on
  lda(0x80);
  sta(0x2100); // force blank during setup
  stz(0x4200);
  stz(0x2101); // 8×8 sprites, characters at VRAM $0000
  // Character 0: every pixel colour 1 (bitplane 0 set, planes 1–3 clear).
  lda(0x80);
  sta(0x2115);
  stz(0x2116);
  stz(0x2117);
  emit(0xa2, 8); // LDX #8
  label("tile");
  lda(0xff);
  sta(0x2118);
  stz(0x2119);
  emit(0xca); // DEX
  branch(0xd0, "tile");
  emit(0xa2, 8);
  label("planes");
  stz(0x2118);
  stz(0x2119);
  emit(0xca);
  branch(0xd0, "planes");
  // All 128 sprites below the visible area, small, high bits clear.
  stz(0x2102);
  stz(0x2103);
  emit(0xa2, 0x80);
  label("oam");
  stz(0x2104);
  lda(0xe0);
  sta(0x2104);
  stz(0x2104);
  stz(0x2104);
  emit(0xca);
  branch(0xd0, "oam");
  emit(0xa2, 0x20);
  label("oamHigh");
  stz(0x2104);
  emit(0xca);
  branch(0xd0, "oamHigh");
  lda(0x10);
  sta(0x212c); // sprites on the main screen
  lda(120);
  staDp(0x00);
  lda(104);
  staDp(0x01);
  emit(0x64, 0x02); // STZ $02
  lda(0x01);
  sta(0x4200); // automatic joypad read
  lda(0x0f);
  sta(0x2100); // screen on, full brightness

  label("main");
  label("leaveVblank");
  ldaAbs(0x4212);
  branch(0x30, "leaveVblank");
  label("waitVblank");
  ldaAbs(0x4212);
  branch(0x10, "waitVblank");
  label("waitPad");
  ldaAbs(0x4212);
  emit(0x4a); // LSR: auto-read busy flag into carry
  branch(0xb0, "waitPad");
  ldaAbs(0x4219); // B Y Select Start Up Down Left Right
  staDp(0x03);
  ldaAbs(0x4218); // A X L R
  staDp(0x04);

  ifButton(0x03, 0x01, "noRight", () => emit(0xe6, 0x00));
  label("noRight");
  ifButton(0x03, 0x02, "noLeft", () => emit(0xc6, 0x00));
  label("noLeft");
  ifButton(0x03, 0x04, "noDown", () => emit(0xe6, 0x01));
  label("noDown");
  ifButton(0x03, 0x08, "noUp", () => emit(0xc6, 0x01));
  label("noUp");

  // A: count each new press in battery RAM.
  ldaDp(0x04);
  andImm(0x80);
  staDp(0x05);
  branch(0xf0, "noPress");
  emit(0xc5, 0x02); // CMP $02
  branch(0xf0, "noPress");
  ldaSram();
  emit(0x1a); // INC A
  staSram();
  label("noPress");
  ldaDp(0x05);
  staDp(0x02);

  // Backdrop (CGRAM 0): red while B is held, else the counter's parity.
  stz(0x2121);
  ifButton(0x03, 0x80, "notB", () => {
    color(0x001f);
    branch(0x80, "backdropDone");
  });
  label("notB");
  ldaSram();
  andImm(0x01);
  branch(0xf0, "even");
  color(0x03e0);
  branch(0x80, "backdropDone");
  label("even");
  color(0x7c00);
  label("backdropDone");

  // Sprite colour (CGRAM 129, palette 0 colour 1).
  lda(0x81);
  sta(0x2121);
  const shades: [number, number, number][] = [
    [0x04, 0x40, 0x03ff], // X: yellow
    [0x03, 0x40, 0x7fe0], // Y: cyan
    [0x04, 0x20, 0x7c1f], // L: magenta
    [0x04, 0x10, 0x021f], // R: orange
  ];
  shades.forEach(([pad, bit, shade], i) => {
    ifButton(pad, bit, `shade${i}`, () => {
      color(shade);
      branch(0x80, "shadeDone");
    });
    label(`shade${i}`);
  });
  color(0x7fff);
  label("shadeDone");

  // Sprite 0: X, Y, character 0, priority 3.
  stz(0x2102);
  stz(0x2103);
  ldaDp(0x00);
  sta(0x2104);
  ldaDp(0x01);
  sta(0x2104);
  stz(0x2104);
  lda(0x30);
  sta(0x2104);
  jmp("main");
  label("rti");
  emit(0x40);

  for (const { pos, label: name, relative } of fixups) {
    const target = labels.get(name)!;
    if (relative) {
      const offset = target - (base + pos + 1);
      if (offset < -128 || offset > 127) throw Error(`Salto largo: ${name}`);
      code[pos] = offset & 255;
    } else [code[pos], code[pos + 1]] = word(target);
  }
  if (code.length > 0x7fb0) throw Error("Programa demasiado grande");
  rom.set(code);

  // Header at $FFC0 (file 0x7FC0), LoROM.
  const title = "CARTIVO CONTROL DEMO ";
  for (let i = 0; i < 21; i++) rom[0x7fc0 + i] = title.charCodeAt(i);
  rom[0x7fd5] = 0x20; // LoROM, slow
  rom[0x7fd6] = 0x02; // ROM + RAM + battery
  rom[0x7fd7] = 0x05; // 32 KiB
  rom[0x7fd8] = 0x01; // 2 KiB RAM
  rom[0x7fd9] = 0x01; // North America (NTSC)
  // Vectors: reset to $8000, every interrupt to an RTI.
  const rti = word(labels.get("rti")!);
  for (const at of [0x7fe4, 0x7fe6, 0x7fe8, 0x7fea, 0x7fee, 0x7ff4, 0x7ff8])
    rom.set(rti, at);
  rom.set(rti, 0x7ffa);
  rom.set(rti, 0x7ffe);
  rom.set(word(base), 0x7ffc);
  // Checksum over the whole ROM with complement $FFFF and checksum $0000.
  rom.set([0xff, 0xff, 0x00, 0x00], 0x7fdc);
  const sum = rom.reduce((s, v) => (s + v) & 0xffff, 0);
  rom.set([...word(sum ^ 0xffff), ...word(sum)], 0x7fdc);
  return rom;
}
