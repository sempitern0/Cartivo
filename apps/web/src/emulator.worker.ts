// Generic emulator Worker: one session, any registered system and core.
import {
  prepareDisc,
  prepareRom,
} from "../../../packages/runtime/src/prepare-rom.ts";
import {
  coreModule,
  findCoreModule,
} from "../../../packages/adapters/src/registry.ts";
import type {
  CartridgeModule,
  CoreModule,
  DiscModule,
  EmulatorCore,
} from "../../../packages/adapters/src/contract.ts";
import { neutral } from "../../../packages/input/src/nes-input.ts";
import { SramStore, digest } from "../../../packages/storage/src/sram.ts";
import {
  backupFormat,
  sramKey,
} from "../../../packages/storage/src/formats.ts";
import { coreLabel } from "../../../packages/runtime/src/systems.ts";
import { PRINCIPAL } from "../../../packages/storage/src/profiles.ts";
import { StorageUnavailable } from "../../../packages/storage/src/idb.ts";
import {
  StateStore,
  makePreview,
} from "../../../packages/storage/src/states.ts";
import {
  BackgroundCommit,
  type CommitReport,
} from "../../../packages/storage/src/background-commit.ts";
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
/** A new core for the loaded game (load, reset, imported saves). */
let start: (save?: Uint8Array) => EmulatorCore;
/** The cartridge in memory, kept to remember it; discs stay in their files. */
let rom: Uint8Array | undefined;
let hash = "";
/** The profile whose saves, Partidas and library this session uses. */
let profile = PRINCIPAL;
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
async function tryFlush(): Promise<CommitReport> {
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
/** Why nothing can be saved in this browser, or undefined when it can. */
let noStorage: string | undefined;
/**
 * Takes the per-game writer lock and opens Partidas and, for battery games,
 * the SRAM store (keyed by ROM hash only, so a save moves between cores).
 * Without usable storage (StorageUnavailable) the game still runs and
 * nothing is saved; a game open in another tab is still refused.
 */
async function openStorage(system: string) {
  try {
    states = await StateStore.open(hash, profile);
    if (core!.battery)
      store = await SramStore.open(
        sramKey(system, hash),
        core!.saveBytes,
        profile,
      );
  } catch (e) {
    states?.close();
    states = undefined;
    if (!(e instanceof StorageUnavailable)) throw e;
    noStorage = `${e.message} Puedes jugar, pero no se guardará el progreso.`;
  }
}
/** The Partidas store, or a clear refusal when this browser cannot save. */
function snapshots(): StateStore {
  if (!states) throw Error(noStorage ?? "Partidas no disponibles");
  return states;
}
/** Adds the running game to the library; a failure never stops the game. */
async function remember(): Promise<
  Pick<EmuResult, "remembered" | "libraryError">
> {
  // Discs are not copied to the library yet (ADR-015): they keep playing
  // from the files the player opens.
  if (!title || !rom) return { remembered: false };
  try {
    await rememberGame(
      { hash, system: module.system, name: title, rom },
      profile,
    );
    return { remembered: true };
  } catch (e) {
    return {
      remembered: false,
      libraryError: e instanceof Error ? e.message : "No se pudo recordar",
    };
  }
}
type Loaded = {
  start: (save?: Uint8Array) => EmulatorCore;
  rom?: Uint8Array;
  hash: string;
};

async function loadCartridge(
  module: CartridgeModule,
  r: EmuRequest,
): Promise<Loaded> {
  const source = r.file ?? (r.stored ? await storedRom(r.stored) : undefined);
  if (r.stored && !source)
    throw Error(
      "La copia de este juego ya no está en el dispositivo. Ábrelo otra vez desde su archivo; tus partidas siguen guardadas.",
    );
  const { rom, hash } = await prepareRom(module, source, r.stored);
  return { start: (save) => module.create(rom, save), rom, hash };
}

/** Discs stay in the player's files (ADR-015): never in the library yet. */
async function loadDisc(module: DiscModule, r: EmuRequest): Promise<Loaded> {
  if (r.stored) throw Error("Los discos no se guardan en la biblioteca.");
  const { disc, hash } = await prepareDisc(module, r.file, r.extra);
  return { start: (save) => module.create(disc, save), hash };
}

async function run(r: EmuRequest): Promise<EmuResult> {
  if (r.command === "load") {
    if (core) throw Error("Ya hay un juego cargado");
    const system = r.system ?? "nes";
    // Protocol v1 without `core` meant JSNES; keep that for old clients.
    module = coreModule(system, r.core ?? (system === "nes" ? "jsnes" : ""));
    profile = r.profile ?? PRINCIPAL;
    ({ start, rom, hash } = module.disc
      ? await loadDisc(module, r)
      : await loadCartridge(module, r));
    title = r.file?.name ?? "";
    use(start());
    await openStorage(system);
    if (store) {
      const saved = await store.load();
      if (saved) use(start(saved));
    }
    // Remembered games move to the top of the library when played; for any
    // other game (demos included) updateGame finds no entry and does nothing.
    const [library, slots] = await Promise.all([
      r.remember
        ? remember()
        : updateGame(hash, { lastPlayedAt: Date.now() }, profile)
            .catch(() => false)
            .then((remembered) => ({ remembered })),
      states?.list() ?? Promise.resolve([]),
    ]);
    session = r.session;
    return {
      hash,
      core: module.id,
      states: slots,
      storageError: noStorage,
      battery: core!.battery,
      frameRate: core!.frameRate,
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
    use(start(previousSave));
    saves.restart();
    return { saved, frames: 0 };
  }
  core.input(neutral());
  if (r.command === "state-list")
    return { states: (await states?.list()) ?? [] };
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
    await snapshots().save(r.slot!, bytes, {
      core: module.id,
      coreVersion: module.version,
      frames: core.frames,
      preview,
    });
    // The «Continuar» card shows where the player left off.
    if (r.slot === "auto" && preview)
      await updateGame(
        hash,
        { preview, lastPlayedAt: Date.now() },
        profile,
      ).catch(() => false);
    return { ...flushed, states: await snapshots().list() };
  }
  if (r.command === "state-load") {
    const bytes = await snapshots().load(
      r.slot!,
      module.id,
      module.version,
      (id) => coreLabel(module.system, id),
    );
    core.restore(bytes);
    return { frames: core.frames, states: await snapshots().list() };
  }
  if (r.command === "state-export") {
    const record = await snapshots().record(r.slot!);
    return { stateFile: serializeState(record, module.system, hash) };
  }
  if (r.command === "state-import") {
    // Into the slot it was exported from; the panel confirms replacing it.
    const imported = await parseStateFile(r.stateFile, {
      system: module.system,
      game: hash,
      coreVersion: (id) => findCoreModule(module.system, id)?.version,
    });
    await snapshots().put(imported);
    return { states: await snapshots().list() };
  }
  if (r.command === "state-delete") {
    await snapshots().delete(r.slot!);
    return { states: await snapshots().list() };
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
    const replacement = start(save);
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
    if (request.command === "load" && !session) {
      store?.close();
      states?.close();
      core?.dispose();
      store = undefined;
      states = undefined;
      core = undefined;
      rom = undefined;
      noStorage = undefined;
    }
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
