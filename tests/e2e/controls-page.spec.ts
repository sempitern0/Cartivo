import { test, expect } from "./fixtures.ts";
test("controls have a direct URL and survive leaving and coming back", async ({
  page,
}) => {
  await page.goto("/#controles");
  await expect(
    page.getByRole("heading", { name: "Configurar controles", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Activar prueba" }).click();
  await expect(page.getByTestId("input-status")).toContainText(
    "Prueba activa. Usa",
  );
  await page.keyboard.down("KeyL");
  await expect(page.locator("[data-action=a]")).toHaveText("APulsado");
  await page
    .getByRole("link", { name: "Volver al inicio", exact: false })
    .click();
  await page.keyboard.up("KeyL");
  await expect(
    page.getByRole("heading", { name: "Elige una consola" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Activar prueba" }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Ajustes" }).click();
  await expect(
    page.getByRole("button", { name: "Activar prueba" }),
  ).toBeVisible();
  await page.goBack();
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Ajustes", exact: true }),
  ).toBeFocused();
  await expect(page.locator("[data-action=a]")).toHaveText("ALibre");
  await expect(
    page.getByRole("button", { name: "Detener prueba" }),
  ).toBeDisabled();
  await page.setViewportSize({ width: 360, height: 780 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/controls-mobile.png",
    fullPage: true,
  });
});

test("the test bar sits right above the drawings that light up", async ({
  page,
}) => {
  await page.goto("/#controles");
  const bar = await page
    .getByRole("button", { name: "Activar prueba" })
    .boundingBox();
  const keyboard = await page
    .getByRole("article", { name: "Teclado activo" })
    .boundingBox();
  expect(bar!.y).toBeLessThan(keyboard!.y);
  expect(keyboard!.y - (bar!.y + bar!.height)).toBeLessThan(160);
});

test("Ajustes groups Pantalla, Sonido, Controles, Interfaz, Almacenamiento and Avanzado", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Ajustes" }).click();
  const nav = page.getByRole("navigation", { name: "Secciones de ajustes" });
  await expect(nav.getByRole("button")).toHaveText([
    "Pantalla",
    "Sonido",
    "Controles",
    "Interfaz",
    "Almacenamiento",
    "Avanzado",
  ]);
  await nav.getByRole("button", { name: "Sonido" }).click();
  await expect(page.locator("#sonido")).toBeFocused();

  // Screen defaults per console, the same options as in the game.
  await page
    .locator("#pantalla")
    .getByLabel("Consola")
    .selectOption({ label: "SNES" });
  await page.getByText("Píxel entero", { exact: true }).click();
  await expect(page.locator("#pantalla")).toContainText(
    "Se recordará para SNES",
  );
  // Sound and core choices survive a reload.
  await page.getByLabel("Silenciar los juegos").check();
  await page
    .getByLabel("Núcleo de NES")
    .selectOption({ label: "JSNES · JavaScript" });
  await page.reload();
  await expect(page.getByLabel("Silenciar los juegos")).toBeChecked();
  await expect(page.getByLabel("Núcleo de NES")).toHaveValue("jsnes");
  await page
    .locator("#pantalla")
    .getByLabel("Consola")
    .selectOption({ label: "SNES" });
  await expect(page.getByRole("radio", { name: /Píxel entero/ })).toBeChecked();
});
