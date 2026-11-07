import { test, expect } from "./fixtures.ts";
import { startDemo } from "./play.ts";
/** A previous exit snapshot shows «Continuar»; these tests start over. */
async function startOver(page: import("./fixtures.ts").Page) {
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
}

test("web app manifest is installable and its icons load", async ({
  page,
  request,
}) => {
  await page.goto("/");
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(href).toBeTruthy();
  // Manifest URLs resolve against the manifest itself (root or sub-path).
  const manifestUrl = new URL(href!, page.url()).href;
  const response = await request.get(manifestUrl);
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
    const r = await request.get(new URL(icon.src, manifestUrl).href);
    expect(r.ok(), icon.src).toBe(true);
  }
  expect(manifest.file_handlers[0].accept["application/x-nes-rom"]).toContain(
    ".nes",
  );
});

test("dropping a .nes file starts the game without navigating away", async ({
  page,
}) => {
  const { controlDemo } = await import(
    "../../packages/fixtures/src/control-demo.ts"
  );
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
  const problems: string[] = [];
  page.on("requestfailed", (r) =>
    problems.push(`failed ${r.url()} ${r.failure()?.errorText}`),
  );
  page.on("pageerror", (e) => problems.push(`pageerror ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(`console ${m.text()}`);
  });
  await context.setOffline(true);
  await page.reload();
  await expect(
    page
      .getByRole("article", { name: "NES", exact: true })
      .getByRole("button", { name: "Jugar", exact: true }),
    problems.join("\n"),
  )
    .toBeVisible({ timeout: 10000 })
    .catch(async (e) => {
      const html = (await page.content()).slice(0, 800);
      throw new Error(`${e.message}\n${problems.join("\n")}\n${html}`);
    });
  await startDemo(page, "NES");
  await startOver(page);
  await expect
    .poll(async () =>
      Number(await page.locator("canvas").getAttribute("data-frames")),
    )
    .toBeGreaterThan(10);
  await context.setOffline(false);
});

test("an explicit activation is refused while another Cartivo tab is open", async ({
  page,
  context,
  baseURL,
}) => {
  test.skip(
    !baseURL?.includes(":4173"),
    "Requires the production service worker.",
  );
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute(
    "data-offline-ready",
    "true",
  );
  const other = await context.newPage();
  await other.goto("/");
  await expect(other.locator("html")).toHaveAttribute(
    "data-offline-ready",
    "true",
  );
  const accepted = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return new Promise<boolean>((resolve, reject) => {
      const channel = new MessageChannel();
      const timer = setTimeout(() => {
        channel.port1.close();
        reject(new Error("No activation reply"));
      }, 3000);
      channel.port1.onmessage = (event) => {
        clearTimeout(timer);
        channel.port1.close();
        resolve(event.data.accepted);
      };
      registration.active!.postMessage({ type: "cartivo:activate-update" }, [
        channel.port2,
      ]);
    });
  });
  expect(accepted).toBe(false);
  await other.close();
});
