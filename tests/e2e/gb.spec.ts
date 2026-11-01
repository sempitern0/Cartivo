import { test, expect, type Page } from "@playwright/test";

// Game Boy and Game Boy Color run SameBoy (ADR-010) with Cartivo's own
// fixture; the boot ROM animation takes a few seconds before the program.
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

/** The fixture counts each A press in battery RAM ($A000). */
async function pressA(page: Page) {
  await page.keyboard.down("KeyL");
  await page.waitForTimeout(150);
  await page.keyboard.up("KeyL");
  await page.waitForTimeout(100);
}

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

for (const { name, color, format } of [
  { name: "Game Boy", color: false, format: "cartivo-gb-sram-v1" },
  { name: "Game Boy Color", color: true, format: "cartivo-gbc-sram-v1" },
]) {
  test(`${name} demo runs SameBoy and keeps its battery RAM`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/");
    await card(page, name).getByRole("button", { name: "Probar demo" }).click();
    await playing(page, 320); // past the boot ROM animation
    const canvas = page.locator("canvas");
    await expect(canvas).toHaveAttribute("width", "160");
    await expect(canvas).toHaveAttribute("height", "144");
    await expect(canvas).toHaveAttribute(
      "aria-label",
      new RegExp(`Pantalla del juego ${name}\\.`),
    );
    await pressA(page);
    await page.getByRole("button", { name: "Pausar juego" }).click();
    await expect(page.getByTestId("save-status")).toContainText(
      "Partida guardada",
    );
    const backup = await exportBackup(page);
    expect(backup.format).toBe(format);
    expect(backup.bytes).toHaveLength(8192);
    const counter = backup.bytes[0];

    // Reopening the same game keeps the counter (battery RAM in IndexedDB).
    await page.getByRole("button", { name: "Salir", exact: true }).click();
    await card(page, name).getByRole("button", { name: "Probar demo" }).click();
    await playing(page, 320);
    await page.getByRole("button", { name: "Pausar juego" }).click();
    expect((await exportBackup(page)).bytes[0]).toBe(counter);
    expect(errors).toEqual([]);
    // The fixture variant matches the card: CGB flag only for Color.
    const { gbControlDemo } =
      await import("../../packages/fixtures/src/gb-control-demo.ts");
    expect(gbControlDemo(color)[0x143]).toBe(color ? 0x80 : 0);
  });
}

test("Game Boy quick-saves with F5 and loads with F9", async ({ page }) => {
  await page.goto("/");
  await card(page, "Game Boy")
    .getByRole("button", { name: "Probar demo" })
    .click();
  await playing(page, 320);
  await page.keyboard.press("F5");
  await expect(page.getByTestId("toast")).toContainText("ranura 1");
  await page.keyboard.press("F9");
  await expect(page.getByTestId("toast")).toContainText("Partida cargada");
  await expect(page.getByTestId("player-phase")).toHaveText("Jugando");
  await page.getByRole("button", { name: "Partidas" }).click();
  await expect(page.locator('[data-slot="1"]')).toContainText("SameBoy");
});

test("a dropped .gbc file opens Game Boy Color by its extension", async ({
  page,
}) => {
  const { gbControlDemo } =
    await import("../../packages/fixtures/src/gb-control-demo.ts");
  await page.goto("/");
  const transfer = await page.evaluateHandle(
    (bytes) => {
      const dt = new DataTransfer();
      dt.items.add(
        new File([new Uint8Array(bytes)], "original-demo.gbc", {
          type: "application/octet-stream",
        }),
      );
      return dt;
    },
    Array.from(gbControlDemo(true)),
  );
  await page.dispatchEvent("body", "dragover", { dataTransfer: transfer });
  await page.dispatchEvent("body", "drop", { dataTransfer: transfer });
  await playing(page);
  await expect(
    page.getByRole("heading", { name: "original-demo.gbc" }),
  ).toBeVisible();
  await expect(page.locator("canvas")).toHaveAttribute(
    "aria-label",
    /Game Boy Color/,
  );
});

test("a damaged Game Boy file is refused with a clear message", async ({
  page,
}) => {
  await page.goto("/");
  const chooser = page.waitForEvent("filechooser");
  await card(page, "Game Boy")
    .getByRole("button", { name: "Jugar", exact: true })
    .click();
  await (
    await chooser
  ).setFiles({
    name: "roto.gb",
    mimeType: "application/octet-stream",
    buffer: Buffer.alloc(0x8000, 0xff),
  });
  await expect(page.getByRole("alert")).toContainText("cabecera");
  await page.getByRole("button", { name: "Salir", exact: true }).click();
  await expect(card(page, "Game Boy")).toBeVisible();
});

test("square-pixel systems hide the redundant aspect options", async ({
  page,
}) => {
  await page.goto("/");
  await card(page, "Game Boy")
    .getByRole("button", { name: "Probar demo" })
    .click();
  await playing(page);
  await page.getByRole("button", { name: "Gráficos" }).click();
  const panel = page.locator("#graphics-panel");
  await expect(panel.getByText("Píxel entero")).toBeVisible();
  await expect(panel.getByText("Proporción")).toHaveCount(0);
  await expect(panel.getByText("10:9 entero")).toHaveCount(0);
});
