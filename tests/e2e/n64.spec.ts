import { inflateSync } from "node:zlib";
import { test, expect, type Page } from "./fixtures.ts";
import { playDemo } from "./play.ts";

// Nintendo 64 runs Mupen64Plus-Next, whose GLideN64 draws with WebGL2 on
// the game canvas handed to the Worker (ADR-017), with Cartivo's own
// cartridge. Oracle: dark blue, A red, Start yellow (a white square on top).

/** Whether this engine offers WebGL2 inside a Worker, as the core needs. */
const workerWebGl2 = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<boolean>((resolve) => {
        const source =
          "postMessage(!!(self.OffscreenCanvas && new OffscreenCanvas(1, 1).getContext('webgl2')))";
        const url = URL.createObjectURL(new Blob([source]));
        const worker = new Worker(url);
        worker.onmessage = (e) => resolve(e.data === true);
        worker.onerror = () => resolve(false);
      }),
  );

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

const shows = async (page: Page, rgb: readonly number[]) => {
  const pixel = centre(await page.locator("canvas").screenshot());
  return pixel.every((v, i) => Math.abs(v - rgb[i]) <= 12);
};

test("N64 demo: the core draws on the canvas and the pad recolours it", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  const card = page.getByRole("article", { name: "N64", exact: true });
  await expect(card).toContainText("Experimental");
  if (!(await workerWebGl2(page))) {
    // The player says why instead of failing silently.
    await card.getByRole("button", { name: /^Jugar/ }).focus();
    await page.evaluate(() => (location.hash = "#demo/n64"));
    await expect(page.getByRole("alert")).toContainText("WebGL2");
    test.skip(true, "This engine offers no WebGL2 in a Worker here.");
  }
  await playDemo(page, "N64", 30);
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveAttribute("width", "640");
  await expect.poll(() => shows(page, [33, 33, 99])).toBe(true);
  // N64 A on the B position (K), Start on Enter.
  for (const [key, rgb] of [
    ["KeyK", [255, 0, 0]],
    ["Enter", [255, 255, 0]],
  ] as const) {
    await page.keyboard.down(key);
    await expect.poll(() => shows(page, rgb)).toBe(true);
    await page.keyboard.up(key);
  }
  await expect.poll(() => shows(page, [33, 33, 99])).toBe(true);
  // Battery memory (EEPROM, controller paks, SRAM, FlashRAM) is exported.
  await page.getByRole("button", { name: "Pausar juego" }).click();
  await page.getByText("Copias de partida", { exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar partida" }).click();
  const chunks: Buffer[] = [];
  for await (const chunk of (await (await download).createReadStream())!)
    chunks.push(Buffer.from(chunk));
  const backup = JSON.parse(Buffer.concat(chunks).toString()) as {
    format: string;
    bytes: number[];
  };
  expect(backup.format).toBe("cartivo-n64-sram-v1");
  expect(backup.bytes).toHaveLength(296960);
  expect(errors).toEqual([]);
});

test("N64 quick-saves with F5 and loads with F9", async ({ page }) => {
  await page.goto("/");
  test.skip(!(await workerWebGl2(page)), "No WebGL2 in a Worker here.");
  await playDemo(page, "N64");
  await page.keyboard.press("F5");
  await expect(page.getByTestId("toast")).toContainText("ranura 1");
  await page.keyboard.press("F9");
  await expect(page.getByTestId("toast")).toContainText("Partida cargada");
  await page.getByRole("button", { name: "Partidas" }).click();
  await expect(page.locator('[data-slot="1"]')).toContainText(
    "Mupen64Plus-Next",
  );
});
