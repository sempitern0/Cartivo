// iNES header validation shared by every NES core. Cartivo admits the same
// cartridge subset whatever core runs it (ADR-007 limits, ADR-008).
export const MAX_ROM_BYTES = 16 + 512 * 1024 + 256 * 1024;
export const acceptedMappers = [0, 1, 2, 3, 4] as const;
export function validateRom(bytes: Uint8Array): {
  battery: boolean;
  mapper: number;
} {
  if (
    bytes.length < 16 ||
    bytes[0] !== 0x4e ||
    bytes[1] !== 0x45 ||
    bytes[2] !== 0x53 ||
    bytes[3] !== 0x1a
  )
    throw Error("Archivo NES inválido: falta una cabecera iNES válida.");
  if ((bytes[7] & 0x0c) === 8) throw Error("NES 2.0 todavía no está admitido.");
  const mapper = (bytes[6] >> 4) | (bytes[7] & 0xf0);
  if (!(acceptedMappers as readonly number[]).includes(mapper))
    throw Error(
      `Mapper ${mapper} todavía no admitido. Disponibles experimentalmente: 0 (NROM), 1 (MMC1), 2 (UxROM), 3 (CNROM), 4 (MMC3). NTSC indica la región, no el mapper.`,
    );
  if (
    bytes[6] & 0x0c ||
    bytes[7] & 15 ||
    bytes[9] !== 0 ||
    bytes[10] !== 0 ||
    bytes.slice(11, 16).some((v) => v !== 0) ||
    bytes[8] > 1
  )
    throw Error(
      `Mapper ${mapper}: solo iNES NTSC estándar, sin trainer, VS, extensiones ni SRAM superior a 8 KB.`,
    );
  const prg = bytes[4] * 16384,
    chr = bytes[5] * 8192;
  if (
    !prg ||
    prg > 512 * 1024 ||
    chr > 256 * 1024 ||
    bytes.length > MAX_ROM_BYTES
  )
    throw Error(
      `Mapper ${mapper}: tamaño fuera de los límites experimentales (PRG 512 KB, CHR 256 KB).`,
    );
  if (bytes.length !== 16 + prg + chr)
    throw Error(
      `Mapper ${mapper}: archivo truncado o con datos adicionales; cabecera declara ${16 + prg + chr} bytes y el archivo tiene ${bytes.length}.`,
    );
  if (mapper === 0 && (prg > 32768 || chr > 8192))
    throw Error(
      "Mapper 0 (NROM): su cabecera no admite más de 32 KB PRG y 8 KB CHR.",
    );
  const limits: Record<number, [number, number]> = {
    0: [32768, 8192],
    1: [262144, 131072],
    2: [262144, 8192],
    3: [32768, 262144],
    4: [524288, 262144],
  };
  const [maxPrg, maxChr] = limits[mapper];
  if (prg > maxPrg || chr > maxChr)
    throw Error(
      `Mapper ${mapper}: esta variante excede el límite admitido (PRG ${maxPrg / 1024} KB, CHR ${maxChr / 1024} KB).`,
    );
  return { battery: !!(bytes[6] & 2), mapper };
}
