import { test, expect } from "@playwright/test";

// What Cartivo says and does when the browser keeps less than usual.

test("without OPFS (private window) the home warns and nothing asks to remember", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(StorageManager.prototype, "getDirectory", {
      value: () => Promise.reject(new DOMException("private", "SecurityError")),
    });
  });
  await page.goto("/");
  await expect(
    page.getByRole("status").filter({ hasText: "no guarda copias" }),
  ).toBeVisible();
  const { controlDemo } =
    await import("../../packages/fixtures/src/control-demo.ts");
  await page.locator("input[type=file]").setInputFiles({
    name: "juego.nes",
    mimeType: "application/octet-stream",
    buffer: Buffer.from(controlDemo()),
  });
  await expect(page.getByTestId("player-phase")).toHaveText("Jugando");
  // Partidas still work (IndexedDB); only the library is off.
  await expect(page.getByRole("button", { name: "Sí, recordar" })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Partidas" }).click();
  await page.getByRole("button", { name: "Guardar en Ranura 1" }).click();
  await expect(page.getByTestId("toast")).toContainText("ranura 1");
});

test.describe("without Web Locks", () => {
  // Requests must reach the network so the Worker script can be rewritten.
  test.use({ serviceWorkers: "block" });

  test("the game runs and says nothing will be saved", async ({ page }) => {
    // In the page (home notice) and in the emulator Worker (the stores).
    const noLocks = (proto: string) =>
      `Object.defineProperty(${proto}.prototype, "locks", { get: () => undefined });\n`;
    await page.addInitScript(noLocks("Navigator"));
    await page.context().route(/emulator\.worker/, async (route) => {
      const response = await route.fetch();
      await route.fulfill({
        response,
        body: noLocks("WorkerNavigator") + (await response.text()),
      });
    });
    await page.goto("/");
    await expect(
      page.getByRole("status").filter({ hasText: "no permite guardar" }),
    ).toBeVisible();
    await page
      .getByRole("article", { name: "Game Boy", exact: true })
      .getByRole("button", { name: "Probar demo" })
      .click();
    await expect(page.getByTestId("player-phase")).toHaveText("Jugando");
    await expect
      .poll(async () =>
        Number(await page.locator("canvas").getAttribute("data-frames")),
      )
      .toBeGreaterThan(10);
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "Puedes jugar, pero no se guardará el progreso." }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Partidas" })).toBeDisabled();
    // F5 explains instead of failing silently.
    await page.keyboard.press("F5");
    await expect(page.getByRole("alert")).toContainText(
      "no permite coordinar el guardado",
    );
    // Leaving is clean: no error about a failed exit save.
    await page.getByRole("button", { name: "Salir", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Elige una consola" }),
    ).toBeVisible();
  });
});
