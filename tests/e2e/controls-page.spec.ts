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

test("Ajustes shows Pantalla, Sonido, Controles, Interfaz, Almacenamiento and Avanzado as tabs", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Ajustes" }).click();
  const tabs = page.getByRole("tablist", { name: "Secciones de ajustes" });
  await expect(tabs.getByRole("tab")).toHaveText([
    "Pantalla",
    "Sonido",
    "Controles",
    "Interfaz",
    "Almacenamiento",
    "Avanzado",
  ]);
  const tab = (name: string) => tabs.getByRole("tab", { name });
  await expect(tab("Pantalla")).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#sonido")).toBeHidden();
  // Arrows move along the tabs and show each panel.
  await tab("Pantalla").focus();
  await page.keyboard.press("ArrowRight");
  await expect(tab("Sonido")).toBeFocused();
  await expect(page.locator("#sonido")).toBeVisible();
  await expect(page.locator("#pantalla")).toBeHidden();
  await expect(page).toHaveURL(/#ajustes\/sonido$/);

  // Screen defaults per console, the same options as in the game.
  await tab("Pantalla").click();
  await page
    .locator("#pantalla")
    .getByLabel("Consola")
    .selectOption({ label: "SNES" });
  await page
    .locator("#pantalla")
    .getByRole("radio", { name: /^Píxel entero/ })
    .check();
  await expect(page.locator("#pantalla")).toContainText(
    "Se recordará para SNES",
  );
  // Before and after: the default next to the choice, laid out for this window.
  const preview = page.locator("#pantalla").getByTestId("display-preview");
  await expect(preview.getByRole("figure")).toHaveCount(2);
  await expect(preview).toContainText("Predeterminado");
  await expect(preview).toContainText(/Tu elección\s*Píxel entero ×\d/);
  // Animations follow the system unless the player chooses.
  await tab("Interfaz").click();
  const motion = page.getByRole("group", { name: "Animaciones" });
  await motion.getByText("Reducidas", { exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-motion", "reduce");
  await motion.getByText("Activadas", { exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-motion", "full");
  // Sound and core choices survive a reload, which keeps the tab.
  await tab("Sonido").click();
  await page.getByLabel("Silenciar los juegos").check();
  await tab("Avanzado").click();
  const nesCores = page.getByRole("group", { name: "Núcleo de NES" });
  await expect(nesCores).toContainText("Recomendado");
  await expect(nesCores).toContainText("A favor");
  await nesCores.getByRole("radio", { name: /^JSNES/ }).check();
  await page.reload();
  await expect(tab("Avanzado")).toHaveAttribute("aria-selected", "true");
  await expect(nesCores.getByRole("radio", { name: /^JSNES/ })).toBeChecked();
  await tab("Sonido").click();
  await expect(page.getByLabel("Silenciar los juegos")).toBeChecked();
  await tab("Pantalla").click();
  await page
    .locator("#pantalla")
    .getByLabel("Consola")
    .selectOption({ label: "SNES" });
  await expect(
    page.locator("#pantalla").getByRole("radio", { name: /^Píxel entero/ }),
  ).toBeChecked();
});
