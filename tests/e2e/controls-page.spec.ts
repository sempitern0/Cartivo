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
