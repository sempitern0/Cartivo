// Shared steps for E2E specs: open a game, wait until it really runs, and
// inject a fault into the emulator Worker. Older specs keep their own copies
// for now; new specs use these.
import { expect, type Page } from "./fixtures.ts";

export const frames = async (page: Page) =>
  Number(await page.locator("canvas").getAttribute("data-frames"));

/**
 * Waits for «Jugando» (starting over if a continue offer appears) and frames.
 * Loading a multi-file disc game under Vite dev in WebKit takes several
 * seconds, so the first wait gets more than the default 5 s.
 */
export async function playing(page: Page, minFrames = 10) {
  const offer = page.getByRole("button", { name: "Empezar de nuevo" });
  await expect
    .poll(
      async () =>
        (await page.getByTestId("player-phase").textContent())?.includes(
          "Jugando",
        ) || (await offer.count()) > 0,
      { timeout: 15000 },
    )
    .toBe(true);
  if (await offer.count()) await offer.click();
  await expect(page.getByTestId("player-phase")).toHaveText("Jugando");
  await expect
    .poll(() => frames(page), { timeout: 20000 })
    .toBeGreaterThan(minFrames);
}

/**
 * Starts a console's original demo (name as shown on its card, e.g. "Game
 * Boy") through the hidden `#demo/<id>` entry, from that card's «Jugar» so
 * the focus comes back there on leaving, as with a real launch.
 */
export async function startDemo(page: Page, console: string) {
  const card = page.getByRole("article", { name: console, exact: true });
  const heading = await card.getByRole("heading").getAttribute("id");
  const id = heading!.replace(/^console-/, "");
  await card.getByRole("button", { name: /^Jugar/ }).focus();
  await page.evaluate((id) => {
    location.hash = `#demo/${id}`;
  }, id);
}

/** startDemo, then waits until it really runs. */
export async function playDemo(page: Page, console: string, minFrames = 10) {
  await startDemo(page, console);
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
