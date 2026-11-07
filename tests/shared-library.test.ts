import { test } from "node:test";
import assert from "node:assert/strict";
import {
  publicEntry,
  overlayCatalogue,
} from "../packages/storage/src/catalogue.ts";
import { validStateMeta } from "../packages/storage/src/state-index.ts";
import { chooseResume, playLabel } from "../apps/web/src/library-view.ts";
import { system } from "../packages/runtime/src/systems.ts";
import type { StateMeta } from "../packages/storage/src/states.ts";

const title = {
  hash: "a".repeat(64),
  name: "Juego.nes",
  system: "nes",
  size: 1024,
  addedAt: 1,
  lastPlayedAt: 42,
  preview: new Uint8ClampedArray(128 * 120 * 4),
};
const nes = system("nes")!;
const saved = (slot: StateMeta["slot"], createdAt: number): StateMeta => ({
  slot,
  createdAt,
  core: nes.cores[0].id,
  coreVersion: nes.cores[0].version,
  frames: 100,
  size: 16,
});

test("the shared catalogue never exposes another profile's history or preview", () => {
  const shared = publicEntry(title);
  assert.equal(shared.lastPlayedAt, 0);
  assert.equal(shared.preview, undefined);
  const [newPlayer] = overlayCatalogue([title], []);
  assert.equal(newPlayer.lastPlayedAt, 0);
  assert.equal(newPlayer.preview, undefined);
  const [owner] = overlayCatalogue([shared], [title]);
  assert.equal(owner.lastPlayedAt, 42);
  assert.equal(owner.preview, title.preview);
  assert.deepEqual(overlayCatalogue([], [title]), []);
});

test("resume chooses a compatible auto slot, otherwise the latest compatible manual slot", () => {
  const auto = saved("auto", 1);
  const manual = saved("2", 3);
  assert.equal(chooseResume([manual, auto], nes), auto);
  assert.equal(chooseResume([saved("1", 2), manual], nes), manual);
  assert.equal(
    chooseResume([{ ...auto, coreVersion: "obsolete" }, manual], nes),
    manual,
  );
  assert.equal(chooseResume([{ ...auto, core: "missing" }], nes), undefined);
  assert.equal(chooseResume([], nes), undefined);
  assert.equal(playLabel(title), "Jugar");
  assert.equal(playLabel({ ...title, resume: auto }), "Continuar");
  assert.equal(playLabel({ ...title, resume: manual }), "Cargar partida");
});

test("invalid metadata cannot advertise an actionable snapshot", () => {
  assert.equal(validStateMeta(saved("auto", 1)), true);
  for (const value of [
    null,
    {},
    { ...saved("1", 1), slot: "4" },
    { ...saved("1", 1), frames: -1 },
    { ...saved("1", 1), size: Infinity },
    { ...saved("1", 1), createdAt: NaN },
  ])
    assert.equal(validStateMeta(value), false);
});
