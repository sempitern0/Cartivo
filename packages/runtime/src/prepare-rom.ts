import type { CoreModule } from "../../adapters/src/contract.ts";
import { digest } from "../../storage/src/sram.ts";

type Loader = Pick<CoreModule, "demo" | "maxRomBytes" | "validate" | "prepare">;

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
