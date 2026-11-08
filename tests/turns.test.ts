// E2E turns (tests/e2e/turns.ts): heavy tests never overlap anything else.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.CARTIVO_TURNS_DIR = mkdtempSync(join(tmpdir(), "turns-"));
const { takeTurn } = await import("./e2e/turns.ts");

test("a heavy test waits for running tests and runs alone", async () => {
  const log: string[] = [];
  const run = async (name: string, heavy: boolean, ms: number) => {
    const release = await takeTurn(heavy, name);
    log.push(`${name}+`);
    await new Promise((resolve) => setTimeout(resolve, ms));
    log.push(`${name}-`);
    await release();
  };
  const a = run("a", false, 150);
  await new Promise((resolve) => setTimeout(resolve, 20));
  const h = run("h", true, 150);
  await new Promise((resolve) => setTimeout(resolve, 20));
  const b = run("b", false, 50);
  await Promise.all([a, h, b]);
  // h starts after a ends; b, arriving while h waits, goes after h.
  assert.deepEqual(log, ["a+", "a-", "h+", "h-", "b+", "b-"]);
});
