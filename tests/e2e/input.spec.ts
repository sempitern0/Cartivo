import { test, expect } from "@playwright/test";
// Synthetic Gamepad API: these tests do not certify physical hardware.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const fixture = {
      index: 0,
      id: "Synthetic controller",
      connected: true,
      mapping: "standard",
      buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })),
      axes: [0, 0],
    };
    Object.assign(window, { testPad: fixture });
    Object.defineProperty(navigator, "getGamepads", {
      configurable: true,
      value: () => [
        fixture.connected
          ? Object.create(
              Object.fromEntries(
                Object.keys(fixture).map((key) => [
                  key,
                  fixture[key as keyof typeof fixture],
                ]),
              ),
            )
          : null,
      ],
    });
  });
  await page.goto("/");
  await page.locator("summary").click();
});
test("keyboard scope, release and Tab escape", async ({ page }) => {
  const a = page.locator("[data-action=a]");
  await page.keyboard.press("KeyX");
  await expect(a).toHaveText("ALibre");
  await page.getByRole("button", { name: "Activar prueba" }).click();
  await expect(page.getByTestId("input-status")).toContainText("Flechas");
  await page.keyboard.down("KeyX");
  await expect(a).toHaveText("APulsado");
  await page.keyboard.press("Tab");
  await expect(a).toHaveText("ALibre");
  await page.keyboard.up("KeyX");
  await expect(page.getByTestId("input-status")).toContainText("pausada");
});
test("standard pad, disconnect and reused slot require reactivation", async ({
  page,
}) => {
  await page.getByLabel("Mando", { exact: true }).selectOption("0");
  await page.getByRole("button", { name: "Activar prueba" }).click();
  await expect(page.getByTestId("input-status")).toContainText("Flechas");
  await page.evaluate(() => {
    (window as any).testPad.buttons[0].pressed = true;
  });
  await expect(page.locator("[data-action=a]")).toHaveText("APulsado");
  await page.evaluate(() => {
    (window as any).testPad.connected = false;
  });
  await expect(page.locator("[data-action=a]")).toHaveText("ALibre");
  await page.evaluate(() => {
    (window as any).testPad.connected = true;
    (window as any).testPad.id = "Replacement";
  });
  await page.getByRole("button", { name: "Activar prueba" }).click();
  await expect(page.getByTestId("input-status")).toContainText("Suelta");
  await page.evaluate(() => {
    (window as any).testPad.buttons[0].pressed = false;
  });
  await expect(page.getByTestId("input-status")).toContainText("Flechas");
  await page.evaluate(() => {
    (window as any).testPad.buttons[0].pressed = true;
  });
  await expect(page.locator("[data-action=a]")).toHaveText("APulsado");
});
test("manual profile persists and requires explicit restore", async ({
  page,
}) => {
  await page.evaluate(() => {
    (window as any).testPad.mapping = "";
  });
  await page.getByLabel("Mando", { exact: true }).selectOption("0");
  await page.getByRole("button", { name: "Asignar controles" }).click();
  for (let index = 0; index < 8; index++) {
    await expect(page.locator(".capture")).not.toContainText("Suelta");
    await page.evaluate((i) => {
      (window as any).testPad.buttons[i].pressed = true;
    }, index);
    if (index < 7)
      await expect(page.locator(".capture")).toContainText("Suelta");
    else await expect(page.locator(".capture")).toHaveCount(0);
    await page.evaluate((i) => {
      (window as any).testPad.buttons[i].pressed = false;
    }, index);
  }
  await expect(
    page.getByRole("button", { name: "Aplicar perfil guardado" }),
  ).toBeVisible();
  await page.reload();
  await page.locator("summary").click();
  await page.evaluate(() => {
    (window as any).testPad.mapping = "";
  });
  await page.getByLabel("Mando", { exact: true }).selectOption("0");
  await expect(
    page.getByText(
      "Este mando necesita asignación manual. El teclado sigue disponible.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Aplicar perfil guardado" }).click();
  await page.getByRole("button", { name: "Activar prueba" }).click();
  await expect(page.getByTestId("input-status")).toContainText("Flechas");
  await page.evaluate(() => {
    (window as any).testPad.buttons[4].pressed = true;
  });
  await expect(page.locator("[data-action=a]")).toHaveText("APulsado");
});

test("blocked Gamepad API retains keyboard fallback", async ({ page }) => {
  await page.evaluate(() => {
    Object.defineProperty(navigator, "getGamepads", {
      configurable: true,
      value: () => {
        throw new DOMException("Denied", "SecurityError");
      },
    });
  });
  await expect(page.getByTestId("input-status")).toContainText("bloqueado");
  await page.getByRole("button", { name: "Activar prueba" }).click();
  await expect(page.getByTestId("input-status")).toContainText("Flechas");
  await page.keyboard.down("KeyX");
  await expect(page.locator("[data-action=a]")).toHaveText("APulsado");
  await page.keyboard.up("KeyX");
});
