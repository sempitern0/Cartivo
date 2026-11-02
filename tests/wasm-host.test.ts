// Shared host for the standalone Emscripten cores (SameBoy, mGBA, Snes9x).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
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
