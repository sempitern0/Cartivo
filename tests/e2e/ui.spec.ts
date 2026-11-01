import { test, expect, type Page } from "@playwright/test";
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
  await expect(page.getByTestId("player-phase")).toHaveText("Jugando");
  await expect
    .poll(async () =>
      Number(await page.locator("canvas").getAttribute("data-frames")),
    )
    .toBeGreaterThan(10);
}

test("console card starts NES and its settings icon opens controls", async ({
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
  await page.getByRole("link", { name: "Ajustes de NES" }).click();
  await expect(
    page.getByRole("heading", { name: "Configurar controles" }),
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

test("Cargar ROM replaces the game with a single session", async ({ page }) => {
  const { controlDemo } =
    await import("../../packages/fixtures/src/control-demo.ts");
  await page.goto("/");
  await page.getByRole("button", { name: "Probar demo" }).click();
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
  await page.getByRole("button", { name: "Probar demo" }).click();
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
  await page.getByRole("button", { name: "Probar demo" }).click();
  await playing(page);
  await noHorizontalScroll(page);
  await page.screenshot({
    path: `${shots}/${variant(baseURL)}-player-mobile.png`,
    fullPage: true,
  });
});
