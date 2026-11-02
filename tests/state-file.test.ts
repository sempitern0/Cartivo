// Exported «Partidas» (ADR-009): round trip and every refusal reason.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_STATE_FILE,
  parseStateFile,
  serializeState,
  stateFileName,
  STATE_FILE_FORMAT,
} from "../packages/storage/src/state-file.ts";
import { digest } from "../packages/storage/src/sram.ts";
import {
  MAX_STATE_BYTES,
  PREVIEW_HEIGHT,
  PREVIEW_WIDTH,
} from "../packages/storage/src/states.ts";

const game = "a".repeat(64);
const versions: Record<string, string> = { tetanes: "0.17.0", jsnes: "2.1.0" };
const expect = {
  system: "nes",
  game,
  coreVersion: (core: string) => versions[core],
};

async function stored(preview = true) {
  const bytes = Uint8Array.from({ length: 70_000 }, (_, i) => (i * 7) & 255);
  return {
    meta: {
      slot: "2" as const,
      core: "tetanes",
      coreVersion: "0.17.0",
      frames: 1234,
      createdAt: 1_700_000_000_000,
      size: bytes.length,
      ...(preview
        ? {
            preview: new Uint8ClampedArray(
              PREVIEW_WIDTH * PREVIEW_HEIGHT * 4,
            ).fill(9),
          }
        : {}),
    },
    bytes,
    sha256: await digest(bytes),
  };
}

test("a snapshot survives export and import exactly", async () => {
  for (const preview of [true, false]) {
    const record = await stored(preview);
    const file = serializeState(record, "nes", game);
    assert.equal(file.format, STATE_FILE_FORMAT);
    // Through JSON, as the file really travels.
    const back = await parseStateFile(JSON.parse(JSON.stringify(file)), expect);
    assert.deepEqual(back, record);
  }
});

test("another core of the same system is accepted (the player can switch)", async () => {
  const record = await stored();
  const file = serializeState(
    {
      ...record,
      meta: { ...record.meta, core: "jsnes", coreVersion: "2.1.0" },
    },
    "nes",
    game,
  );
  assert.equal((await parseStateFile(file, expect)).meta.core, "jsnes");
});

test("foreign, outdated, damaged or malformed files are refused with a reason", async () => {
  const file = serializeState(await stored(), "nes", game);
  const refuse = (value: unknown, reason: RegExp) =>
    assert.rejects(parseStateFile(value, expect), reason);
  await refuse(null, /no es una partida de Cartivo/);
  await refuse({ ...file, format: "cartivo-state-v0" }, /no es una partida/);
  await refuse({ ...file, game: "b".repeat(64) }, /otro juego/);
  await refuse({ ...file, system: "gb" }, /otro juego/);
  await refuse(
    { ...file, coreVersion: "0.16.0" },
    /otra versión del núcleo \(0\.16\.0\)/,
  );
  await refuse({ ...file, core: "mesen" }, /núcleo que este sistema no tiene/);
  await refuse({ ...file, sha256: "0".repeat(64) }, /dañada/);
  await refuse({ ...file, bytes: "%%%" }, /dañada/);
  await refuse({ ...file, slot: "9" }, /formato incompatible/);
  await refuse({ ...file, frames: -1 }, /formato incompatible/);
  await refuse({ ...file, preview: btoa("short") }, /formato incompatible/);
  await refuse(
    { ...file, bytes: "A".repeat(Math.ceil((MAX_STATE_BYTES * 4) / 3) + 8) },
    /formato incompatible/,
  );
  assert.ok(MAX_STATE_FILE > (MAX_STATE_BYTES * 4) / 3);
});

test("file names say system, slot and time", () => {
  const time = new Date(2026, 10, 2, 9, 5).getTime();
  assert.equal(
    stateFileName("snes", "1", time),
    "cartivo-snes-ranura-1-20261102-0905.json",
  );
  assert.equal(
    stateFileName("md", "auto", time),
    "cartivo-md-al-salir-20261102-0905.json",
  );
});
