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
import { readFileSync, readdirSync } from "node:fs";

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

test("the manifest opens exactly the extensions of available systems", () => {
  const manifest = JSON.parse(
    readFileSync("apps/web/public/manifest.webmanifest", "utf8"),
  ) as { file_handlers: { accept: Record<string, string[]> }[] };
  const handled = manifest.file_handlers.flatMap((h) =>
    Object.values(h.accept).flat(),
  );
  const offered = availableSystems().flatMap((s) => s.extensions);
  assert.deepEqual(handled.sort(), offered.sort());
});

// The interface takes everything system-specific from systems.ts, so adding
// a console must not need `if (system === "gb")` branches in the UI. The
// worker is exempt only for the protocol v1 default (no system means NES).
test("the interface has no hard-coded system ids", () => {
  const dir = "apps/web/src";
  for (const file of readdirSync(dir)) {
    if (!/\.(svelte|ts)$/.test(file) || file === "emulator.worker.ts") continue;
    const source = readFileSync(`${dir}/${file}`, "utf8");
    for (const s of systems)
      assert.doesNotMatch(source, new RegExp(`["'\`]${s.id}["'\`]`), file);
    assert.doesNotMatch(source, /NES_VIDEO|cartivo-nrom|nrom-sram/, file);
  }
});
