// Every flow starts with the first profile picked (ADR-016), as a player who
// already answered «¿Quién juega?» in this tab. profiles.spec.ts opts out
// with test.use({ profile: "" }) (undefined would mean the default).
import { takeTurn } from "./turns.ts";
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
      const release = await takeTurn(
        heavy || testInfo.tags.includes("@heavy"),
        `${process.pid}-${testInfo.testId}-${testInfo.retry}`,
      );
      try {
        await use();
      } finally {
        await release();
      }
    },
    { auto: true, timeout: 150_000 },
  ],
  context: async ({ context, profile }, use) => {
    if (profile) await startAs(context, profile);
    await use(context);
  },
});
