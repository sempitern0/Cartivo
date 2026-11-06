// Master System and Mega Drive cartridge validation, shared by every core
// for these systems. Refuses what this build cannot run (CD images, 32X,
// Game Gear, interleaved SMD dumps) with a reason.

/** Genesis Plus GX's cartridge area (MAXROMSIZE, 10 MiB). */
export const MAX_MD_ROM_BYTES = 10 * 1024 * 1024;
export const MAX_SMS_ROM_BYTES = 4 * 1024 * 1024;

export type SegaCartridge = {
  /** Any cartridge may carry battery RAM; the core sizes it. */
  battery: boolean;
  title: string;
};

const ascii = (rom: Uint8Array, at: number, length: number) =>
  String.fromCharCode(...rom.subarray(at, at + length));

/** Throws a user-readable error for files this build cannot run. */
export function validateMdRom(rom: Uint8Array): SegaCartridge {
  if (rom.length < 0x200)
    throw Error(
      "El archivo no es un cartucho de Mega Drive (demasiado pequeño).",
    );
  if (rom.length > MAX_MD_ROM_BYTES)
    throw Error("El cartucho supera los 10 MB admitidos.");
  if (
    ascii(rom, 0, 14) === "SEGADISCSYSTEM" ||
    ascii(rom, 0x10, 14) === "SEGADISCSYSTEM"
  )
    throw Error("Es un disco de Mega-CD, que todavía no se admite.");
  const system = ascii(rom, 0x100, 16);
  if (!system.includes("SEGA")) {
    if (rom.length % 0x4000 === 512)
      throw Error(
        "Este volcado usa el formato SMD intercalado. Conviértelo a .md o .bin.",
      );
    throw Error(
      "La cabecera del cartucho está dañada o no es un juego de Mega Drive.",
    );
  }
  if (system.includes("32X"))
    throw Error("Es un cartucho de 32X, que todavía no se admite.");
  // PAL cartridges are accepted: Genesis Plus GX picks 50 Hz from the
  // region field and the bridge reports it (cartivo_frame_rate).
  return {
    battery: ascii(rom, 0x1b0, 2) === "RA",
    title: ascii(rom, 0x150, 48).trim(),
  };
}

/** Throws a user-readable error for files this build cannot run. */
export function validateSmsRom(rom: Uint8Array): SegaCartridge {
  if (rom.length < 0x2000)
    throw Error(
      "El archivo no es un cartucho de Master System (demasiado pequeño).",
    );
  if (rom.length > MAX_SMS_ROM_BYTES)
    throw Error("El cartucho supera los 4 MB admitidos.");
  if (rom.length >= 0x110 && ascii(rom, 0x100, 16).includes("SEGA"))
    throw Error("Es un cartucho de Mega Drive: ábrelo desde su tarjeta.");
  // Japanese cartridges often lack the "TMR SEGA" header; when it exists,
  // its region code tells Game Gear apart (5, 6 and 7).
  const header = [0x7ff0, 0x3ff0, 0x1ff0].find(
    (at) => rom.length >= at + 16 && ascii(rom, at, 8) === "TMR SEGA",
  );
  if (header !== undefined && rom[header + 15] >> 4 >= 5)
    throw Error("Es un cartucho de Game Gear, que todavía no se admite.");
  return { battery: true, title: "" };
}
