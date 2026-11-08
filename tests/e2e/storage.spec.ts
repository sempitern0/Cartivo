import { test, expect } from "./fixtures.ts";
import { openNesFile, patchWorker, playDemo } from "./play.ts";

// What Cartivo says and does when the browser keeps less than usual.

test("without OPFS (private window) the home warns and nothing is remembered", async ({
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
  await openNesFile(page);
  await expect(page.getByTestId("player-phase")).toHaveText("Jugando");
  // Partidas still work (IndexedDB); only the library is off.
  await page.getByRole("button", { name: "Partidas" }).click();
  await page.getByRole("button", { name: "Guardar en Ranura 1" }).click();
  await expect(page.getByTestId("toast")).toContainText("ranura 1");
  await page.getByRole("button", { name: "Cerrar partidas" }).click();
  await page.getByRole("button", { name: "Guardar y salir", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Elige una consola" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Tus juegos", exact: true }).click();
  const library = page.getByRole("region", { name: "Tus juegos" });
  await expect(library).toContainText("Aún no hay juegos");
  await expect(library.getByRole("listitem")).toHaveCount(0);
});

test.describe("without Web Locks", () => {
  // Requests must reach the network so the Worker script can be rewritten.
  test.use({ serviceWorkers: "block" });

  test("the game runs and says nothing will be saved", async ({ page }) => {
    // In the page (home notice) and in the emulator Worker (the stores).
    const noLocks = (proto: string) =>
      `Object.defineProperty(${proto}.prototype, "locks", { get: () => undefined });\n`;
    await page.addInitScript(noLocks("Navigator"));
    await patchWorker(page, noLocks("WorkerNavigator"));
    await page.goto("/");
    await expect(
      page.getByRole("status").filter({ hasText: "no permite guardar" }),
    ).toBeVisible();
    await playDemo(page, "Game Boy");
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
