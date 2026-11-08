import { test, expect, type Page } from "./fixtures.ts";
import { startDemo } from "./play.ts";
import { mkdirSync } from "node:fs";

// Screenshots for visual review are kept outside test-results, which
// Playwright cleans on every run.
const shots = "screenshots";
mkdirSync(shots, { recursive: true });
const variant = (baseURL?: string) =>
  baseURL?.includes(":4173") ? "preview" : "dev";

async function noHorizontalScroll(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

async function playing(page: Page) {
  // An exit snapshot from earlier in the test offers «Continuar»: start over.
  const offer = page.getByRole("button", { name: "Empezar de nuevo" });
  await expect
    .poll(
      async () =>
        (await page.getByTestId("player-phase").textContent())?.includes(
          "Jugando",
        ) || (await offer.count()) > 0,
    )
    .toBe(true);
  if (await offer.count()) await offer.click();
  await expect(page.getByTestId("player-phase")).toHaveText("Jugando");
  await expect
    .poll(async () =>
      Number(await page.locator("canvas").getAttribute("data-frames")),
    )
    .toBeGreaterThan(10);
}

test("the start shows the consoles and Ajustes opens controls", async ({
  page,
  baseURL,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Elige una consola" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "NES", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `${shots}/${variant(baseURL)}-home-desktop.png`,
  });
  // Controls are global: the header's «Ajustes», not each card.
  await expect(page.getByRole("link", { name: /^Controles de/ })).toHaveCount(
    0,
  );
  await page.getByRole("link", { name: "Ajustes" }).click();
  await expect(
    page.getByRole("heading", { name: "Ajustes", exact: true }),
  ).toBeFocused();
  await page.screenshot({
    path: `${shots}/${variant(baseURL)}-controls-desktop.png`,
    fullPage: true,
  });
});

test("keyboard drawing lights the pressed key during the test", async ({
  page,
}) => {
  await page.goto("/#controles");
  await expect(
    page.getByRole("heading", { name: "Teclado activo" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Activar prueba" }).click();
  await expect(page.getByTestId("input-status")).toContainText(
    "Prueba activa. Usa",
  );
  await page.keyboard.down("KeyL");
  await expect(page.locator(".keyboard-art .cap.lit")).toContainText("L");
  await expect(page.locator(".pad-art .face.lit")).toHaveCount(1);
  await page.keyboard.up("KeyL");
  await expect(page.locator(".keyboard-art .cap.lit")).toHaveCount(0);
});

test("a file dropped on a card opens with that console", async ({ page }) => {
  const { controlDemo } =
    await import("../../packages/fixtures/src/control-demo.ts");
  await page.goto("/");
  const card = page.getByRole("article", { name: "NES", exact: true });
  const bytes = [...controlDemo()];
  const transfer = await page.evaluateHandle((bytes) => {
    const data = new DataTransfer();
    data.items.add(new File([new Uint8Array(bytes)], "soltado.nes"));
    return data;
  }, bytes);
  await card.dispatchEvent("dragover", { dataTransfer: transfer });
  await expect(card).toHaveClass(/\bover\b/);
  await card.dispatchEvent("drop", { dataTransfer: transfer });
  await playing(page);
  await expect(
    page.getByRole("heading", { name: "soltado.nes" }),
  ).toBeVisible();
});

test("clicking anywhere on a card opens its game picker", async ({ page }) => {
  await page.goto("/");
  const chooser = page.waitForEvent("filechooser");
  await page
    .getByRole("article", { name: "NES", exact: true })
    .getByRole("heading")
    .click();
  expect((await chooser).isMultiple()).toBe(false);
});

test("Cargar ROM replaces the game with a single session", async ({ page }) => {
  const { controlDemo } =
    await import("../../packages/fixtures/src/control-demo.ts");
  await page.goto("/");
  await startDemo(page, "NES");
  await playing(page);
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Cargar ROM" }).click();
  await (
    await chooser
  ).setFiles({
    name: "original-demo.nes",
    mimeType: "application/octet-stream",
    buffer: Buffer.from(controlDemo()),
  });
  await expect(
    page.getByRole("heading", { name: "original-demo.nes" }),
  ).toBeVisible();
  await playing(page);
  await expect(page.locator(".player")).toHaveCount(1);
  await expect.poll(() => page.workers().length).toBe(1);
});

test("status footer reports keyboard and a connected pad", async ({
  page,
  baseURL,
}) => {
  await page.addInitScript(() => {
    const pad = {
      index: 0,
      id: "Synthetic controller",
      connected: true,
      mapping: "standard",
      buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })),
      axes: [0, 0],
      timestamp: 0,
    };
    Object.defineProperty(navigator, "getGamepads", {
      configurable: true,
      value: () => [pad],
    });
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await startDemo(page, "NES");
  await playing(page);
  await expect(page.getByTestId("keyboard-status")).toHaveText(
    "Teclado conectado",
  );
  await expect(page.getByTestId("pad-status")).toHaveText("Mando conectado");
  await page.screenshot({
    path: `${shots}/${variant(baseURL)}-player-desktop.png`,
  });
});

test("home, controls and player fit a 375px phone", async ({
  page,
  baseURL,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await noHorizontalScroll(page);
  await page.screenshot({
    path: `${shots}/${variant(baseURL)}-home-mobile.png`,
    fullPage: true,
  });
  await page.goto("/#controles");
  await expect(
    page.getByRole("heading", { name: "Configurar controles" }),
  ).toBeVisible();
  await noHorizontalScroll(page);
  await page.screenshot({
    path: `${shots}/${variant(baseURL)}-controls-mobile.png`,
    fullPage: true,
  });
  await page.goto("/");
  await startDemo(page, "NES");
  await playing(page);
  await noHorizontalScroll(page);
  await page.screenshot({
    path: `${shots}/${variant(baseURL)}-player-mobile.png`,
    fullPage: true,
  });
});

test("the logo returns to the start and the console cards line up", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto("/#controles");
  await page.getByRole("link", { name: "Cartivo, inicio" }).click();
  await expect(
    page.getByRole("heading", { name: "Elige una consola" }),
  ).toBeVisible();
  const url = new URL(page.url());
  expect(url.pathname + url.hash).toBe("/");
  // The cards rise in one after another: measure once they have settled.
  await page.evaluate(() =>
    Promise.all(document.getAnimations().map((a) => a.finished)),
  );
  // Four cards per row on a laptop; within a row the «Jugar» buttons line up.
  const rows = await page
    .getByRole("list", { name: "Consolas" })
    .getByRole("article")
    .evaluateAll((cards) =>
      cards.map((card) => ({
        row: Math.round(card.getBoundingClientRect().top),
        button: Math.round(
          card.querySelector("button.play")!.getBoundingClientRect().top,
        ),
      })),
    );
  const byRow = Map.groupBy(rows, (r) => r.row);
  expect([...byRow.values()][0].length).toBe(4);
  for (const cards of byRow.values())
    expect(new Set(cards.map((c) => c.button)).size).toBe(1);
  await noHorizontalScroll(page);
});

test("every console card is its logo, loaded, with the name for screen readers", async ({
  page,
}) => {
  await page.goto("/");
  const logos = page
    .getByRole("list", { name: "Consolas" })
    .getByRole("article")
    .locator("img.cover-art");
  await expect(logos).toHaveCount(
    await page
      .getByRole("list", { name: "Consolas" })
      .getByRole("article")
      .count(),
  );
  // Each image decoded (no broken asset) and hidden from screen readers.
  await expect
    .poll(() =>
      logos.evaluateAll((images) =>
        (images as HTMLImageElement[]).every(
          (img) => img.alt === "" && img.naturalWidth === 640,
        ),
      ),
    )
    .toBe(true);
  // The name is not drawn over the logo but still names the card.
  await expect(
    page.getByRole("article", { name: "Mega Drive", exact: true }),
  ).toBeVisible();
});
