// Generic emulator Worker: one session, any registered system and core.
import {
  coreModule,
  findCoreModule,
} from "../../../packages/adapters/src/registry.ts";
import type {
  CoreModule,
  EmulatorCore,
} from "../../../packages/adapters/src/contract.ts";
import { neutral } from "../../../packages/input/src/nes-input.ts";
import { SramStore, digest } from "../../../packages/storage/src/sram.ts";
import {
  backupFormat,
  sramKey,
} from "../../../packages/storage/src/formats.ts";
import { coreLabel } from "../../../packages/runtime/src/systems.ts";
import {
  StateStore,
  makePreview,
} from "../../../packages/storage/src/states.ts";
import { BackgroundCommit } from "../../../packages/storage/src/background-commit.ts";
import {
  parseStateFile,
  serializeState,
} from "../../../packages/storage/src/state-file.ts";
import {
  rememberGame,
  storedRom,
  updateGame,
} from "../../../packages/storage/src/library.ts";
import {
  parseRequest,
  type EmuRequest,
  type EmuResult,
} from "../../../packages/runtime/src/protocol.ts";
const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent) => void) | null;
  postMessage: (value: unknown, transfer: Transferable[]) => void;
};
let core: EmulatorCore | undefined;
let module: CoreModule;
/** Replaces the running core, releasing the previous one (wasm memory). */
function use(next: EmulatorCore) {
  if (core !== next) core?.dispose();
  core = next;
}
let store: SramStore | undefined;
let states: StateStore | undefined;
let rom: Uint8Array;
let hash = "";
/** File name of the running game, needed to remember it; empty otherwise. */
let title = "";
let session = "";
let busy = false;
async function flush() {
  if (core?.battery && store) {
    await store.commit(core.save());
    return true;
  }
  return false;
}
/**
 * Commits battery RAM and reports the outcome instead of throwing, so the
 * caller's own work (a frame, a snapshot) is never lost to a failed write.
 */
async function tryFlush(): Promise<Pick<EmuResult, "saved" | "saveError">> {
  try {
    return { saved: await flush() };
  } catch (e) {
    return {
      saved: false,
      saveError: e instanceof Error ? e.message : "Guardado fallido",
    };
  }
}
/** Periodic battery-RAM commits in the background while the game runs. */
const saves = new BackgroundCommit(tryFlush);
/** Adds the running game to the library; a failure never stops the game. */
async function remember(): Promise<
  Pick<EmuResult, "remembered" | "libraryError">
> {
  if (!title) return { remembered: false };
  try {
    await rememberGame({ hash, system: module.system, name: title, rom });
    return { remembered: true };
  } catch (e) {
    return {
      remembered: false,
      libraryError: e instanceof Error ? e.message : "No se pudo recordar",
    };
  }
}
/**
 * The ROM bytes for the requested source: the core's demo, an opened file or
 * the remembered copy, which must be byte-identical to the game it was saved as.
 */
async function readRom(r: EmuRequest): Promise<Uint8Array> {
  if (r.demo) {
    if (!module.demo) throw Error("Este sistema no tiene demo integrada.");
    return module.demo();
  }
  const source = r.file ?? (await storedRom(r.stored!));
  if (!source)
    throw Error(
      "La copia de este juego ya no está en el dispositivo. Ábrelo otra vez desde su archivo; tus partidas siguen guardadas.",
    );
  if (source.size > module.maxRomBytes)
    throw Error("Archivo demasiado grande para este sistema.");
  const bytes = new Uint8Array(await source.arrayBuffer());
  if (r.stored && (await digest(bytes)) !== r.stored)
    throw Error(
      "La copia guardada de este juego está dañada. Ábrelo otra vez desde su archivo; tus partidas siguen guardadas.",
    );
  return bytes;
}
async function run(r: EmuRequest): Promise<EmuResult> {
  if (r.command === "load") {
    if (core) throw Error("Ya hay un juego cargado");
    const system = r.system ?? "nes";
    // Protocol v1 without `core` meant JSNES; keep that for old clients.
    module = coreModule(system, r.core ?? (system === "nes" ? "jsnes" : ""));
    // Size and integrity are checked before compiling the core.
    rom = await readRom(r);
    await module.prepare();
    module.validate(rom);
    hash = await digest(rom);
    title = r.file?.name ?? "";
    // Per-game writer lock first: snapshots exist for every game.
    states = await StateStore.open(hash);
    // SRAM is keyed by ROM hash only, so a save moves between cores.
    use(module.create(rom));
    if (core!.battery) {
      store = await SramStore.open(sramKey(system, hash), core!.saveBytes);
      const saved = await store.load();
      if (saved) use(module.create(rom, saved));
    }
    session = r.session;
    // Remembered games move to the top of the library when played; for any
    // other game (demos included) updateGame finds no entry and does nothing.
    const library = r.remember
      ? await remember()
      : {
          remembered: await updateGame(hash, {
            lastPlayedAt: Date.now(),
          }).catch(() => false),
        };
    return {
      hash,
      core: module.id,
      states: await states.list(),
      battery: core!.battery,
      recovered: store?.recovered ?? false,
      ...library,
    };
  }
  if (!core || session !== r.session)
    throw Error("Sesión obsoleta o no cargada");
  if (r.command === "advance") {
    core.input(r.input!);
    return {
      ...core.advance(r.count!),
      width: module.video.width,
      height: module.video.height,
      ...saves.tick(core.frames),
    };
  }
  // Everything else may read or write battery RAM, or replace the core:
  // never while a background commit is still writing.
  await saves.settle();
  if (r.command === "reset") {
    // Flush the previous session before replacing the CPU/PPU/APU instance.
    // A reset must not erase battery-backed SRAM or its previous generation.
    const saved = await flush();
    const previousSave = core.battery ? core.save() : undefined;
    use(module.create(rom, previousSave));
    saves.restart();
    return { saved, frames: 0 };
  }
  core.input(neutral());
  if (r.command === "library-add") return remember();
  if (r.command === "state-list") return { states: await states!.list() };
  if (r.command === "state-save") {
    const bytes = core.snapshot();
    // Battery RAM is committed too, so both kinds of save agree. Its result
    // is reported on its own: the snapshot is kept even if it fails.
    const flushed = await tryFlush();
    const frame = core.lastFrame();
    const { width, height } = module.video;
    const preview =
      frame.length === width * height * 4
        ? makePreview(frame, width, height)
        : undefined;
    await states!.save(r.slot!, bytes, {
      core: module.id,
      coreVersion: module.version,
      frames: core.frames,
      preview,
    });
    // The «Continuar» card shows where the player left off.
    if (r.slot === "auto" && preview)
      await updateGame(hash, { preview, lastPlayedAt: Date.now() }).catch(
        () => false,
      );
    return { ...flushed, states: await states!.list() };
  }
  if (r.command === "state-load") {
    const bytes = await states!.load(r.slot!, module.id, module.version, (id) =>
      coreLabel(module.system, id),
    );
    core.restore(bytes);
    return { frames: core.frames, states: await states!.list() };
  }
  if (r.command === "state-export") {
    const record = await states!.record(r.slot!);
    return { stateFile: serializeState(record, module.system, hash) };
  }
  if (r.command === "state-import") {
    // Into the slot it was exported from; the panel confirms replacing it.
    const imported = await parseStateFile(r.stateFile, {
      system: module.system,
      game: hash,
      coreVersion: (id) => findCoreModule(module.system, id)?.version,
    });
    await states!.put(imported);
    return { states: await states!.list() };
  }
  if (r.command === "state-delete") {
    await states!.delete(r.slot!);
    return { states: await states!.list() };
  }
  if (r.command === "import") {
    const b = r.backup as {
      format?: unknown;
      game?: unknown;
      sha256?: unknown;
      bytes?: unknown;
    };
    if (
      !store ||
      !b ||
      b.format !== backupFormat(module.system) ||
      b.game !== hash ||
      !Array.isArray(b.bytes) ||
      b.bytes.length !== core.saveBytes ||
      b.bytes.some((v) => !Number.isInteger(v) || v < 0 || v > 255)
    )
      throw Error(
        "La copia no pertenece a este juego o tiene un formato incompatible",
      );
    const save = Uint8Array.from(b.bytes);
    if ((await digest(save)) !== b.sha256)
      throw Error("La copia de partida está dañada");
    const replacement = module.create(rom, save);
    await store.commit(save);
    use(replacement);
    saves.restart();
    return { saved: true };
  }
  if (r.command === "save") {
    const save = core.save();
    return { save, saveHash: await digest(save), hash, saved: false };
  }
  const saved = await flush();
  return { saved };
}
scope.onmessage = async (event) => {
  let request: EmuRequest;
  try {
    request = parseRequest(event.data);
  } catch {
    return;
  }
  if (busy) {
    scope.postMessage(
      {
        v: 1,
        session: request.session,
        id: request.id,
        ok: false,
        error: "Petición concurrente",
      },
      [],
    );
    return;
  }
  busy = true;
  try {
    const result = await run(request);
    const transfer: Transferable[] = [];
    for (const bytes of [result.pixels, result.audio, result.save])
      if (bytes) transfer.push(bytes.buffer as ArrayBuffer);
    scope.postMessage(
      { v: 1, session: request.session, id: request.id, ok: true, result },
      transfer,
    );
  } catch (e) {
    scope.postMessage(
      {
        v: 1,
        session: request.session,
        id: request.id,
        ok: false,
        error: e instanceof Error ? e.message : "Error de emulación",
      },
      [],
    );
  } finally {
    busy = false;
  }
};
