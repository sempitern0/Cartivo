import { test, expect, startAs } from "./fixtures.ts";
import { frames, openNesFile, patchWorker, playDemo } from "./play.ts";

// Controlled faults in a real browser (H1-QA): each one is injected on
// purpose, never left to timing or luck. Requests must reach the network
// so they can be rewritten, hence no service worker here.
test.use({ serviceWorkers: "block" });

test("a core served with the wrong MIME type still starts", async ({
  page,
}) => {
  await page.context().route(/sameboy[^/]*\.wasm/, async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: { ...response.headers(), "content-type": "text/plain" },
    });
  });
  await page.goto("/");
  await playDemo(page, "Game Boy", 30);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("no space to remember a game: it keeps playing and says why", async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName === "webkit",
    "OPFS is unavailable in Playwright's ephemeral WebKit profile.",
  );
  // The Worker's OPFS writes fail as if the disk were full.
  const full = `for (const proto of [globalThis.FileSystemSyncAccessHandle?.prototype, globalThis.FileSystemWritableFileStream?.prototype]) if (proto) proto.write = () => { throw new DOMException("full", "QuotaExceededError"); };\n`;
  await patchWorker(page, full);
  await page.goto("/");
  await openNesFile(page);
  // Opened files are remembered on load; the copy does not fit.
  await expect(page.getByTestId("player-phase")).toHaveText("Jugando");
  await expect(page.getByRole("alert")).toContainText(
    "No hay espacio para recordar este juego",
  );
  const before = await frames(page);
  await expect.poll(() => frames(page)).toBeGreaterThan(before + 30);
  // Nothing half-written reaches the library.
  await page.getByRole("button", { name: "Salir", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Elige una consola" }),
  ).toBeVisible();
  await expect(
    page.getByRole("article", { name: "juego.nes", exact: true }),
  ).toHaveCount(0);
});

test("closing the tab mid-game leaves a save that reopens cleanly", async ({
  browser,
}) => {
  const context = await browser.newContext({ serviceWorkers: "block" });
  await startAs(context);
  const first = await context.newPage();
  await first.goto("/");
  await playDemo(first, "Game Boy", 30);
  // The fixture counts A presses in battery RAM; then the tab just closes:
  // no Salir, no pause, a background commit possibly in flight.
  for (let i = 0; i < 3; i++) {
    await first.keyboard.down("KeyL");
    await first.waitForTimeout(120);
    await first.keyboard.up("KeyL");
  }
  await first.waitForTimeout(150);
  await first.close();

  const second = await context.newPage();
  const errors: string[] = [];
  second.on("pageerror", (e) => errors.push(e.message));
  await second.goto("/");
  await playDemo(second, "Game Boy", 30);
  // Either the last confirmed generation or the one before: never damaged.
  await expect(second.getByRole("alert")).toHaveCount(0);
  expect(errors).toEqual([]);
  await context.close();
});
