// Shared host for the standalone Emscripten cores (SameBoy, mGBA, Snes9x,
// Genesis Plus GX).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  compileFrom,
  CoreDownloadError,
  unsupportedImports,
  wasmLoader,
} from "../packages/adapters/src/wasm-host.ts";
import {
  SameBoyAdapter,
  prepareSameBoy,
  provideSameBoyBinary,
} from "../packages/adapters/src/sameboy.ts";
import {
  MgbaAdapter,
  prepareMgba,
  provideMgbaBinary,
} from "../packages/adapters/src/mgba.ts";
import {
  Snes9xAdapter,
  prepareSnes9x,
  provideSnes9xBinary,
} from "../packages/adapters/src/snes9x.ts";
import { snesControlDemo } from "../packages/fixtures/src/snes-control-demo.ts";
import {
  GenesisPlusGxAdapter,
  prepareGenesis,
  provideGenesisBinary,
} from "../packages/adapters/src/genesis-plus-gx.ts";
import { mdControlDemo } from "../packages/fixtures/src/md-control-demo.ts";
import { gbControlDemo } from "../packages/fixtures/src/gb-control-demo.ts";
import { gbaControlDemo } from "../packages/fixtures/src/gba-control-demo.ts";

const sameboy = readFileSync(
  new URL("../cores/sameboy/dist/sameboy.wasm", import.meta.url),
);
const mgba = readFileSync(
  new URL("../cores/mgba/dist/mgba.wasm", import.meta.url),
);
provideSameBoyBinary(sameboy);
const snes9x = readFileSync(
  new URL("../cores/snes9x/dist/snes9x.wasm", import.meta.url),
);
provideMgbaBinary(mgba);
provideSnes9xBinary(snes9x);
const genesis = readFileSync(
  new URL(
    "../cores/genesis-plus-gx/dist/genesis-plus-gx.wasm",
    import.meta.url,
  ),
);
provideGenesisBinary(genesis);

/** Smallest module importing one function the host does not offer. */
const mystery = Uint8Array.from([
  0x00,
  0x61,
  0x73,
  0x6d,
  0x01,
  0x00,
  0x00,
  0x00, // magic, version 1
  0x01,
  0x04,
  0x01,
  0x60,
  0x00,
  0x00, // type section: () -> ()
  0x02,
  0x0f,
  0x01,
  0x03,
  0x65,
  0x6e,
  0x76, // import section: "env"
  0x07,
  0x6d,
  0x79,
  0x73,
  0x74,
  0x65,
  0x72,
  0x79,
  0x00,
  0x00, // "mystery"
]);

test("committed cores only import what the host provides", async () => {
  assert.deepEqual(unsupportedImports(await WebAssembly.compile(sameboy)), []);
  assert.deepEqual(unsupportedImports(await WebAssembly.compile(mgba)), []);
  assert.deepEqual(unsupportedImports(await WebAssembly.compile(snes9x)), []);
  assert.deepEqual(unsupportedImports(await WebAssembly.compile(genesis)), []);
});

test("a core needing an unknown import is refused by name", async () => {
  const loader = wasmLoader("Prueba", new URL("file:///nowhere.wasm"));
  loader.provide(mystery);
  await assert.rejects(loader.prepare(), /env\.mystery/);
  assert.throws(() => loader.module(), /no está preparado/);
});

for (const { name, prepare, make } of [
  {
    name: "SameBoy",
    prepare: prepareSameBoy,
    make: () => new SameBoyAdapter(gbControlDemo(true)),
  },
  {
    name: "mGBA",
    prepare: prepareMgba,
    make: () => new MgbaAdapter(gbaControlDemo()),
  },
  {
    name: "Snes9x",
    prepare: prepareSnes9x,
    make: () => new Snes9xAdapter(snesControlDemo()),
  },
  {
    name: "Genesis Plus GX",
    prepare: prepareGenesis,
    make: () => new GenesisPlusGxAdapter("md", mdControlDemo()),
  },
]) {
  test(`${name}: bad states and closed cores fail safely`, async () => {
    await prepare();
    const core = make();
    core.advance(3);
    const state = core.snapshot();
    // A state of the wrong size is refused and the core keeps running.
    assert.throws(() => core.restore(state.subarray(0, 100)), /dañada/);
    assert.equal(core.advance(1).frames, 4);
    core.restore(state);
    // After dispose every call refuses instead of touching freed memory.
    core.dispose();
    core.dispose(); // idempotent
    assert.throws(() => core.advance(1), /cerrado/);
    assert.throws(() => core.save(), /cerrado/);
    assert.throws(() => core.snapshot(), /cerrado/);
    assert.throws(() => core.lastFrame(), /cerrado/);
    // A fresh instance works: nothing is shared between games.
    const next = make();
    assert.equal(next.advance(2).frames, 2);
    next.dispose();
  });
}

test("libretro cores report each game's cadence: PAL at 50 Hz", async () => {
  await prepareSnes9x();
  await prepareGenesis();
  await prepareSameBoy();
  const rate = (core: { frameRate?: number; dispose(): void }) => {
    const value = core.frameRate;
    core.dispose();
    return value;
  };
  const near = (value: number | undefined, expected: number) =>
    assert.ok(
      value !== undefined && Math.abs(value - expected) < 0.01,
      `${value} ≈ ${expected}`,
    );
  // Master clock / (cycles per line × lines per frame), as each core says.
  near(rate(new Snes9xAdapter(snesControlDemo())), 21477272 / 357366);
  near(
    rate(new Snes9xAdapter(snesControlDemo({ pal: true }))),
    21281370 / 425568,
  );
  near(
    rate(new GenesisPlusGxAdapter("md", mdControlDemo())),
    53693175 / (3420 * 262),
  );
  near(
    rate(new GenesisPlusGxAdapter("md", mdControlDemo({ pal: true }))),
    53203424 / (3420 * 313),
  );
  // Without the export the system's nominal rate applies.
  assert.equal(rate(new SameBoyAdapter(gbControlDemo(true))), undefined);
});

test("a core served with the wrong MIME type still compiles; a failed download says so", async () => {
  const bytes = readFileSync(
    new URL("../cores/sameboy/dist/sameboy.wasm", import.meta.url),
  );
  const url = new URL("https://cartivo.test/sameboy.wasm");
  const wrongMime = async () =>
    new Response(bytes, { headers: { "content-type": "text/plain" } });
  const module = await compileFrom("SameBoy", url, wrongMime as typeof fetch);
  assert.ok(WebAssembly.Module.exports(module).length > 0);

  const missing = async () => new Response("", { status: 404 });
  await assert.rejects(
    compileFrom("SameBoy", url, missing as typeof fetch),
    (error: Error) =>
      error instanceof CoreDownloadError &&
      /descargar el núcleo SameBoy/.test(error.message),
  );
  const offline = async () => {
    throw new TypeError("Failed to fetch");
  };
  await assert.rejects(
    compileFrom("SameBoy", url, offline as typeof fetch),
    CoreDownloadError,
  );
});
