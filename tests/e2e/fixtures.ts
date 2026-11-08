// Every flow starts with the first profile picked (ADR-016), as a player who
// already answered «¿Quién juega?» in this tab. profiles.spec.ts opts out
// with test.use({ profile: "" }) (undefined would mean the default).
import { mkdir, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test as base, type BrowserContext } from "@playwright/test";
export { expect, type Page } from "@playwright/test";

/** New tabs of this context start as `profile` (unless one was picked). */
export const startAs = (context: BrowserContext, profile = "principal") =>
  context.addInitScript((id) => {
    try {
      if (!sessionStorage.getItem("cartivo:profile:active"))
        sessionStorage.setItem("cartivo:profile:active", id);
    } catch {
      // No sessionStorage (opaque origin): the picker shows.
    }
  }, profile);

/**
 * Heavy tests (N64 drawing with WebGL2 in software, PS1 discs, the 100
 * cycles) take turns across workers: two at once starve the CPU of a CI
 * runner and time out. A file uses `test.use({ heavy: true })`, a single
 * test the tag `@heavy`. mkdir is atomic; after two minutes of waiting the
 * lock is taken as left by a crashed worker and the test goes ahead.
 */
const LOCK = join(tmpdir(), "cartivo-e2e-heavy.lock");
async function takeTurn() {
  const started = Date.now();
  for (;;) {
    try {
      await mkdir(LOCK);
      return;
    } catch {
      if (Date.now() - started > 120_000) return;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
}

export const test = base.extend<{
  profile: string;
  heavy: boolean;
  turn: void;
}>({
  profile: ["principal", { option: true }],
  heavy: [false, { option: true }],
  // Its own timeout: waiting for a turn does not eat the test's.
  turn: [
    async ({ heavy }, use, testInfo) => {
      const mine = heavy || testInfo.tags.includes("@heavy");
      if (mine) await takeTurn();
      try {
        await use();
      } finally {
        if (mine) await rmdir(LOCK).catch(() => {});
      }
    },
    { auto: true, timeout: 150_000 },
  ],
  context: async ({ context, profile }, use) => {
    if (profile) await startAs(context, profile);
    await use(context);
  },
});
