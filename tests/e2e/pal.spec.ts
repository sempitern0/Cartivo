// PAL cartridges (SNES and Mega Drive) run at the game's own 50 Hz, as the
// core reports it, instead of the system's nominal ~60 Hz. Own fixtures with
// the region set to Europe; no third-party ROM.
import { expect, test, type Page } from "@playwright/test";
import { frames, playing } from "./play.ts";

async function drop(page: Page, name: string, rom: Uint8Array) {
  const transfer = await page.evaluateHandle(
    ([name, bytes]) => {
      const dt = new DataTransfer();
      dt.items.add(new File([new Uint8Array(bytes)], name));
      return dt;
    },
    [name, Array.from(rom)] as const,
  );
  await page.dispatchEvent("body", "dragover", { dataTransfer: transfer });
  await page.dispatchEvent("body", "drop", { dataTransfer: transfer });
}

/** Emulated frames per second over a few seconds of play. */
async function measuredRate(page: Page, ms = 3000) {
  const before = await frames(page);
  await page.waitForTimeout(ms);
  return ((await frames(page)) - before) / (ms / 1000);
}

for (const { system, file, make, hz } of [
  {
    system: "SNES",
    file: "demo-pal.sfc",
    hz: "50,01",
    make: async () =>
      (
        await import("../../packages/fixtures/src/snes-control-demo.ts")
      ).snesControlDemo({ pal: true }),
  },
  {
    system: "Mega Drive",
    file: "demo-pal.md",
    hz: "49,7",
    make: async () =>
      (
        await import("../../packages/fixtures/src/md-control-demo.ts")
      ).mdControlDemo({ pal: true }),
  },
]) {
  test(`a PAL ${system} cartridge runs at 50 Hz`, async ({ page }) => {
    await page.goto("/");
    await drop(page, file, await make());
    await playing(page);
    await expect(page.getByTestId("frame-rate")).toContainText(
      `${hz} Hz (PAL)`,
    );
    // At the nominal rate it would be ~60; a slow runner only lowers it.
    expect(await measuredRate(page)).toBeLessThan(55);
  });
}
