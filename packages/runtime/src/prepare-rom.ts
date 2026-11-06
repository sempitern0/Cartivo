import type {
  CartridgeModule,
  DiscModule,
} from "../../adapters/src/contract.ts";
import {
  cueFiles,
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

type DiscLoader = Pick<DiscModule, "demo" | "prepare">;

/**
 * Worker-only, for disc systems (ADR-015): the file the player chose to boot
 * (or the demo program) with the files opened alongside, as one disc that is
 * never read whole; the core reads its sectors later, on demand.
 * The identity, which keys the memory card and Partidas, covers the boot file
 * and the tracks a .cue names: never the order the files were picked in or
 * an unrelated file opened with them.
 */
export async function prepareDisc(
  module: DiscLoader,
  file?: File,
  extra: readonly File[] = [],
  read: ReadSync = fileReaderSync,
) {
  let parts: DiscPart[];
  if (file) parts = [file, ...extra].map((f) => ({ name: f.name, blob: f }));
  else if (module.demo) {
    const { name, bytes } = module.demo();
    parts = [{ name, blob: new Blob([bytes as BlobPart]) }];
  } else throw Error("Este sistema no tiene demo integrada.");
  const disc = new DiscImage(parts, parts[0], read);
  const identified = [disc.primary];
  if (disc.primary.name.toLowerCase().endsWith(".cue"))
    for (const name of cueFiles(await disc.primary.blob.text())) {
      const track = disc.find(name);
      if (track && !identified.includes(track)) identified.push(track);
    }
  const [hash] = await Promise.all([
    discIdentity(identified),
    module.prepare(),
  ]);
  return { disc, hash };
}
