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
import { resolveDisc } from "../../storage/src/cue.ts";
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
  const [first, ...others] = parts;
  const layout = await resolveDisc(first, others, (part) => part.blob.text());
  if (layout.missing.length)
    throw Error(
      `Faltan archivos del juego: ${layout.missing.join(", ")}. Ábrelos junto con el ${first.name.toLowerCase().endsWith(".m3u") ? ".m3u" : ".cue"} (selecciónalos todos a la vez).`,
    );
  // `identified`: the files of the game's identity, as the library copies
  // them, under the names the core asks for. The core reads a .cue itself
  // and does not expect a UTF-8 BOM (Blob.text() drops it silently).
  const identified: DiscPart[] = await Promise.all(
    layout.parts.map(async ({ name, file }) => {
      if (!name.toLowerCase().endsWith(".cue")) return { name, blob: file.blob };
      const head = new Uint8Array(await file.blob.slice(0, 3).arrayBuffer());
      const bom = head[0] === 0xef && head[1] === 0xbb && head[2] === 0xbf;
      return { name, blob: bom ? file.blob.slice(3) : file.blob };
    }),
  );
  // Unrelated files opened alongside stay readable but outside the identity.
  parts = [
    ...identified,
    ...others.filter((p) => !layout.parts.some((part) => part.file === p)),
  ];
  const [boot, ...rest] = layout.boots;
  const disc = new DiscImage(
    parts,
    identified.find((p) => p.name === boot)!,
    read,
    rest,
  );
  const [hash] = await Promise.all([
    discIdentity(identified),
    module.prepare(),
  ]);
  // `parts`: the files of its identity, as the library copies them.
  return { disc, hash, parts: identified };
}
