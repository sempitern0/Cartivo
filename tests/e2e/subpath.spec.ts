import { test, expect } from "@playwright/test";
import { openNesFile, playDemo, playing } from "./play.ts";

// Cartivo deployed under a sub-path (/cartivo/): every link, the manifest,
// the service worker, the Worker and the cores stay inside it.
test("the app works under /cartivo/, also offline", async ({
  page,
  context,
  request,
}) => {
  const outside: string[] = [];
  page.on("request", (r) => {
    const url = new URL(r.url());
    if (url.host === "127.0.0.1:4174" && !url.pathname.startsWith("/cartivo/"))
      outside.push(url.pathname);
  });
  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: "Elige una consola" }),
  ).toBeVisible();

  // Manifest: start_url and scope resolve to the sub-path.
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  const manifestUrl = new URL(href!, page.url()).href;
  const manifest = await (await request.get(manifestUrl)).json();
  expect(new URL(manifest.start_url, manifestUrl).pathname).toBe("/cartivo/");
  expect(new URL(manifest.scope, manifestUrl).pathname).toBe("/cartivo/");
  for (const icon of manifest.icons)
    expect((await request.get(new URL(icon.src, manifestUrl).href)).ok()).toBe(
      true,
    );

  // A game, its core and the licence links.
  await playDemo(page, "Game Boy");
  await page.getByRole("button", { name: "Pausar juego" }).click();
  await page.getByText("Acerca de esta prueba", { exact: true }).click();
  const notice = await page
    .getByRole("link", { name: "Avisos de terceros" })
    .getAttribute("href");
  expect(notice).toBe("/cartivo/licenses/NOTICE.txt");
  expect((await request.get(new URL(notice!, page.url()).href)).ok()).toBe(
    true,
  );

  // The logo goes back to the sub-path's start, not the domain root.
  await page.getByRole("button", { name: "Salir", exact: true }).click();
  await page.goto("./#controles");
  await page.getByRole("link", { name: "Cartivo, inicio" }).click();
  expect(new URL(page.url()).pathname).toBe("/cartivo/");

  // Service worker scoped to the sub-path; the installed shell works offline.
  await expect(page.locator("html")).toHaveAttribute(
    "data-offline-ready",
    "true",
  );
  const scope = await page.evaluate(
    async () => (await navigator.serviceWorker.ready).scope,
  );
  expect(new URL(scope).pathname).toBe("/cartivo/");
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  await page
    .getByRole("article", { name: "NES", exact: true })
    .getByRole("button", { name: "Probar demo" })
    .click();
  await expect(page.getByTestId("player-phase")).toHaveText("Jugando");
  await context.setOffline(false);

  expect(outside, "requests outside /cartivo/").toEqual([]);
});

test("under /cartivo/ a remembered game shows «Continuar» after leaving", async ({
  page,
}) => {
  await page.goto("./");
  await openNesFile(page, "mi-juego.nes");
  await playing(page);
  await page.getByRole("button", { name: "Sí, recordar" }).click();
  await expect(page.getByTestId("toast")).toContainText("Juego recordado");
  await page.getByRole("button", { name: "Salir", exact: true }).click();
  const card = page.getByRole("article", { name: "mi-juego.nes", exact: true });
  await expect(card).toBeVisible();
  // It survives a reload, as an installed app reopening would.
  await page.reload();
  await expect(card).toBeVisible();
});
