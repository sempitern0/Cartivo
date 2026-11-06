// Every flow starts with the first profile picked (ADR-016), as a player who
// already answered «¿Quién juega?» in this tab. profiles.spec.ts opts out
// with test.use({ profile: undefined }).
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

export const test = base.extend<{ profile: string | undefined }>({
  profile: ["principal", { option: true }],
  context: async ({ context, profile }, use) => {
    if (profile) await startAs(context, profile);
    await use(context);
  },
});
