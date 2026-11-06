// Super Nintendo cartridge validation, shared by every SNES core. Finds the
// internal header (LoROM, HiROM or ExHiROM, with or without a 512-byte copier
// header) and refuses what this build cannot run, with a readable reason.

export const MAX_SNES_ROM_BYTES = 8 * 1024 * 1024 + 512;

export type SnesCartridge = {
  /** 512 when the file starts with a copier header. */
  copierHeader: number;
  map: "LoROM" | "HiROM" | "ExHiROM";
  title: string;
  /** Battery RAM declared by the header, in bytes (0 = none). */
  sramBytes: number;
  battery: boolean;
};

const layouts = [
  { map: "LoROM", at: 0x7fc0, modes: [0x20, 0x23, 0x30, 0x32] },
  { map: "HiROM", at: 0xffc0, modes: [0x21, 0x31, 0x35] },
  { map: "ExHiROM", at: 0x40ffc0, modes: [0x25, 0x35] },
] as const;

const word = (rom: Uint8Array, at: number) => rom[at] | (rom[at + 1] << 8);

/** How much a candidate header looks real (higher is better). */
function score(rom: Uint8Array, at: number, modes: readonly number[]) {
  if (rom.length < at + 0x40) return -1;
  let points = 0;
  if ((word(rom, at + 0x1c) ^ word(rom, at + 0x1e)) === 0xffff) points += 4;
  if (modes.includes(rom[at + 0x15])) points += 2;
  if (word(rom, at + 0x3c) >= 0x8000) points += 1; // reset vector in ROM
  const title = rom.subarray(at, at + 21);
  if (title.every((c) => c >= 0x20 && c < 0x7f)) points += 1;
  return points;
}

/** Throws a user-readable error for files this build cannot run. */
export function validateSnesRom(file: Uint8Array): SnesCartridge {
  const copierHeader = file.length % 1024 === 512 ? 512 : 0;
  const rom = file.subarray(copierHeader);
  if (rom.length < 0x8000)
    throw Error(
      "El archivo no es un cartucho de Super Nintendo (demasiado pequeño).",
    );
  if (file.length > MAX_SNES_ROM_BYTES)
    throw Error("El cartucho supera los 8 MB admitidos.");
  if (String.fromCharCode(...rom.subarray(0, 14)) === "BANDAI SFC-ADX")
    throw Error(
      "Los cartuchos Sufami Turbo necesitan una BIOS que Cartivo no incluye.",
    );
  const best = layouts
    .map((l) => ({ ...l, points: score(rom, l.at, l.modes) }))
    .sort((a, b) => b.points - a.points)[0];
  if (best.points < 3)
    throw Error(
      "La cabecera del cartucho está dañada o no es un juego de Super Nintendo.",
    );
  const h = best.at;
  const chip = rom[h + 0x16];
  if (chip === 0xe3)
    throw Error(
      "Este cartucho es un Super Game Boy, que necesita la BIOS de Game Boy.",
    );
  if (chip === 0xe5 || chip === 0xe6)
    throw Error(
      "Los cartuchos Satellaview (BS-X) necesitan una BIOS que Cartivo no incluye.",
    );
  // $xxBF (just before the header) names custom chips; 2 = ST018.
  if ((chip & 0xf0) === 0xf0 && rom[h - 1] === 0x02)
    throw Error("Este cartucho usa el chip ST018, que todavía no se admite.");
  // PAL cartridges are accepted: Snes9x picks 50 Hz from the header and the
  // bridge reports it (cartivo_frame_rate).
  const ram = rom[h + 0x18];
  const sramBytes = ram > 0 && ram <= 7 ? 1024 << ram : 0;
  return {
    copierHeader,
    map: best.map,
    title: String.fromCharCode(...rom.subarray(h, h + 21)).trim(),
    sramBytes,
    battery: sramBytes > 0,
  };
}
