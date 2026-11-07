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
import { cueFiles, matchTracks, trackName } from "../../storage/src/cue.ts";
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
  let identified = parts.slice(0, 1);
  if (parts[0].name.toLowerCase().endsWith(".cue")) {
    const [cue, ...others] = parts;
    const text = await cue.blob.text(); // decoding drops a UTF-8 BOM
    // The core reads the sheet itself and does not expect that BOM.
    const head = new Uint8Array(await cue.blob.slice(0, 3).arrayBuffer());
    const bom = head[0] === 0xef && head[1] === 0xbb && head[2] === 0xbf;
    const sheet = bom ? { name: cue.name, blob: cue.blob.slice(3) } : cue;
    const { tracks, missing } = matchTracks(cueFiles(text), others);
    if (missing.length)
      throw Error(
        `Faltan archivos del disco: ${missing.join(", ")}. Abre el .cue junto con sus pistas (selecciónalos todos a la vez).`,
      );
    // A renamed track is offered to the core under the name the cue uses.
    const named = [...tracks].map(([name, part]) =>
      trackName(part.name) === trackName(name)
        ? part
        : { name, blob: part.blob },
    );
    parts = [
      sheet,
      ...named,
      ...others.filter((p) => !named.some((n) => n.blob === p.blob)),
    ];
    identified = [sheet, ...named];
  }
  const disc = new DiscImage(parts, parts[0], read);
  const [hash] = await Promise.all([
    discIdentity(identified),
    module.prepare(),
  ]);
  return { disc, hash };
}
