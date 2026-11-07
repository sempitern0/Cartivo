import { test, expect, type Page } from "./fixtures.ts";

// Game Boy Advance runs mGBA (ADR-011) with Cartivo's own fixture, which
// starts at once (HLE BIOS, no boot animation).
const frames = async (page: Page) =>
  Number(await page.locator("canvas").getAttribute("data-frames"));

async function playing(page: Page, after = 10) {
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
    .toBeGreaterThan(after);
}

const card = (page: Page) =>
  page.getByRole("article", { name: "Game Boy Advance", exact: true });

async function hold(page: Page, key: string) {
  await page.keyboard.down(key);
  await page.waitForTimeout(150);
  await page.keyboard.up(key);
  await page.waitForTimeout(100);
}

/** True when the canvas shows a pixel of this colour. */
const shows = (page: Page, rgb: [number, number, number]) =>
  page.locator("canvas").evaluate((canvas: HTMLCanvasElement, [r, g, b]) => {
    const { data } = canvas
      .getContext("2d")!
      .getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < data.length; i += 4)
      if (data[i] === r && data[i + 1] === g && data[i + 2] === b) return true;
    return false;
  }, rgb);

async function exportBackup(page: Page) {
  await page.getByText("Copias de partida", { exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar partida" }).click();
  const stream = await (await download).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString()) as {
    format: string;
    bytes: number[];
  };
}

test("GBA demo runs mGBA: L/R recolour, battery save survives", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await card(page).getByRole("button", { name: "Probar demo" }).click();
  await playing(page, 30);
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveAttribute("width", "240");
  await expect(canvas).toHaveAttribute("height", "160");
  await expect(canvas).toHaveAttribute("aria-label", /Game Boy Advance/);
  // L (I) paints the square yellow, R (O) magenta: the new buttons work.
  await hold(page, "KeyI");
  await expect.poll(() => shows(page, [255, 255, 0])).toBe(true);
  await hold(page, "KeyO");
  await expect.poll(() => shows(page, [255, 0, 255])).toBe(true);
  await hold(page, "KeyL"); // A counts in SRAM
  await page.getByRole("button", { name: "Pausar juego" }).click();
  await expect(page.getByTestId("save-status")).toContainText(
    "Partida guardada",
  );
  const backup = await exportBackup(page);
  expect(backup.format).toBe("cartivo-gba-sram-v1");
  expect(backup.bytes).toHaveLength(131072);
  expect(backup.bytes[0]).toBe(0); // 0xFF + one press

  await page.getByRole("button", { name: "Salir", exact: true }).click();
  await card(page).getByRole("button", { name: "Probar demo" }).click();
  await playing(page, 30);
  await page.getByRole("button", { name: "Pausar juego" }).click();
  expect((await exportBackup(page)).bytes[0]).toBe(0);
  expect(errors).toEqual([]);
});

test("GBA quick-saves with F5 and loads with F9", async ({ page }) => {
  await page.goto("/");
  await card(page).getByRole("button", { name: "Probar demo" }).click();
  await playing(page);
  await page.keyboard.press("F5");
  await expect(page.getByTestId("toast")).toContainText("ranura 1");
  await page.keyboard.press("F9");
  await expect(page.getByTestId("toast")).toContainText("Partida cargada");
  await expect(page.getByTestId("player-phase")).toHaveText("Jugando");
  await page.getByRole("button", { name: "Partidas" }).click();
  await expect(page.locator('[data-slot="1"]')).toContainText("mGBA");
});

test("a dropped .gba file opens Game Boy Advance", async ({ page }) => {
  const { gbaControlDemo } =
    await import("../../packages/fixtures/src/gba-control-demo.ts");
  await page.goto("/");
  const transfer = await page.evaluateHandle((bytes) => {
    const dt = new DataTransfer();
    dt.items.add(
      new File([new Uint8Array(bytes)], "original-demo.gba", {
        type: "application/octet-stream",
      }),
    );
    return dt;
  }, Array.from(gbaControlDemo()));
  await page.dispatchEvent("body", "dragover", { dataTransfer: transfer });
  await page.dispatchEvent("body", "drop", { dataTransfer: transfer });
  await playing(page);
  await expect(
    page.getByRole("heading", { name: "original-demo.gba" }),
  ).toBeVisible();
});

test("a damaged GBA file is refused with a clear message", async ({ page }) => {
  await page.goto("/");
  const chooser = page.waitForEvent("filechooser");
  await card(page).getByRole("button", { name: "Jugar", exact: true }).click();
  await (
    await chooser
  ).setFiles({
    name: "roto.gba",
    mimeType: "application/octet-stream",
    buffer: Buffer.alloc(0x1000, 0xff),
  });
  await expect(page.getByRole("alert")).toContainText("cabecera");
});
