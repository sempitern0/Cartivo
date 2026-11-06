import type {
  CartridgeModule,
  DiscModule,
} from "../../adapters/src/contract.ts";
import {
  DiscImage,
  fileReaderSync,
  type ReadSync,
} from "../../adapters/src/disc.ts";
import {
  discIdentity,
  type DiscPart,
} from "../../storage/src/disc-identity.ts";
import { digest } from "../../storage/src/sram.ts";

type Loader = Pick<
  CartridgeModule,
  "demo" | "maxRomBytes" | "validate" | "prepare"
>;

/** Worker-only: one read and one identity hash, retaining stored-copy checks. */
export async function prepareRom(
  module: Loader,
  source?: Blob,
  expectedHash?: string,
  identify: typeof digest = digest,
) {
  if (source && source.size > module.maxRomBytes)
    throw Error("Archivo demasiado grande para este sistema.");
  if (!source && !module.demo)
    throw Error("Este sistema no tiene demo integrada.");
  const rom = source
    ? new Uint8Array(await source.arrayBuffer())
    : module.demo!();
  if (rom.length > module.maxRomBytes)
    throw Error("Archivo demasiado grande para este sistema.");
  let hash: string;
  if (expectedHash !== undefined) {
    hash = await identify(rom);
    if (hash !== expectedHash)
      throw Error(
        "La copia guardada de este juego está dañada. Ábrelo otra vez desde su archivo; tus partidas siguen guardadas.",
      );
    module.validate(rom);
    await module.prepare();
  } else {
    // Reject unsupported headers before downloading or compiling a core.
    module.validate(rom);
    // Both promises are observed immediately, including failures.
    [hash] = await Promise.all([identify(rom), module.prepare()]);
  }
  return { rom, hash };
}

type DiscLoader = Pick<DiscModule, "boots" | "demo" | "prepare">;

/** The file a disc core starts from: the first of `boots` present. */
export function bootPart(
  parts: readonly DiscPart[],
  boots: readonly string[],
): DiscPart | undefined {
  for (const extension of boots) {
    const found = parts.find((p) => p.name.toLowerCase().endsWith(extension));
    if (found) return found;
  }
}

/**
 * Worker-only, for disc systems (ADR-015): the files the player opened
 * together (or the demo program) as one disc, identified by blocks and never
 * read whole; the core reads its sectors later, on demand.
 */
export async function prepareDisc(
  module: DiscLoader,
  files?: readonly File[],
  read: ReadSync = fileReaderSync,
) {
  let parts: DiscPart[];
  if (files) parts = files.map((file) => ({ name: file.name, blob: file }));
  else if (module.demo) {
    const { name, bytes } = module.demo();
    parts = [{ name, blob: new Blob([bytes as BlobPart]) }];
  } else throw Error("Este sistema no tiene demo integrada.");
  const primary = bootPart(parts, module.boots);
  if (!primary)
    throw Error(
      `Falta el archivo de arranque del disco (${module.boots.join(", ")}).`,
    );
  const [hash] = await Promise.all([discIdentity(parts), module.prepare()]);
  return { disc: new DiscImage(parts, primary, read), hash };
}
