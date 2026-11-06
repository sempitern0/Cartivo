import { test, expect, type Page } from "./fixtures.ts";

// Master System and Mega Drive run Genesis Plus GX (ADR-014) with Cartivo's
// own Z80 and 68000 fixtures. Mega Drive colours use 3-bit levels (239).
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

const card = (page: Page, name: string) =>
  page.getByRole("article", { name, exact: true });

async function hold(page: Page, key: string) {
  await page.keyboard.down(key);
  await page.waitForTimeout(150);
  await page.keyboard.up(key);
  await page.waitForTimeout(100);
}

/** True when the canvas shows a pixel of this colour. */
const shows = (page: Page, rgb: readonly number[]) =>
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

test("Mega Drive demo: six-button pad recolours, SRAM survives", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await card(page, "Mega Drive")
    .getByRole("button", { name: "Probar demo" })
    .click();
  await playing(page, 30);
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveAttribute("width", "320");
  await expect(canvas).toHaveAttribute("height", "224");
  // A = J, X = I, Y = U, Z = O; B (K) turns the backdrop red.
  for (const [key, rgb] of [
    ["KeyJ", [239, 239, 0]],
    ["KeyI", [0, 239, 239]],
    ["KeyU", [239, 0, 239]],
    ["KeyO", [239, 138, 0]],
    ["KeyK", [239, 0, 0]],
  ] as const) {
    await page.keyboard.down(key);
    await expect.poll(() => shows(page, rgb)).toBe(true);
    await page.keyboard.up(key);
  }
  await hold(page, "KeyL"); // C counts in SRAM: $FF → $00, blue backdrop
  await expect.poll(() => shows(page, [0, 0, 239])).toBe(true);
  await page.getByRole("button", { name: "Pausar juego" }).click();
  // In pause the demo hint uses the console's own names.
  await expect(
    page.getByText("WASD o flechas para moverte · J = A · K = B · L = C."),
  ).toBeVisible();
  const backup = await exportBackup(page);
  expect(backup.format).toBe("cartivo-md-sram-v1");
  expect(backup.bytes).toHaveLength(65536);
  expect(backup.bytes[1]).toBe(0);

  await page.getByRole("button", { name: "Salir", exact: true }).click();
  await card(page, "Mega Drive")
    .getByRole("button", { name: "Probar demo" })
    .click();
  await playing(page, 30);
  await expect.poll(() => shows(page, [0, 0, 239])).toBe(true);
  expect(errors).toEqual([]);
});

test("Master System demo: button 1 recolours, cartridge RAM survives", async ({
  page,
}) => {
  await page.goto("/");
  await card(page, "Master System")
    .getByRole("button", { name: "Probar demo" })
    .click();
  await playing(page, 30);
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveAttribute("width", "256");
  await expect(canvas).toHaveAttribute("height", "192");
  await page.keyboard.down("KeyK"); // button 1
  await expect.poll(() => shows(page, [255, 255, 0])).toBe(true);
  await page.keyboard.up("KeyK");
  await hold(page, "KeyL"); // button 2 counts: $FF → $00, blue
  await expect.poll(() => shows(page, [0, 0, 255])).toBe(true);
  await page.getByRole("button", { name: "Pausar juego" }).click();
  const backup = await exportBackup(page);
  expect(backup.format).toBe("cartivo-sms-sram-v1");
  expect(backup.bytes[0]).toBe(0);
  await page.getByRole("button", { name: "Salir", exact: true }).click();
  await card(page, "Master System")
    .getByRole("button", { name: "Probar demo" })
    .click();
  await playing(page, 30);
  await expect.poll(() => shows(page, [0, 0, 255])).toBe(true);
});

test("Mega Drive quick-saves with F5 and loads with F9", async ({ page }) => {
  await page.goto("/");
  await card(page, "Mega Drive")
    .getByRole("button", { name: "Probar demo" })
    .click();
  await playing(page);
  await page.keyboard.press("F5");
  await expect(page.getByTestId("toast")).toContainText("ranura 1");
  await page.keyboard.press("F9");
  await expect(page.getByTestId("toast")).toContainText("Partida cargada");
  await page.getByRole("button", { name: "Partidas" }).click();
  await expect(page.locator('[data-slot="1"]')).toContainText(
    "Genesis Plus GX",
  );
});

test("a dropped .gen file opens Mega Drive; a damaged one is refused", async ({
  page,
}) => {
  const { mdControlDemo } =
    await import("../../packages/fixtures/src/md-control-demo.ts");
  await page.goto("/");
  const transfer = await page.evaluateHandle((bytes) => {
    const dt = new DataTransfer();
    dt.items.add(
      new File([new Uint8Array(bytes)], "original-demo.gen", {
        type: "application/octet-stream",
      }),
    );
    return dt;
  }, Array.from(mdControlDemo()));
  await page.dispatchEvent("body", "dragover", { dataTransfer: transfer });
  await page.dispatchEvent("body", "drop", { dataTransfer: transfer });
  await playing(page);
  await expect(
    page.getByRole("heading", { name: "original-demo.gen" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Salir", exact: true }).click();

  const chooser = page.waitForEvent("filechooser");
  await card(page, "Mega Drive")
    .getByRole("button", { name: "Jugar", exact: true })
    .click();
  await (
    await chooser
  ).setFiles({
    name: "roto.md",
    mimeType: "application/octet-stream",
    buffer: Buffer.alloc(0x8000, 0xff),
  });
  await expect(page.getByRole("alert")).toContainText("cabecera");
});

test("Controles explains where each console finds its buttons", async ({
  page,
}) => {
  await page.goto("/#controles");
  await expect(
    page.getByText(
      "En Mega Drive, A, B, C, X, Y, Z y Mode están en Y, B, A, L, X, R y Select.",
    ),
  ).toBeVisible();
  await expect(
    page.getByText("En Master System, 1, 2 y Pause están en B, A y Start."),
  ).toBeVisible();
});
