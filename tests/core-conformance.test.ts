// Every registered core must pass this battery before it ships
// (docs/ADDING_A_SYSTEM.md). It only uses the CoreModule contract.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { initSync } from "../cores/tetanes/dist/tetanes.js";
import { coreModules } from "../packages/adapters/src/registry.ts";
import { provideSameBoyBinary } from "../packages/adapters/src/sameboy.ts";
import { provideMgbaBinary } from "../packages/adapters/src/mgba.ts";
import { provideSnes9xBinary } from "../packages/adapters/src/snes9x.ts";
import { provideGenesisBinary } from "../packages/adapters/src/genesis-plus-gx.ts";
import { providePcsxBinary } from "../packages/adapters/src/pcsx-rearmed.ts";
import { DiscImage } from "../packages/adapters/src/disc.ts";
import type {
  CoreModule,
  EmulatorCore,
} from "../packages/adapters/src/contract.ts";
import { neutral } from "../packages/input/src/nes-input.ts";

// Node cannot fetch file URLs: instantiate wasm cores up front so their
// prepare() finds them ready (wasm-bindgen init returns the live module).
initSync({
  module: readFileSync(
    new URL("../cores/tetanes/dist/tetanes_bg.wasm", import.meta.url),
  ),
});
provideSameBoyBinary(
  readFileSync(new URL("../cores/sameboy/dist/sameboy.wasm", import.meta.url)),
);
provideMgbaBinary(
  readFileSync(new URL("../cores/mgba/dist/mgba.wasm", import.meta.url)),
);
provideSnes9xBinary(
  readFileSync(new URL("../cores/snes9x/dist/snes9x.wasm", import.meta.url)),
);
provideGenesisBinary(
  readFileSync(
    new URL(
      "../cores/genesis-plus-gx/dist/genesis-plus-gx.wasm",
      import.meta.url,
    ),
  ),
);

providePcsxBinary(
  readFileSync(
    new URL("../cores/pcsx-rearmed/dist/pcsx-rearmed.wasm", import.meta.url),
  ),
);

/** A disc of in-memory files (Node has no FileReaderSync). */
function memoryDisc(files: { name: string; bytes: Uint8Array }[]) {
  const parts = files.map(({ name, bytes }) => ({
    name,
    blob: new Blob([bytes as BlobPart]),
  }));
  const bytes = new Map(parts.map((p, i) => [p.blob, files[i].bytes]));
  return new DiscImage(parts, parts[0], (blob, start, end) =>
    bytes.get(blob)!.slice(start, end),
  );
}

/** Boots the module's demo; unsupported games are refused with a reason. */
function bootDemo(module: FramebufferModule): EmulatorCore {
  if (module.disc) {
    const text =
      'FILE "missing.bin" BINARY\n  TRACK 01 MODE2/2352\n    INDEX 01 00:00:00\n';
    const broken = {
      name: "broken.cue",
      bytes: new TextEncoder().encode(text),
    };
    assert.throws(() => module.create(memoryDisc([broken])), /disco/);
    return module.create(memoryDisc([module.demo!()]));
  }
  const rom = module.demo!();
  assert.doesNotThrow(() => module.validate(rom));
  assert.throws(() => module.validate(new Uint8Array(16)));
  return module.create(rom);
}

/** Cores that return RGBA; the ones that draw with WebGL2 (SurfaceModule)
 * need a browser and are covered by their E2E (tests/e2e/n64.spec.ts). */
type FramebufferModule = Exclude<CoreModule, { surface: "webgl2" }>;
const framebufferModules = coreModules.filter(
  (m): m is FramebufferModule => !m.surface,
);

const hash = (b: Uint8ClampedArray) =>
  createHash("sha256").update(b).digest("hex");

for (const module of framebufferModules) {
  test(`${module.system}/${module.id} ${module.version} conforms to the core contract`, async () => {
    assert.ok(
      module.demo,
      "every core ships an original fixture for this test",
    );
    await module.prepare();
    const core = bootDemo(module);
    const { width, height } = module.video;

    // Boots (Game Boy Color's boot ROM takes about 4 s) and presents
    // frames of the declared size.
    let frame = core.advance(3);
    for (let i = 0; i < 99; i++) frame = core.advance(3);
    assert.equal(frame.pixels!.length, width * height * 4);
    assert.ok(new Set(new Uint32Array(frame.pixels!.buffer)).size >= 2);
    assert.equal(frame.frames, core.frames);
    assert.throws(() => core.advance(4));

    // Input changes the picture; audio stays finite and bounded.
    const before = hash(frame.pixels!);
    core.input({ ...neutral(), right: true, b: true });
    for (let i = 0; i < 10; i++) {
      frame = core.advance(2);
      assert.ok(frame.audio.length <= 48000);
      for (const v of frame.audio) assert.ok(Number.isFinite(v));
    }
    assert.notEqual(hash(frame.pixels!), before);
    assert.equal(core.lastFrame().length, width * height * 4);

    // Battery RAM has the size the core reports for this cartridge.
    assert.ok(Number.isInteger(core.saveBytes) && core.saveBytes >= 0);
    assert.equal(core.save().length, core.saveBytes);

    // Snapshots are deterministic and corrupt ones are rejected.
    const input = { ...neutral(), down: true };
    core.input(input);
    const state = core.snapshot();
    const reference = hash(core.advance(3).pixels!);
    core.input({ ...neutral(), up: true, left: true });
    for (let i = 0; i < 10; i++) core.advance(3);
    core.restore(state);
    core.input(input);
    assert.equal(hash(core.advance(3).pixels!), reference);
    assert.throws(() => core.restore(new Uint8Array([0, 1, 2])));

    core.dispose();
  });
}
