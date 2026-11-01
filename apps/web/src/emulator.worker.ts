// Generic emulator Worker: one session, any registered system and core.
import { coreModule } from "../../../packages/adapters/src/registry.ts";
import type {
  CoreModule,
  EmulatorCore,
} from "../../../packages/adapters/src/contract.ts";
import { neutral } from "../../../packages/input/src/nes-input.ts";
import { SramStore, digest } from "../../../packages/storage/src/sram.ts";
import {
  StateStore,
  makePreview,
} from "../../../packages/storage/src/states.ts";
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
let session = "";
let busy = false;
let lastSaveFrame = 0;
async function flush() {
  if (core?.battery && store) {
    await store.commit(core.save());
    return true;
  }
  return false;
}
/** Battery RAM key; NES keeps its original prefix so old saves still load. */
const sramKey = (system: string, romHash: string) =>
  system === "nes" ? `nrom-sram-v1:${romHash}` : `${system}-sram-v1:${romHash}`;
async function run(r: EmuRequest): Promise<EmuResult> {
  if (r.command === "load") {
    if (core) throw Error("Ya hay un juego cargado");
    const system = r.system ?? "nes";
    // Protocol v1 without `core` meant JSNES; keep that for old clients.
    module = coreModule(system, r.core ?? (system === "nes" ? "jsnes" : ""));
    if (r.file && r.file.size > module.maxRomBytes)
      throw Error("Archivo demasiado grande para este sistema.");
    if (r.demo && !module.demo)
      throw Error("Este sistema no tiene demo integrada.");
    await module.prepare();
    rom = r.demo
      ? module.demo!()
      : new Uint8Array(await r.file!.arrayBuffer());
    module.validate(rom);
    hash = await digest(rom);
    // Per-game writer lock first: snapshots exist for every game.
    states = await StateStore.open(hash);
    // SRAM is keyed by ROM hash only, so a save moves between cores.
    use(module.create(rom));
    if (core!.battery) {
      store = await SramStore.open(sramKey(system, hash), module.sramBytes);
      const saved = await store.load();
      if (saved) use(module.create(rom, saved));
    }
    session = r.session;
    return {
      hash,
      core: module.id,
      states: await states.list(),
      battery: core!.battery,
      recovered: store?.recovered ?? false,
    };
  }
  if (!core || session !== r.session)
    throw Error("Sesión obsoleta o no cargada");
  if (r.command === "reset") {
    // Flush the previous session before replacing the CPU/PPU/APU instance.
    // A reset must not erase battery-backed SRAM or its previous generation.
    const saved = await flush();
    const previousSave = core.battery ? core.save() : undefined;
    use(module.create(rom, previousSave));
    lastSaveFrame = 0;
    return { saved, frames: 0 };
  }
  if (r.command === "advance") {
    core.input(r.input!);
    const result = {
      ...core.advance(r.count!),
      width: module.video.width,
      height: module.video.height,
    };
    let saved = false;
    let saveError: string | undefined;
    if (core.frames - lastSaveFrame >= 120) {
      try {
        saved = await flush();
        lastSaveFrame = core.frames;
      } catch (e) {
        saveError = e instanceof Error ? e.message : "Guardado fallido";
      }
    }
    return { ...result, saved, saveError };
  }
  core.input(neutral());
  if (r.command === "state-list") return { states: await states!.list() };
  if (r.command === "state-save") {
    const bytes = core.snapshot();
    // Battery RAM is committed too, so both kinds of save agree.
    let saved = false;
    try {
      saved = await flush();
    } catch {
      saved = false;
    }
    const frame = core.lastFrame();
    const { width, height } = module.video;
    await states!.save(r.slot!, bytes, {
      core: module.id,
      coreVersion: module.version,
      frames: core.frames,
      preview:
        frame.length === width * height * 4
          ? makePreview(frame, width, height)
          : undefined,
    });
    return { saved, states: await states!.list() };
  }
  if (r.command === "state-load") {
    const bytes = await states!.load(r.slot!, module.id, module.version);
    core.restore(bytes);
    return { frames: core.frames, states: await states!.list() };
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
      b.format !== "cartivo-nrom-sram-v1" ||
      b.game !== hash ||
      !Array.isArray(b.bytes) ||
      b.bytes.length !== module.sramBytes ||
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
    lastSaveFrame = 0;
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
