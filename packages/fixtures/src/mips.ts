/** Original Cartivo code, PolyForm Noncommercial-1.0.0 (repository LICENSE).
 * A tiny MIPS emitter for the fixtures that are real programs of a MIPS
 * console: the subset they need, labels with branch and jump fix-ups, and
 * a delay-slot nop after every branch. Register numbers are the hardware's
 * (v0 2, v1 3, a0–a3 4–7, t0–t7 8–15, s0 16, ra 31).
 */
export function mipsEmitter(base: number) {
  const code: number[] = [];
  const labels = new Map<string, number>();
  const fixups: { at: number; label: string; kind: "branch" | "jump" }[] = [];
  const emit = (word: number) => void code.push(word >>> 0);
  const R = (
    op: number,
    rs: number,
    rt: number,
    rd: number,
    sh: number,
    fn: number,
  ) => emit((op << 26) | (rs << 21) | (rt << 16) | (rd << 11) | (sh << 6) | fn);
  const I = (op: number, rs: number, rt: number, imm: number) =>
    emit((op << 26) | (rs << 21) | (rt << 16) | (imm & 0xffff));
  const nop = () => emit(0);
  const lui = (rt: number, imm: number) => I(0x0f, 0, rt, imm);
  const ori = (rt: number, rs: number, imm: number) => I(0x0d, rs, rt, imm);
  const branch = (op: number, rs: number, rt: number, name: string) => {
    fixups.push({ at: code.length, label: name, kind: "branch" });
    I(op, rs, rt, 0);
    nop(); // delay slot
  };
  return {
    emit,
    /** Address of the next instruction. */
    here: () => base + code.length * 4,
    label: (name: string) => void labels.set(name, base + code.length * 4),
    nop,
    lui,
    ori,
    andi: (rt: number, rs: number, imm: number) => I(0x0c, rs, rt, imm),
    addiu: (rt: number, rs: number, imm: number) => I(0x09, rs, rt, imm),
    /** A 32-bit constant in a register (lui + ori). */
    li: (rt: number, value: number) => {
      lui(rt, value >>> 16);
      ori(rt, rt, value & 0xffff);
    },
    lbu: (rt: number, rs: number, offset: number) => I(0x24, rs, rt, offset),
    lw: (rt: number, rs: number, offset: number) => I(0x23, rs, rt, offset),
    sw: (rt: number, rs: number, offset: number) => I(0x2b, rs, rt, offset),
    /** 64-bit load and store (MIPS III: N64, PS2). */
    ld: (rt: number, rs: number, offset: number) => I(0x37, rs, rt, offset),
    sd: (rt: number, rs: number, offset: number) => I(0x3f, rs, rt, offset),
    beq: (rs: number, rt: number, name: string) => branch(0x04, rs, rt, name),
    bne: (rs: number, rt: number, name: string) => branch(0x05, rs, rt, name),
    j: (name: string) => {
      fixups.push({ at: code.length, label: name, kind: "jump" });
      emit(0x02 << 26);
      nop();
    },
    jalr: (rs: number) => R(0, rs, 0, 31, 0, 0x09),
    syscall: () => emit(0x0000000c),
    /** The program's words, with every label resolved. */
    link(): number[] {
      for (const { at, label: name, kind } of fixups) {
        const target = labels.get(name);
        if (target === undefined) throw Error(`Etiqueta sin definir: ${name}`);
        if (kind === "branch") {
          const offset = (target - (base + at * 4 + 4)) >> 2;
          code[at] = (code[at] & 0xffff0000) | (offset & 0xffff);
        } else code[at] = ((0x02 << 26) | ((target >>> 2) & 0x03ffffff)) >>> 0;
      }
      return code;
    },
  };
}
