import { test, expect, type Page } from "@playwright/test";

// Local library and «Continuar» (ADR-012) with Cartivo's own NES fixture.
const NAME = "mi-juego.nes";

async function game() {
  const { controlDemo } =
    await import("../../packages/fixtures/src/control-demo.ts");
  return {
    name: NAME,
    mimeType: "application/octet-stream",
    buffer: Buffer.from(controlDemo()),
  };
}

async function open(page: Page) {
  await page.locator("input[type=file]").setInputFiles(await game());
}

async function running(page: Page) {
  await expect(page.getByTestId("player-phase")).toHaveText("Jugando");
  await expect
    .poll(async () =>
      Number(await page.locator("canvas").getAttribute("data-frames")),
    )
    .toBeGreaterThan(10);
}

const exit = (page: Page) =>
  page.getByRole("button", { name: "Salir", exact: true }).click();
const continueCard = (page: Page) =>
  page.getByRole("article", { name: NAME, exact: true });
const library = (page: Page) =>
  page.getByRole("region", { name: "Tus juegos" });

/** Opens the game, answers «Sí» once and leaves (exit snapshot saved). */
async function rememberAndLeave(page: Page) {
  await open(page);
  await running(page);
  await page.getByRole("button", { name: "Sí, recordar" }).click();
  await expect(page.getByTestId("toast")).toContainText("Juego recordado");
  await exit(page);
  await expect(continueCard(page)).toBeVisible();
}

test("a remembered game continues from the home screen with one click", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await rememberAndLeave(page);
  await expect(library(page)).toContainText(NAME);
  await expect(continueCard(page)).toContainText("NES");

  await page.reload();
  let chooser = false;
  page.on("filechooser", () => (chooser = true));
  await continueCard(page).getByRole("button", { name: "Continuar" }).click();
  // Straight to the exit snapshot: no picker, no offer, no question.
  await expect(page.getByTestId("toast")).toContainText(
    "Partida cargada: al salir",
  );
  await running(page);
  await expect(page.getByRole("heading", { name: NAME })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Empezar de nuevo" }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Sí, recordar" })).toHaveCount(
    0,
  );
  expect(chooser).toBe(false);
  expect(errors).toEqual([]);
});

test("answering «No» keeps nothing and is not asked again", async ({
  page,
}) => {
  await page.goto("/");
  await open(page);
  await running(page);
  await page.getByRole("button", { name: "No", exact: true }).click();
  await expect(page.getByTestId("toast")).toContainText(
    "No se recordarán juegos",
  );
  await exit(page);
  await expect(library(page)).toContainText("Aún no hay juegos recordados");
  await expect(continueCard(page)).toHaveCount(0);
  await expect(
    library(page).getByRole("checkbox", { name: /Recordar juegos nuevos/ }),
  ).not.toBeChecked();
  const roms = await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const names: string[] = [];
    try {
      const dir = await root.getDirectoryHandle("roms");
      for await (const name of (dir as any).keys()) names.push(name);
    } catch {
      // No roms directory at all.
    }
    return names;
  });
  expect(roms).toEqual([]);
  await open(page);
  await running(page);
  await expect(page.getByRole("button", { name: "Sí, recordar" })).toHaveCount(
    0,
  );
});

test("removing a game from the list keeps its Partidas", async ({ page }) => {
  await page.goto("/");
  await rememberAndLeave(page);
  await library(page)
    .getByRole("button", { name: `Quitar ${NAME} de la lista` })
    .click();
  await library(page)
    .getByRole("button", { name: `Quitar ${NAME}`, exact: true })
    .click();
  await expect(library(page).getByRole("status")).toContainText(
    "Sus partidas se conservan",
  );
  await expect(continueCard(page)).toHaveCount(0);
  // Reopening the file still finds the exit snapshot.
  await open(page);
  await expect(
    page.getByRole("dialog", { name: "Continuar donde lo dejaste" }),
  ).toBeVisible();
});

test("a damaged copy on the device is refused with a clear message", async ({
  page,
}) => {
  await page.goto("/");
  await rememberAndLeave(page);
  await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const dir = await root.getDirectoryHandle("roms");
    for await (const name of (dir as any).keys()) {
      const file = await dir.getFileHandle(name);
      const stream = await file.createWritable();
      await stream.write(new Uint8Array([1, 2, 3]));
      await stream.close();
    }
  });
  await continueCard(page).getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("alert")).toContainText("dañada");
  await expect(page.getByRole("alert")).toContainText(
    "tus partidas siguen guardadas",
  );
  await exit(page);
  await expect(continueCard(page)).toBeVisible();
});

test("the home screen with a library fits a 375 px phone", async ({ page }) => {
  await page.goto("/");
  await rememberAndLeave(page);
  await page.setViewportSize({ width: 375, height: 800 });
  await expect(continueCard(page)).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("«Continuar» works offline in the installed build", async ({
  page,
  context,
  baseURL,
}) => {
  test.skip(
    !baseURL?.includes(":4173"),
    "The service worker only exists in the production build (preview).",
  );
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute(
    "data-offline-ready",
    "true",
  );
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await rememberAndLeave(page);
  await context.setOffline(true);
  await page.reload();
  await continueCard(page).getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByTestId("toast")).toContainText(
    "Partida cargada: al salir",
  );
  await running(page);
  await context.setOffline(false);
});
