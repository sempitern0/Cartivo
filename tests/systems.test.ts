import { test } from "node:test";
import assert from "node:assert/strict";
import {
  systems,
  availableSystems,
  gameForFiles,
  system,
  acceptFor,
  coreLabel,
  buttonGuide,
  controlButtons,
} from "../packages/runtime/src/systems.ts";
import * as inputModule from "../packages/input/src/nes-input.ts";
import { coreModules } from "../packages/adapters/src/registry.ts";
import { existsSync, readFileSync, readdirSync } from "node:fs";

test("system ids and extensions are unique", () => {
  assert.equal(new Set(systems.map((s) => s.id)).size, systems.length);
  // Only .bin is shared (Mega Drive cartridge or CD track): gameForFiles
  // tells them apart.
  const extensions = systems
    .flatMap((s) => s.extensions)
    .filter((e) => e !== ".bin");
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
  const systemFor = (name: string, size = 1024) =>
    gameForFiles([{ name, size }])?.system.id;
  assert.equal(systemFor("Contra (USA).NES"), "nes");
  assert.equal(systemFor("notes.txt"), undefined);
  assert.equal(systemFor("Juego.GB"), "gb");
  assert.equal(systemFor("juego.gbc"), "gbc");
  assert.equal(systemFor("juego.GBA"), "gba");
  assert.equal(systemFor("juego.sfc"), "snes");
  assert.equal(systemFor("Juego.SMC"), "snes");
  assert.equal(systemFor("juego.sms"), "sms");
  assert.equal(systemFor("Juego.MD"), "md");
  assert.equal(systemFor("juego.gen"), "md");
  assert.equal(systemFor("Juego.CUE"), "ps1");
  assert.equal(systemFor("juego.iso"), "ps1");
  assert.equal(systemFor("demo.exe"), "ps1");
  // A lone .bin: a cartridge up to Mega Drive's limit, beyond it a CD track.
  assert.equal(systemFor("juego.bin"), "md");
  assert.equal(systemFor("juego.bin", 300 * 1024 * 1024), "ps1");
});

test("a disc's .cue is booted with its tracks, whatever the order", () => {
  const cue = { name: "Juego.cue", size: 200 };
  const tracks = [
    { name: "Juego (Track 1).bin", size: 1024 },
    { name: "Juego (Track 2).bin", size: 1024 },
  ];
  const found = gameForFiles([tracks[0], cue, tracks[1]]);
  assert.equal(found?.system.id, "ps1");
  assert.equal(found?.file, cue);
  assert.deepEqual(found?.extra, tracks);
  // The PlayStation card's picker boots a lone .bin as a disc.
  assert.equal(gameForFiles([tracks[0]], system("ps1"))?.system.id, "ps1");
  // Cartridges never carry extra files.
  assert.deepEqual(gameForFiles([{ name: "a.nes", size: 1 }])?.extra, []);
});

test("pickers accept every available format and cores have short names", () => {
  assert.equal(
    acceptFor(availableSystems()),
    ".nes,.gb,.gbc,.gba,.sfc,.smc,.sms,.md,.gen,.bin,.m3u,.cue,.chd,.iso,.exe,.z64,.n64,.v64",
  );
  assert.equal(coreLabel("md", "genesis-plus-gx"), "Genesis Plus GX");
  assert.equal(coreLabel("snes", "snes9x"), "Snes9x");
  assert.equal(coreLabel("gba", "mgba"), "mGBA");
  assert.equal(coreLabel("nes", "tetanes"), "TetaNES");
  assert.equal(coreLabel("gbc", "sameboy"), "SameBoy");
  assert.equal(coreLabel("n64", "mupen64plus-next"), "Mupen64Plus-Next");
});

test("the manifest opens the extensions of available systems", () => {
  const manifest = JSON.parse(
    readFileSync("apps/web/public/manifest.webmanifest", "utf8"),
  ) as { file_handlers: { accept: Record<string, string[]> }[] };
  const handled = manifest.file_handlers.flatMap((h) =>
    Object.values(h.accept).flat(),
  );
  // Generic formats (any disc image, any Windows program, music playlists)
  // are opened from the app, never claimed in the operating system.
  const generic = [".iso", ".exe", ".m3u"];
  const offered = new Set(availableSystems().flatMap((s) => s.extensions));
  assert.deepEqual(
    handled.sort(),
    [...offered].filter((e) => !generic.includes(e)).sort(),
  );
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
  const guide = buttonGuide((a) => a.toUpperCase());
  assert.deepEqual(guide.minority, [
    "X e Y solo los usan SNES, Mega Drive, PlayStation y N64.",
    "L2 y R2 solo los usan PlayStation y N64.",
  ]);
  const where = (name: string) =>
    guide.consoles
      .find((c) => c.name === name)
      ?.pairs.map(({ own, key }) => `${own}=${key}`)
      .join(" ");
  assert.deepEqual(
    guide.consoles.map((c) => c.name),
    ["Master System", "Mega Drive", "PlayStation", "N64"],
  );
  assert.equal(where("Master System"), "1=B 2=A Pause=START");
  assert.equal(where("Mega Drive"), "A=Y B=B C=A X=L Y=X Z=R Mode=SELECT");
  assert.equal(
    where("PlayStation"),
    "Cruz=B Círculo=A Cuadrado=Y Triángulo=X L1=L R1=R",
  );
  assert.equal(where("N64"), "A=B B=Y Z=L2 L=SELECT R=R2 C↑=X C↓=A C←=L C→=R");
});

test("license links are relative to the app's base and exist", () => {
  for (const s of systems)
    for (const core of s.cores)
      for (const { href } of core.licenses) {
        assert.ok(!href.startsWith("/"), `${href} is base-relative`);
        assert.ok(existsSync(`apps/web/public/${href}`), `${href} exists`);
      }
});
