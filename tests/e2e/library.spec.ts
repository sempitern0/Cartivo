import { test, expect, type Page } from "./fixtures.ts";

// Local library and «Continuar» (ADR-012) with Cartivo's own NES fixture.
const NAME = "mi-juego.nes";

// Playwright's WebKit runs every test in an ephemeral profile where OPFS is
// unavailable (navigator.storage.getDirectory() fails), like a Safari private
// window. Cartivo then keeps playing and explains it cannot remember the game;
// the library itself needs a normal Safari profile (manual QA, H1-QA).
test.skip(
  ({ browserName }) => browserName === "webkit",
  "OPFS is unavailable in Playwright's ephemeral WebKit profile.",
);

/**
 * The fixture under another name; `variant` flips the last CHR byte (one
 * pixel of a tile), so each variant is a different game for the library.
 */
async function game(name = NAME, variant = 0) {
  const { controlDemo } = await import(
    "../../packages/fixtures/src/control-demo.ts"
  );
  const rom = controlDemo();
  rom[rom.length - 1] ^= variant;
  return {
    name,
    mimeType: "application/octet-stream",
    buffer: Buffer.from(rom),
  };
}

async function open(page: Page, name = NAME, variant = 0) {
  await page
    .locator("input[type=file]")
    .setInputFiles(await game(name, variant));
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
const games = (page: Page) =>
  page.getByRole("link", { name: "Tus juegos", exact: true }).click();

/** Opens a game and leaves: it is remembered without asking. */
async function playAndLeave(page: Page, name = NAME, variant = 0) {
  await open(page, name, variant);
  await running(page);
  await exit(page);
  await expect(
    page
      .getByRole("article", { name, exact: true })
      .or(page.getByRole("button", { name: `Continuar ${name}` })),
  ).toBeVisible();
}

test("a remembered game continues from the home screen with one click", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await playAndLeave(page);
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
  expect(chooser).toBe(false);
  expect(errors).toEqual([]);
});

test("the home shows the last three; «Tus juegos» searches and filters", async ({
  page,
}) => {
  await page.goto("/");
  for (const [i, name] of [
    "alfa.nes",
    "beta.nes",
    "gamma.nes",
    "delta.nes",
  ].entries())
    await playAndLeave(page, name, i + 1);
  // Most recent first: delta (large card), gamma and beta; alfa only on the page.
  await expect(
    page.getByRole("article", { name: "delta.nes", exact: true }),
  ).toBeVisible();
  const recent = page.getByRole("region", { name: "Juegos recientes" });
  await expect(recent.getByRole("button", { name: /^Continuar / })).toHaveCount(
    2,
  );
  await expect(
    recent.getByRole("button", { name: "Continuar alfa.nes" }),
  ).toHaveCount(0);
  await recent.getByRole("link", { name: "Ver todos tus juegos (4)" }).click();

  await expect(
    page.getByRole("heading", { name: "Tus juegos", level: 1 }),
  ).toBeFocused();
  await expect(library(page).getByRole("listitem")).toHaveCount(4);
  await library(page)
    .getByRole("searchbox", { name: "Buscar por nombre" })
    .fill("ALFA");
  await expect(library(page).getByRole("listitem")).toHaveCount(1);
  await library(page).getByRole("searchbox").fill("zzz");
  await expect(library(page).getByRole("status")).toHaveText(
    "Ningún juego coincide.",
  );
  await library(page).getByRole("searchbox").fill("");
  // One console only: no console chips to choose from.
  await expect(
    library(page).getByRole("group", { name: "Consola" }),
  ).toHaveCount(0);
  await library(page).getByRole("combobox").selectOption("name");
  await expect(library(page).getByRole("listitem").first()).toContainText(
    "alfa.nes",
  );

  await library(page)
    .getByRole("button", { name: "Continuar alfa.nes" })
    .click();
  await running(page);
  await expect(page.getByRole("heading", { name: "alfa.nes" })).toBeVisible();
});

test("turning remembering off keeps new games out of the list", async ({
  page,
}) => {
  await page.goto("/");
  await playAndLeave(page);
  await games(page);
  await library(page)
    .getByRole("checkbox", { name: /Recordar juegos nuevos/ })
    .uncheck();
  await expect(library(page).getByRole("status")).toContainText(
    "no se recordarán",
  );
  await page.getByRole("link", { name: "Volver al inicio" }).click();
  await open(page, "otro.nes", 7);
  await running(page);
  await exit(page);
  await expect(
    page.getByRole("button", { name: "Continuar otro.nes" }),
  ).toHaveCount(0);
  await expect(page.getByRole("article", { name: "otro.nes" })).toHaveCount(0);
  await games(page);
  await expect(library(page).getByRole("listitem")).toHaveCount(1);
  await expect(
    library(page).getByRole("checkbox", { name: /Recordar juegos nuevos/ }),
  ).not.toBeChecked();
});

test("removing a game from the list keeps its Partidas", async ({ page }) => {
  await page.goto("/");
  await playAndLeave(page);
  await games(page);
  await library(page)
    .getByRole("button", { name: `Quitar ${NAME} de la lista` })
    .click();
  await library(page)
    .getByRole("button", { name: `Quitar ${NAME}`, exact: true })
    .click();
  await expect(library(page).getByRole("status")).toContainText(
    "Sus partidas se conservan",
  );
  await page.getByRole("link", { name: "Volver al inicio" }).click();
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
  await playAndLeave(page);
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
  await playAndLeave(page);
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
  await playAndLeave(page);
  await context.setOffline(true);
  await page.reload();
  await continueCard(page).getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByTestId("toast")).toContainText(
    "Partida cargada: al salir",
  );
  await running(page);
  await context.setOffline(false);
});

test.describe("load diagnostics", () => {
  test.use({ serviceWorkers: "block" });
  test("a remembered ROM is hashed only once on resume", async ({ page }) => {
    const { patchWorker } = await import("./play.ts");
    await page.goto("/");
    await playAndLeave(page);
    const size = (await game()).buffer.length;
    await patchWorker(
      page,
      `{
      const digest = crypto.subtle.digest.bind(crypto.subtle);
      let romHashes = 0;
      crypto.subtle.digest = (algorithm, data) => {
        if (data.byteLength === ${size} && ++romHashes > 1) throw new Error("ROM hashed twice");
        return digest(algorithm, data);
      };
    }`,
    );
    await continueCard(page).getByRole("button", { name: "Continuar" }).click();
    await running(page);
    // Restored snapshots already contain frames: wait for new advance samples.
    const before = Number(
      await page.locator("canvas").getAttribute("data-frames"),
    );
    await expect
      .poll(async () =>
        Number(await page.locator("canvas").getAttribute("data-frames")),
      )
      .toBeGreaterThan(before + 5);
    await page.keyboard.press("Escape");
    await page.getByText("Rendimiento de la sesión", { exact: true }).click();
    await expect(page.getByTestId("load-duration")).toContainText(
      "Preparación del juego:",
    );
    await expect(page.getByRole("alert")).toHaveCount(0);
  });
});
