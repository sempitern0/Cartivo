// Battery RAM commits in the background (ADR-007): frames never wait for
// IndexedDB, one write at a time, outcomes reported once.
import { test } from "node:test";
import assert from "node:assert/strict";
import { BackgroundCommit } from "../packages/storage/src/background-commit.ts";

/** A commit the test finishes by hand. */
function controlled() {
  const calls: { resolve: (v: boolean) => void; reject: (e: Error) => void }[] =
    [];
  const commit = () =>
    new Promise<boolean>((resolve, reject) => calls.push({ resolve, reject }));
  return { calls, commit };
}
const turn = () => new Promise((resolve) => setImmediate(resolve));

test("frames never wait for a slow commit, and commits never overlap", async () => {
  const slow = () =>
    new Promise<boolean>((r) => setTimeout(() => r(true), 500));
  const saves = new BackgroundCommit(slow);
  const start = performance.now();
  assert.deepEqual(saves.tick(120), { saved: false });
  assert.ok(performance.now() - start < 5, "tick returns at once");

  const { calls, commit } = controlled();
  const one = new BackgroundCommit(commit);
  one.tick(120);
  one.tick(240);
  one.tick(360);
  assert.equal(calls.length, 1, "no second write while one is in flight");
});

test("the outcome comes once, with the frame after the write", async () => {
  const { calls, commit } = controlled();
  const saves = new BackgroundCommit(commit);
  assert.deepEqual(saves.tick(10), { saved: false });
  assert.equal(calls.length, 0, "not yet 120 frames");
  saves.tick(120);
  calls[0].resolve(true);
  await turn();
  assert.deepEqual(saves.tick(121), { saved: true });
  assert.deepEqual(saves.tick(122), { saved: false }, "reported once");
  saves.tick(239);
  assert.equal(calls.length, 1, "next one 120 frames later");
  saves.tick(240);
  assert.equal(calls.length, 2);
});

test("a failed commit is reported and retried on the next tick", async () => {
  const { calls, commit } = controlled();
  const saves = new BackgroundCommit(commit);
  saves.tick(120);
  calls[0].reject(Error("Disco lleno"));
  await turn();
  assert.deepEqual(saves.tick(121), { saved: false, saveError: "Disco lleno" });
  assert.equal(calls.length, 2, "retried at once");
});

test("settle waits for the write in flight; restart counts from zero", async () => {
  const { calls, commit } = controlled();
  const saves = new BackgroundCommit(commit);
  saves.tick(120);
  let settled = false;
  const waiting = saves.settle().then(() => (settled = true));
  await turn();
  assert.equal(settled, false);
  calls[0].resolve(true);
  await waiting;
  assert.equal(settled, true);
  assert.deepEqual(saves.tick(130), { saved: true }, "kept for the next tick");
  saves.restart();
  saves.tick(60);
  assert.equal(calls.length, 1);
  saves.tick(120);
  assert.equal(calls.length, 2);
  calls[1].resolve(true);
  await saves.settle();
});
