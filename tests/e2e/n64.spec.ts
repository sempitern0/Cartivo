import { test, expect, type Page } from "./fixtures.ts";
import { playing } from "./play.ts";
import { demoStarts as surfaceDemoStarts, shows } from "./surface.ts";

// WebGL2 in software on CI runners: one heavy test at a time (fixtures.ts).
test.use({ heavy: true });

// Nintendo 64 runs Mupen64Plus-Next, whose GLideN64 draws with WebGL2 on
// the game canvas handed to the Worker (ADR-017), with Cartivo's own
// cartridge. Oracle: dark blue, A red, Start yellow (a white square on top).

const demoStarts = (page: Page) => surfaceDemoStarts(page, "N64");

test("N64 demo: the core draws on the canvas and the pad recolours it", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  const card = page.getByRole("article", { name: "N64", exact: true });
  await expect(card).toContainText("Experimental");
  test.skip(
    !(await demoStarts(page)),
    "This engine offers no WebGL2 in a Worker here.",
  );
  await playing(page, 30);
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
  test.skip(!(await demoStarts(page)), "No WebGL2 in a Worker here.");
  await playing(page);
  await page.keyboard.press("F5");
  await expect(page.getByTestId("toast")).toContainText("ranura 1");
  await page.keyboard.press("F9");
  await expect(page.getByTestId("toast")).toContainText("Partida cargada");
  await page.getByRole("button", { name: "Partidas" }).click();
  const slot = page.locator('[data-slot="1"]');
  await expect(slot).toContainText("Mupen64Plus-Next");
  // The preview is read back from the GPU surface when saving.
  await expect(slot.locator("canvas.thumb")).not.toHaveClass(/empty/);
});
