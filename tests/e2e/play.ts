// Shared steps for E2E specs: open a game, wait until it really runs, and
// inject a fault into the emulator Worker. Older specs keep their own copies
// for now; new specs use these.
import { expect, type Page } from "./fixtures.ts";

export const frames = async (page: Page) =>
  Number(await page.locator("canvas").getAttribute("data-frames"));

/** Waits for «Jugando» (starting over if a continue offer appears) and frames. */
export async function playing(page: Page, minFrames = 10) {
  const offer = page.getByRole("button", { name: "Empezar de nuevo" });
  await expect
    .poll(
      async () =>
        (await page.getByTestId("player-phase").textContent())?.includes(
          "Jugando",
        ) || (await offer.count()) > 0,
    )
    .toBe(true);
  if (await offer.count()) await offer.click();
  await expect(page.getByTestId("player-phase")).toHaveText("Jugando");
  await expect
    .poll(() => frames(page), { timeout: 20000 })
    .toBeGreaterThan(minFrames);
}

/** «Probar demo» on a console card (name as shown, e.g. "Game Boy"). */
export async function playDemo(page: Page, console: string, minFrames = 10) {
  await page
    .getByRole("article", { name: console, exact: true })
    .getByRole("button", { name: "Probar demo" })
    .click();
  await playing(page, minFrames);
}

/** Opens Cartivo's own NES fixture as a local file named `name`. */
export async function openNesFile(page: Page, name = "juego.nes") {
  const { controlDemo } =
    await import("../../packages/fixtures/src/control-demo.ts");
  await page.locator("input[type=file]").setInputFiles({
    name,
    mimeType: "application/octet-stream",
    buffer: Buffer.from(controlDemo()),
  });
}

/**
 * Runs `code` at the top of the emulator Worker before its own code, to
 * break an API there (the page's addInitScript does not reach Workers).
 * The spec must block service workers so the request reaches the network.
 */
export async function patchWorker(page: Page, code: string) {
  await page.context().route(/emulator\.worker/, async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: `${code}\n${await response.text()}`,
    });
  });
}
