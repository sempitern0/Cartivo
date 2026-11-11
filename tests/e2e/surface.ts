import { inflateSync } from "node:zlib";
import { expect, type Page } from "./fixtures.ts";
import { startDemo } from "./play.ts";

// What the specs of the cores that draw on the game canvas share (ADR-017):
// the page cannot read those pixels, so the oracle is a screenshot.

/**
 * Starts the demo and says whether this engine can play it. The core needs
 * WebGL2 inside a Worker; where there is none, the player says why instead
 * of failing silently. Decided by what the app does, not by a Worker made
 * here: the built app's policy refuses blob: workers (ADR-021).
 */
export async function demoStarts(page: Page, console: string) {
  await startDemo(page, console);
  const refused = page.getByRole("alert").filter({ hasText: "WebGL2" });
  const started = async () =>
    (await page.getByTestId("player-phase").textContent())?.includes(
      "Jugando",
    ) ||
    (await page.getByRole("button", { name: "Empezar de nuevo" }).count()) > 0;
  await expect
    .poll(async () => (await refused.count()) > 0 || (await started()), {
      timeout: 15000,
    })
    .toBe(true);
  return (await refused.count()) === 0;
}

/** RGB at the centre of a PNG screenshot (8-bit RGB/RGBA, no interlace). */
function centre(png: Buffer): number[] {
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  const channels = png[25] === 6 ? 4 : 3;
  const chunks: Buffer[] = [];
  for (let at = 8; at < png.length; ) {
    const length = png.readUInt32BE(at);
    if (png.toString("latin1", at + 4, at + 8) === "IDAT")
      chunks.push(png.subarray(at + 8, at + 8 + length));
    at += length + 12;
  }
  const data = inflateSync(Buffer.concat(chunks));
  const stride = width * channels;
  let previous = Buffer.alloc(stride);
  let row = previous;
  for (let y = 0; y <= height >> 1; y++) {
    const line = data.subarray(y * (stride + 1), (y + 1) * (stride + 1));
    row = Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? row[x - channels] : 0;
      const b = previous[x];
      const c = x >= channels ? previous[x - channels] : 0;
      const p = a + b - c;
      const paeth =
        Math.abs(p - a) <= Math.abs(p - b) && Math.abs(p - a) <= Math.abs(p - c)
          ? a
          : Math.abs(p - b) <= Math.abs(p - c)
            ? b
            : c;
      const predictor = [0, a, b, (a + b) >> 1, paeth][line[0]];
      row[x] = (line[x + 1] + predictor) & 0xff;
    }
    previous = row;
  }
  const at = (width >> 1) * channels;
  return [row[at], row[at + 1], row[at + 2]];
}

/** Whether the centre of the game canvas shows `rgb` (within 12). */
export const shows = async (page: Page, rgb: readonly number[]) => {
  const pixel = centre(await page.locator("canvas").screenshot());
  return pixel.every((v, i) => Math.abs(v - rgb[i]) <= 12);
};
