// Storage identifiers per system. NES keeps the names it shipped with, so
// existing battery saves and exported copies keep loading.

/** IndexedDB key of a game's battery RAM. */
export const sramKey = (system: string, romHash: string) =>
  system === "nes" ? `nrom-sram-v1:${romHash}` : `${system}-sram-v1:${romHash}`;

/** `format` field of an exported battery-save copy. */
export const backupFormat = (system: string) =>
  system === "nes" ? "cartivo-nrom-sram-v1" : `cartivo-${system}-sram-v1`;

/**
 * Upper bound for an exported copy file before parsing it. Copies are JSON
 * byte arrays (≤4 characters per byte): 1 MiB covers 128 KiB battery RAM,
 * the largest V1 cartridge save. The worker then checks the exact size.
 */
export const MAX_BACKUP_FILE = 1 << 20;
