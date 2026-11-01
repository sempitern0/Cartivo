import { test } from "node:test";
import assert from "node:assert/strict";
import {
  systems,
  availableSystems,
  systemForFile,
  acceptFor,
  coreLabel,
} from "../packages/runtime/src/systems.ts";
import { coreModules } from "../packages/adapters/src/registry.ts";

test("system ids and extensions are unique", () => {
  assert.equal(new Set(systems.map((s) => s.id)).size, systems.length);
  const extensions = systems.flatMap((s) => s.extensions);
  assert.equal(new Set(extensions).size, extensions.length);
  for (const ext of extensions) assert.match(ext, /^\.[a-z0-9]+$/);
});

test("every core the UI offers exists in the worker registry", () => {
  for (const s of systems) {
    assert.ok(
      s.cores.some((c) => c.id === s.defaultCore),
      `${s.id} default`,
    );
    for (const core of s.cores) {
      const module = coreModules.find(
        (m) => m.system === s.id && m.id === core.id,
      );
      assert.ok(module, `${s.id}/${core.id} registered`);
      assert.equal(module!.version, core.version, `${s.id}/${core.id} version`);
      assert.equal(module!.video.width, s.video.sourceWidth);
      assert.equal(module!.video.height, s.video.sourceHeight);
      if (s.demo) assert.ok(module!.demo, `${s.id}/${core.id} demo`);
    }
  }
  for (const m of coreModules)
    assert.ok(
      systems.find((s) => s.id === m.system)?.cores.some((c) => c.id === m.id),
      `${m.system}/${m.id} visible in systems.ts`,
    );
});

test("files are routed by extension", () => {
  assert.equal(systemForFile("Contra (USA).NES")?.id, "nes");
  assert.equal(systemForFile("notes.txt"), undefined);
  assert.equal(acceptFor(availableSystems()), ".nes");
  assert.equal(coreLabel("nes", "tetanes"), "TetaNES");
});
