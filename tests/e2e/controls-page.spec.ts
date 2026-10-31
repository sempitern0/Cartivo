import { test, expect } from "@playwright/test";
test("controls have a direct URL and remain separate from diagnostics", async ({
  page,
}) => {
  await page.goto("/#controles");
  await expect(
    page.getByRole("heading", { name: "Controles", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Diagnóstico sin emulación" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Activar prueba" }).click();
  await expect(page.getByTestId("input-status")).toContainText(
    "Prueba activa. Usa",
  );
  await page.keyboard.down("KeyX");
  await expect(page.locator("[data-action=a]")).toHaveText("APulsado");
  await page
    .getByRole("link", { name: "Volver al inicio", exact: false })
    .click();
  await page.keyboard.up("KeyX");
  await expect(
    page.getByRole("heading", { name: "Vuelve a jugar." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Activar prueba" }),
  ).toHaveCount(0);
  await page.locator("summary").click();
  await expect(
    page.getByRole("heading", { name: "Diagnóstico sin emulación" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Activar prueba" }),
  ).toHaveCount(0);
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Controles", exact: true }),
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
