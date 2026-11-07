// Nintendo 64 cartridge validation. Reads the header only: recognising it
// proves neither that the game boots nor that the dump is intact.

export const MAX_N64_ROM_BYTES = 64 * 1024 * 1024;

/** Dump byte orders: big-endian .z64, byte-swapped .v64, little-endian .n64.
 * The core reorders any of them itself. */
export type ByteOrder = "z64" | "v64" | "n64";
export type N64Header = { byteOrder: ByteOrder; title: string };

const MAGIC: Record<string, ByteOrder> = {
  "128,55,18,64": "z64",
  "55,128,64,18": "v64",
  "64,18,55,128": "n64",
};

/** Byte order and internal title, from the first 64 bytes of a dump of
 * `bytes` bytes; throws a user-readable error for anything else. */
export function inspectN64Header(header: Uint8Array, bytes: number): N64Header {
  if (!Number.isSafeInteger(bytes) || bytes < 4096 || bytes > MAX_N64_ROM_BYTES)
    throw Error("Un cartucho de Nintendo 64 ocupa entre 4 KiB y 64 MiB.");
  if (bytes % 4 !== 0 || header.length < 64)
    throw Error("El cartucho está truncado o no tiene una cabecera completa.");
  const byteOrder = MAGIC[Array.from(header.subarray(0, 4)).join(",")];
  if (!byteOrder) throw Error("No se reconoce una cabecera de cartucho N64.");
  const xor = byteOrder === "v64" ? 1 : byteOrder === "n64" ? 3 : 0;
  let title = "";
  for (let i = 0x20; i < 0x34; i++) {
    const value = header[i ^ xor];
    title += value >= 32 && value <= 126 ? String.fromCharCode(value) : " ";
  }
  return { byteOrder, title: title.trim() || "Sin título" };
}

/** Every N64 game keeps its saves (cartridge EEPROM/SRAM/FlashRAM and the
 * controller pak) in the core's one battery block. */
export function validateN64Rom(rom: Uint8Array) {
  inspectN64Header(rom, rom.length);
  return { battery: true };
}
