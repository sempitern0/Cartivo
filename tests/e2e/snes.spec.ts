import { test, expect, type Page } from "./fixtures.ts";
import { startDemo } from "./play.ts";

// SNES runs Snes9x (ADR-013) with Cartivo's own 65816 fixture.
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
  page.getByRole("article", { name: "SNES", exact: true });

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

test("SNES demo runs Snes9x: X/Y/L/R recolour, battery save survives", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await startDemo(page, "SNES");
  await playing(page, 30);
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveAttribute("width", "256");
  await expect(canvas).toHaveAttribute("height", "224");
  await expect(canvas).toHaveAttribute("aria-label", /SNES/);
  // Default keys: X = U, Y = J, L = I, R = O.
  for (const [key, rgb] of [
    ["KeyU", [255, 255, 0]],
    ["KeyJ", [0, 255, 255]],
    ["KeyI", [255, 0, 255]],
    ["KeyO", [255, 134, 0]],
  ] as const) {
    await page.keyboard.down(key);
    await expect.poll(() => shows(page, [...rgb])).toBe(true);
    await page.keyboard.up(key);
  }
  await hold(page, "KeyL"); // A counts in battery RAM
  await expect.poll(() => shows(page, [0, 255, 0])).toBe(true);
  await page.getByRole("button", { name: "Pausar juego" }).click();
  await expect(page.getByTestId("save-status")).toContainText(
    "Partida guardada",
  );
  const backup = await exportBackup(page);
  expect(backup.format).toBe("cartivo-snes-sram-v1");
  expect(backup.bytes).toHaveLength(2048);
  expect(backup.bytes[0]).toBe(1);

  await page.getByRole("button", { name: "Guardar y salir", exact: true }).click();
  await startDemo(page, "SNES");
  await playing(page, 30);
  await expect.poll(() => shows(page, [0, 255, 0])).toBe(true);
  await page.getByRole("button", { name: "Pausar juego" }).click();
  expect((await exportBackup(page)).bytes[0]).toBe(1);
  expect(errors).toEqual([]);
});

test("SNES quick-saves with F5 and loads with F9", async ({ page }) => {
  await page.goto("/");
  await startDemo(page, "SNES");
  await playing(page);
  await page.keyboard.press("F5");
  await expect(page.getByTestId("toast")).toContainText("ranura 1");
  await page.keyboard.press("F9");
  await expect(page.getByTestId("toast")).toContainText("Partida cargada");
  await expect(page.getByTestId("player-phase")).toHaveText("Jugando");
  await page.getByRole("button", { name: "Partidas" }).click();
  await expect(page.locator('[data-slot="1"]')).toContainText("Snes9x");
});

test("a dropped .sfc file opens SNES", async ({ page }) => {
  const { snesControlDemo } =
    await import("../../packages/fixtures/src/snes-control-demo.ts");
  await page.goto("/");
  const transfer = await page.evaluateHandle((bytes) => {
    const dt = new DataTransfer();
    dt.items.add(
      new File([new Uint8Array(bytes)], "original-demo.sfc", {
        type: "application/octet-stream",
      }),
    );
    return dt;
  }, Array.from(snesControlDemo()));
  await page.dispatchEvent("body", "dragover", { dataTransfer: transfer });
  await page.dispatchEvent("body", "drop", { dataTransfer: transfer });
  await playing(page);
  await expect(
    page.getByRole("heading", { name: "original-demo.sfc" }),
  ).toBeVisible();
});

test("a damaged SNES file is refused with a clear message", async ({
  page,
}) => {
  await page.goto("/");
  const chooser = page.waitForEvent("filechooser");
  await card(page).getByRole("button", { name: "Jugar", exact: true }).click();
  await (
    await chooser
  ).setFiles({
    name: "roto.sfc",
    mimeType: "application/octet-stream",
    buffer: Buffer.alloc(0x8000, 0xff),
  });
  await expect(page.getByRole("alert")).toContainText("cabecera");
});

test("Controles shows X and Y and says which consoles use them", async ({
  page,
}) => {
  await page.goto("/#controles");
  await expect(
    page.getByRole("button", { name: "Asignar tecla X", exact: true }),
  ).toContainText("U");
  await expect(
    page.getByRole("button", { name: "Asignar tecla Y", exact: true }),
  ).toContainText("J");
  await expect(
    page.getByText("X e Y solo los usan SNES, Mega Drive, PlayStation y N64."),
  ).toBeVisible();
});
