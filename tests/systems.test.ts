import { test } from "node:test";
import assert from "node:assert/strict";
import {
  systems,
  availableSystems,
  systemForFile,
  acceptFor,
  coreLabel,
  buttonNotes,
  controlButtons,
} from "../packages/runtime/src/systems.ts";
import * as inputModule from "../packages/input/src/nes-input.ts";
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
  assert.equal(systemForFile("Juego.GB")?.id, "gb");
  assert.equal(systemForFile("juego.gbc")?.id, "gbc");
  assert.equal(systemForFile("juego.GBA")?.id, "gba");
  assert.equal(systemForFile("juego.sfc")?.id, "snes");
  assert.equal(systemForFile("Juego.SMC")?.id, "snes");
  assert.equal(systemForFile("juego.sms")?.id, "sms");
  assert.equal(systemForFile("Juego.MD")?.id, "md");
  assert.equal(systemForFile("juego.gen")?.id, "md");
  assert.equal(systemForFile("juego.bin")?.id, "md");
  assert.equal(
    acceptFor(availableSystems()),
    ".nes,.gb,.gbc,.gba,.sfc,.smc,.sms,.md,.gen,.bin",
  );
  assert.equal(coreLabel("md", "genesis-plus-gx"), "Genesis Plus GX");
  assert.equal(coreLabel("snes", "snes9x"), "Snes9x");
  assert.equal(coreLabel("gba", "mgba"), "mGBA");
  assert.equal(coreLabel("nes", "tetanes"), "TetaNES");
  assert.equal(coreLabel("gbc", "sameboy"), "SameBoy");
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

test("each system runs at its own hardware frame rate", () => {
  for (const s of systems) assert.ok(s.frameRate > 30 && s.frameRate <= 75);
  assert.equal(systems.find((s) => s.id === "nes")?.frameRate, 60);
  // DMG/CGB: 4 194 304 Hz clock, 70 224 cycles per frame ≈ 59.73 fps.
  assert.ok(
    Math.abs((systems.find((s) => s.id === "gb")?.frameRate ?? 0) - 59.7275) <
      0.001,
  );
  // GBA: 16 777 216 Hz clock, 280 896 cycles per frame, also ≈ 59.73 fps.
  assert.ok(
    Math.abs((systems.find((s) => s.id === "gba")?.frameRate ?? 0) - 59.7275) <
      0.001,
  );
});

test("each system declares the buttons of its controller", () => {
  const actions: readonly string[] = inputModule.actions;
  for (const s of availableSystems()) {
    assert.ok(s.buttons.length >= 2, s.id);
    for (const b of s.buttons) assert.ok(actions.includes(b), `${s.id}: ${b}`);
    assert.ok(
      !s.buttons.some((b) => ["up", "down", "left", "right"].includes(b)),
      "the D-pad is implicit",
    );
  }
  assert.deepEqual(controlButtons(["l", "a", "r"]), ["l", "a", "r"]);
  assert.deepEqual(
    buttonNotes((a) => a.toUpperCase()),
    [
      "L y R solo los usan Game Boy Advance, SNES y Mega Drive.",
      "X e Y solo los usan SNES y Mega Drive.",
      "En Master System, 1, 2 y Pause están en B, A y START.",
      "En Mega Drive, A, B, C, X, Y, Z y Mode están en Y, B, A, L, X, R y SELECT.",
    ],
  );
});
