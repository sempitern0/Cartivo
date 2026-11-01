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
  await page.getByRole("link", { name: "Ajustes", exact: true }).click();
});
test("keyboard scope, release and Tab escape", async ({ page }) => {
  const a = page.locator("[data-action=a]");
  await page.keyboard.press("KeyL");
  await expect(a).toHaveText("ALibre");
  await page.getByRole("button", { name: "Activar prueba" }).click();
  await expect(page.getByTestId("input-status")).toContainText(
    "Prueba activa. Usa",
  );
  await page.keyboard.down("KeyL");
  await expect(a).toHaveText("APulsado");
  await page.keyboard.press("Tab");
  await expect(a).toHaveText("ALibre");
  await page.keyboard.up("KeyL");
  await expect(page.getByTestId("input-status")).toContainText("pausada");
});
test("L and R: I/O keys and LB/RB light up and can be remapped", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Activar prueba" }).click();
  await page.keyboard.down("KeyI");
  await expect(page.locator("[data-action=l]")).toHaveText("LPulsado");
  await page.keyboard.up("KeyI");
  await page.keyboard.down("KeyO");
  await expect(page.locator("[data-action=r]")).toHaveText("RPulsado");
  await page.keyboard.up("KeyO");
  await page.getByLabel("Mando", { exact: true }).selectOption("0");
  await page.getByRole("button", { name: "Activar prueba" }).click();
  await page.evaluate(() => {
    (window as any).testPad.buttons[5].pressed = true;
  });
  await expect(page.locator("[data-action=r]")).toHaveText("RPulsado");
  await page.evaluate(() => {
    (window as any).testPad.buttons[5].pressed = false;
  });
  await page.getByRole("button", { name: "Asignar tecla L", exact: true }).click();
  await page.keyboard.press("KeyU");
  await expect(
    page.getByRole("button", { name: "Asignar tecla L", exact: true }),
  ).toHaveText("L = U");
});
test("standard pad, disconnect and reused slot require reactivation", async ({
  page,
}) => {
  await page.getByLabel("Mando", { exact: true }).selectOption("0");
  await page.getByRole("button", { name: "Activar prueba" }).click();
  await expect(page.getByTestId("input-status")).toContainText(
    "Prueba activa. Usa",
  );
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
  await expect(page.getByTestId("input-status")).toContainText(
    "Prueba activa. Usa",
  );
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
  // Ten controls since L/R exist (Game Boy Advance).
  for (let index = 0; index < 10; index++) {
    await expect(page.locator(".capture")).not.toContainText("Suelta");
    await page.evaluate((i) => {
      (window as any).testPad.buttons[i].pressed = true;
    }, index);
    if (index < 9)
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
  await page.getByRole("link", { name: "Ajustes", exact: true }).click();
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
  await expect(page.getByTestId("input-status")).toContainText(
    "Prueba activa. Usa",
  );
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
  await expect(page.getByTestId("input-status")).toContainText(
    "Prueba activa. Usa",
  );
  await page.keyboard.down("KeyL");
  await expect(page.locator("[data-action=a]")).toHaveText("APulsado");
  await page.keyboard.up("KeyL");
});

test("auto selects a controller exposed after opening and preserves explicit keyboard choice", async ({
  page,
}) => {
  await expect(page.getByLabel("Mando", { exact: true })).toHaveValue("0");
  await page.evaluate(() => {
    (window as any).testPad.connected = false;
  });
  await expect(page.getByTestId("connection-status")).toContainText(
    "Ningún mando visible",
  );
  await page.evaluate(() => {
    (window as any).testPad.connected = true;
  });
  await expect(page.getByTestId("connection-status")).toContainText("1 mando");
  await expect(page.getByLabel("Mando", { exact: true })).toHaveValue("0");
  await page.getByLabel("Mando", { exact: true }).selectOption("-1");
  await expect(page.getByLabel("Mando", { exact: true })).toHaveValue("-1");
  await page.getByRole("button", { name: "Activar prueba" }).click();
  await expect(page.getByLabel("Mando", { exact: true })).toHaveValue("-1");
});
test("keyboard labels, remapping, collisions and reload", async ({ page }) => {
  await expect(
    page.getByRole("button", { name: "Asignar tecla A", exact: true }),
  ).toHaveText("A = L");
  await expect(
    page.getByRole("button", { name: "Asignar tecla B", exact: true }),
  ).toHaveText("B = K");
  await page
    .getByRole("button", { name: "Asignar tecla A", exact: true })
    .click();
  await page.keyboard.press("KeyK");
  await expect(page.getByTestId("input-status")).toContainText(
    "ya está asignada",
  );
  await page.keyboard.press("KeyC");
  await expect(
    page.getByRole("button", { name: "Asignar tecla A", exact: true }),
  ).toHaveText("A = C");
  await page.getByRole("button", { name: "Activar prueba" }).click();
  await expect(page.getByTestId("input-status")).toContainText(
    "Prueba activa. Usa",
  );
  await page.keyboard.down("KeyL");
  await expect(page.locator("[data-action=a]")).toHaveText("ALibre");
  await page.keyboard.up("KeyL");
  await page.keyboard.down("KeyC");
  await expect(page.locator("[data-action=a]")).toHaveText("APulsado");
  await page.keyboard.up("KeyC");
  await page.reload();
  await page.getByRole("link", { name: "Ajustes", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Asignar tecla A", exact: true }),
  ).toHaveText("A = C");
  await page.getByRole("button", { name: "Restablecer teclado" }).click();
  await expect(
    page.getByRole("button", { name: "Asignar tecla A", exact: true }),
  ).toHaveText("A = L");
});

test("initially hidden USB controller appears on browser exposure event", async ({
  page,
}) => {
  await page
    .getByRole("link", { name: "Volver al inicio", exact: false })
    .click();
  await page.evaluate(() => {
    (window as any).testPad.connected = false;
  });
  await page.getByRole("link", { name: "Ajustes", exact: true }).click();
  await expect(page.getByLabel("Mando", { exact: true })).toHaveValue("-1");
  await expect(page.getByTestId("connection-status")).toContainText(
    "pulsa un botón",
  );
  await page.evaluate(() => {
    (window as any).testPad.connected = true;
    window.dispatchEvent(new Event("gamepadconnected"));
  });
  await expect(page.getByLabel("Mando", { exact: true })).toHaveValue("0");
  await expect(page.getByTestId("connection-status")).toContainText("1 mando");
});

test("WASD movements appear alongside arrow defaults", async ({ page }) => {
  await page.getByRole("button", { name: "Activar prueba" }).click();
  await expect(page.getByTestId("input-status")).toContainText(
    "Prueba activa. Usa",
  );
  for (const [code, action] of [
    ["KeyW", "up"],
    ["KeyA", "left"],
    ["KeyS", "down"],
    ["KeyD", "right"],
  ]) {
    await page.keyboard.down(code);
    await expect(page.locator(`[data-action=${action}]`)).toContainText(
      "Pulsado",
    );
    await page.keyboard.up(code);
    await expect(page.locator(`[data-action=${action}]`)).toContainText(
      "Libre",
    );
  }
});
