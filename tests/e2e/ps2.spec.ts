import { test, expect, type Page } from "./fixtures.ts";
import { playing } from "./play.ts";
import { demoStarts as surfaceDemoStarts, shows } from "./surface.ts";

// WebGL2 in software on CI runners: one heavy test at a time (fixtures.ts).
test.use({ heavy: true });

// PlayStation 2 runs Play!: the console on its own thread (the page is
// cross-origin isolated, ADR-020) and its GS drawing with WebGL2 on the game
// canvas (ADR-017, ADR-022), with Cartivo's own program instead of a game.
// Oracle: dark blue, Cross red, Circle green, Start yellow.

const demoStarts = (page: Page) => surfaceDemoStarts(page, "PS2");
const card = (page: Page) =>
  page.getByRole("article", { name: "PS2", exact: true });

test("PS2 demo: the console runs on its thread and the pad recolours it", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(card(page)).toContainText("Experimental");
  test.skip(
    !(await demoStarts(page)),
    "This engine offers no WebGL2 in a Worker here.",
  );
  await playing(page, 30);
  await expect(page.locator("canvas")).toHaveAttribute("width", "640");
  await expect(page.locator("canvas")).toHaveAttribute("height", "448");
  await expect.poll(() => shows(page, [33, 33, 99])).toBe(true);
  // Cross on the B position (K), Circle on A (L), Start on Enter.
  for (const [key, rgb] of [
    ["KeyK", [255, 0, 0]],
    ["KeyL", [0, 255, 0]],
    ["Enter", [255, 255, 0]],
  ] as const) {
    await page.keyboard.down(key);
    await expect.poll(() => shows(page, rgb)).toBe(true);
    await page.keyboard.up(key);
  }
  await expect.poll(() => shows(page, [33, 33, 99])).toBe(true);
  expect(errors).toEqual([]);
});

test("PS2 keeps progress with Partidas: F5 saves and F9 loads", async ({
  page,
}) => {
  await page.goto("/");
  test.skip(!(await demoStarts(page)), "No WebGL2 in a Worker here.");
  await playing(page);
  await page.keyboard.press("F5");
  await expect(page.getByTestId("toast")).toContainText("ranura 1");
  await page.keyboard.press("F9");
  await expect(page.getByTestId("toast")).toContainText("Partida cargada");
  await playing(page);
  await page.getByRole("button", { name: "Partidas" }).click();
  const slot = page.locator('[data-slot="1"]');
  await expect(slot).toContainText("Play!");
  // The preview is read back from the GPU surface when saving.
  await expect(slot.locator("canvas.thumb")).not.toHaveClass(/empty/);
});

test("a PS2 disc image boots from the player's file, read on demand", async ({
  page,
}) => {
  const { ps2DiscDemo } =
    await import("../../packages/fixtures/src/ps2-control-demo.ts");
  await page.goto("/");
  test.skip(!(await demoStarts(page)), "No WebGL2 in a Worker here.");
  await page.goto("/");
  const chooser = page.waitForEvent("filechooser");
  await card(page).getByRole("button", { name: "Jugar", exact: true }).click();
  await (
    await chooser
  ).setFiles({
    name: "Demo original.iso",
    mimeType: "application/octet-stream",
    buffer: Buffer.from(ps2DiscDemo()),
  });
  await playing(page, 30);
  await expect(
    page.getByRole("heading", { name: "Demo original.iso" }),
  ).toBeVisible();
  await expect.poll(() => shows(page, [33, 33, 99])).toBe(true);
  await page.keyboard.down("KeyK");
  await expect.poll(() => shows(page, [255, 0, 0])).toBe(true);
  await page.keyboard.up("KeyK");
});
