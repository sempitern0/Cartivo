// Game Boy / Game Boy Color cartridge validation, shared by every GB core.
// Reads the header only; the core decides the exact battery size.

export const MAX_GB_ROM_BYTES = 8 * 1024 * 1024;

type Cartridge = { name: string; battery: boolean };

/** Cartridge types this build accepts (header byte $0147). */
const supported: Record<number, Cartridge> = {
  0x00: { name: "ROM", battery: false },
  0x01: { name: "MBC1", battery: false },
  0x02: { name: "MBC1+RAM", battery: false },
  0x03: { name: "MBC1+RAM+BATTERY", battery: true },
  0x05: { name: "MBC2", battery: false },
  0x06: { name: "MBC2+BATTERY", battery: true },
  0x08: { name: "ROM+RAM", battery: false },
  0x09: { name: "ROM+RAM+BATTERY", battery: true },
  0x0f: { name: "MBC3+TIMER+BATTERY", battery: true },
  0x10: { name: "MBC3+TIMER+RAM+BATTERY", battery: true },
  0x11: { name: "MBC3", battery: false },
  0x12: { name: "MBC3+RAM", battery: false },
  0x13: { name: "MBC3+RAM+BATTERY", battery: true },
  0x19: { name: "MBC5", battery: false },
  0x1a: { name: "MBC5+RAM", battery: false },
  0x1b: { name: "MBC5+RAM+BATTERY", battery: true },
  0x1c: { name: "MBC5+RUMBLE", battery: false },
  0x1d: { name: "MBC5+RUMBLE+RAM", battery: false },
  0x1e: { name: "MBC5+RUMBLE+RAM+BATTERY", battery: true },
};

/** Known but unsupported hardware, named in the error message. */
const unsupported: Record<number, string> = {
  0x0b: "MMM01",
  0x0c: "MMM01",
  0x0d: "MMM01",
  0x20: "MBC6",
  0x22: "MBC7 (sensor de inclinación)",
  0xfc: "Pocket Camera",
  0xfd: "Bandai TAMA5",
  0xfe: "HuC3",
  0xff: "HuC1",
};

export type GbCartridge = {
  battery: boolean;
  /** Runs on Game Boy Color hardware (header $0143 bit 7). */
  cgb: boolean;
  mapper: string;
};

/** Throws a user-readable error for files this build cannot run. */
export function validateGbRom(rom: Uint8Array): GbCartridge {
  if (rom.length < 0x8000)
    throw Error(
      "El archivo no es un cartucho de Game Boy (demasiado pequeño).",
    );
  if (rom.length > MAX_GB_ROM_BYTES)
    throw Error("El cartucho supera los 8 MB admitidos.");
  if (headerChecksum(rom) !== rom[0x14d])
    throw Error(
      "La cabecera del cartucho está dañada o no es un juego de Game Boy.",
    );
  const sizeCode = rom[0x148];
  if (sizeCode > 0x08)
    throw Error(`Tamaño de ROM desconocido en la cabecera (${hex(sizeCode)}).`);
  if (rom.length < 0x8000 << sizeCode)
    throw Error("El archivo está incompleto: es más corto que su cabecera.");
  const type = rom[0x147];
  const cartridge = supported[type];
  if (!cartridge)
    throw Error(
      `Este cartucho usa ${unsupported[type] ?? `un tipo desconocido (${hex(type)})`}, que todavía no se admite.`,
    );
  return {
    battery: cartridge.battery,
    cgb: (rom[0x143] & 0x80) !== 0,
    mapper: cartridge.name,
  };
}

/** Cartridge header checksum over $0134–$014C. */
export function headerChecksum(rom: Uint8Array): number {
  let x = 0;
  for (let i = 0x134; i <= 0x14c; i++) x = (x - rom[i] - 1) & 255;
  return x;
}

const hex = (n: number) => `$${n.toString(16).padStart(2, "0").toUpperCase()}`;
