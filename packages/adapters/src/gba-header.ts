// Game Boy Advance cartridge validation. Reads the header only; the save
// type (SRAM, Flash or EEPROM) is detected by the core while the game runs.

export const MAX_GBA_ROM_BYTES = 32 * 1024 * 1024;

/** Throws a user-readable error for files this build cannot run. */
export function validateGbaRom(rom: Uint8Array): { battery: boolean } {
  if (rom.length < 0xc0)
    throw Error(
      "El archivo no es un cartucho de Game Boy Advance (demasiado pequeño).",
    );
  if (rom.length > MAX_GBA_ROM_BYTES)
    throw Error("El cartucho supera los 32 MB admitidos.");
  if (rom[0xb2] !== 0x96 || gbaHeaderChecksum(rom) !== rom[0xbd])
    throw Error(
      "La cabecera del cartucho está dañada o no es un juego de Game Boy Advance.",
    );
  // Any GBA cartridge may carry a save chip; its type is only known later.
  return { battery: true };
}

/** Complement check over $A0–$BC, as the BIOS verifies it. */
export function gbaHeaderChecksum(rom: Uint8Array): number {
  let sum = 0;
  for (let i = 0xa0; i <= 0xbc; i++) sum += rom[i];
  return -(sum + 0x19) & 0xff;
}
