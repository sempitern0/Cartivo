import { test, expect } from "@playwright/test";

test("web app manifest is installable and its icons load", async ({
  page,
  request,
}) => {
  await page.goto("/");
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(href).toBeTruthy();
  const response = await request.get(href!);
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest.name).toBe("Cartivo");
  expect(manifest.display).toBe("standalone");
  expect(manifest.start_url).toBeTruthy();
  const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
  expect(sizes).toContain("192x192");
  expect(sizes).toContain("512x512");
  expect(
    manifest.icons.some((i: { purpose?: string }) => i.purpose === "maskable"),
  ).toBe(true);
  for (const icon of manifest.icons) {
    const r = await request.get(icon.src);
    expect(r.ok(), icon.src).toBe(true);
  }
  expect(manifest.file_handlers[0].accept["application/x-nes-rom"]).toContain(
    ".nes",
  );
});

test("dropping a .nes file starts the game without navigating away", async ({
  page,
}) => {
  const { controlDemo } =
    await import("../../packages/fixtures/src/control-demo.ts");
  await page.goto("/");
  const url = page.url();
  const transfer = await page.evaluateHandle((bytes) => {
    const dt = new DataTransfer();
    dt.items.add(
      new File([new Uint8Array(bytes)], "original-demo.nes", {
        type: "application/octet-stream",
      }),
    );
    return dt;
  }, Array.from(controlDemo()));
  await page.dispatchEvent("body", "dragover", { dataTransfer: transfer });
  await page.dispatchEvent("body", "drop", { dataTransfer: transfer });
  await expect(page.getByTestId("player-phase")).toHaveText("Jugando");
  expect(page.url()).toBe(url);
});

test("installed shell reopens offline and plays the demo", async ({
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
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("button", { name: "Probar demo" }).click();
  await expect(page.getByTestId("player-phase")).toHaveText("Jugando");
  await expect
    .poll(async () =>
      Number(await page.locator("canvas").getAttribute("data-frames")),
    )
    .toBeGreaterThan(10);
  await context.setOffline(false);
});
