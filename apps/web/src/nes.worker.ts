import {
  NesAdapter,
  MAX_ROM_BYTES,
} from "../../../packages/adapters/src/jsnes.ts";
import { controlDemo } from "../../../packages/fixtures/src/control-demo.ts";
import { neutral } from "../../../packages/input/src/nes-input.ts";
import { SramStore, digest } from "../../../packages/storage/src/sram.ts";
import {
  parseNesRequest,
  type NesRequest,
  type NesResult,
} from "../../../packages/runtime/src/nes-protocol.ts";
const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent) => void) | null;
  postMessage: (value: unknown, transfer: Transferable[]) => void;
};
let core: NesAdapter | undefined;
let store: SramStore | undefined;
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
async function run(r: NesRequest): Promise<NesResult> {
  if (r.command === "load") {
    if (core) throw Error("Ya hay un juego cargado");
    if (r.file && r.file.size > MAX_ROM_BYTES)
      throw Error("Este incremento admite solo NROM de hasta 32 KB PRG.");
    rom = r.demo ? controlDemo() : new Uint8Array(await r.file!.arrayBuffer());
    hash = await digest(rom);
    core = new NesAdapter(rom);
    if (core.battery) {
      store = await SramStore.open("nrom-sram-v1:" + hash);
      const saved = await store.load();
      if (saved) core = new NesAdapter(rom, saved);
    }
    session = r.session;
    return {
      hash,
      battery: core.battery,
      recovered: store?.recovered ?? false,
    };
  }
  if (!core || session !== r.session)
    throw Error("Sesión obsoleta o no cargada");
  if (r.command === "advance") {
    core.input(r.input!);
    const result = core.advance(r.count!);
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
      b.bytes.length !== 8192 ||
      b.bytes.some((v) => !Number.isInteger(v) || v < 0 || v > 255)
    )
      throw Error(
        "La copia no pertenece a este juego o tiene un formato incompatible",
      );
    const save = Uint8Array.from(b.bytes);
    if ((await digest(save)) !== b.sha256)
      throw Error("La copia de partida está dañada");
    const replacement = new NesAdapter(rom, save);
    await store.commit(save);
    core = replacement;
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
  let request: NesRequest;
  try {
    request = parseNesRequest(event.data);
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
