import { test, expect, type Page } from "./fixtures.ts";

// UxROM without battery, like Contra: only «Partidas» can keep progress.
async function contraLike() {
  const { controlDemo } =
    await import("../../packages/fixtures/src/control-demo.ts");
  const demo = controlDemo();
  const rom = new Uint8Array(16 + 65536 + 8192);
  rom.set(demo.subarray(0, 16));
  rom[4] = 4;
  rom[6] = 0x20;
  for (let bank = 0; bank < 4; bank++)
    rom.set(demo.subarray(16, 16 + 16384), 16 + bank * 16384);
  rom.set(demo.subarray(16 + 16384), 16 + 65536);
  return {
    name: "sin-bateria.nes",
    mimeType: "application/octet-stream",
    buffer: Buffer.from(rom),
  };
}

async function open(page: Page) {
  await page.locator("input[type=file]").setInputFiles(await contraLike());
}

async function running(page: Page) {
  await expect(page.getByTestId("player-phase")).toHaveText("Jugando");
  await expect
    .poll(async () =>
      Number(await page.locator("canvas").getAttribute("data-frames")),
    )
    .toBeGreaterThan(10);
}

test("slots save and load the exact moment of a game without battery", async ({
  page,
}) => {
  await page.goto("/");
  await open(page);
  await running(page);
  await page.getByRole("button", { name: "Partidas" }).click();
  await expect(page.getByTestId("player-phase")).toHaveText("En pausa");
  const panel = page.getByRole("region", { name: "Partidas" });
  await expect(panel).toContainText("Al salir");
  await page.getByRole("button", { name: "Guardar en Ranura 2" }).click();
  await expect(page.getByTestId("toast")).toContainText("ranura 2");
  await expect(panel.locator('[data-slot="2"]')).toContainText("TetaNES");
  await page.getByRole("button", { name: "Cargar Ranura 2" }).click();
  await page
    .getByRole("button", { name: "Confirmar carga de Ranura 2" })
    .click();
  await expect(page.getByTestId("toast")).toContainText("Partida cargada");
  await running(page);
  // Delete it again.
  await page.getByRole("button", { name: "Partidas" }).click();
  await page.getByRole("button", { name: "Borrar Ranura 2" }).click();
  await expect(panel.locator('[data-slot="2"]')).toContainText("Vacía");
});

test("a slot is exported to a file and imported back", async ({ page }) => {
  await page.goto("/");
  await open(page);
  await running(page);
  await page.getByRole("button", { name: "Partidas" }).click();
  const panel = page.getByRole("region", { name: "Partidas" });
  await page.getByRole("button", { name: "Guardar en Ranura 1" }).click();
  await expect(panel.locator('[data-slot="1"]')).toContainText("TetaNES");

  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar Ranura 1" }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(
    /^cartivo-nes-ranura-1-\d{8}-\d{4}\.json$/,
  );
  const chunks: Buffer[] = [];
  for await (const chunk of (await download.createReadStream())!)
    chunks.push(chunk as Buffer);
  const exported = Buffer.concat(chunks);
  const file = JSON.parse(exported.toString("utf8"));
  expect(file.format).toBe("cartivo-state-v1");
  expect(file.slot).toBe("1");
  expect(file.core).toBe("tetanes");

  const importFile = (buffer: Buffer) =>
    panel.locator("input[type=file]").setInputFiles({
      name: "partida.json",
      mimeType: "application/json",
      buffer,
    });

  // Into an occupied slot: it asks first.
  await importFile(exported);
  await expect(panel).toContainText("Ranura 1 ya tiene una partida.");
  await page.getByRole("button", { name: "Cancelar" }).click();

  // Empty slot: it goes straight back to where it came from, and loads.
  await page.getByRole("button", { name: "Borrar Ranura 1" }).click();
  await expect(panel.locator('[data-slot="1"]')).toContainText("Vacía");
  await importFile(exported);
  await expect(page.getByTestId("toast")).toContainText("Partida importada");
  await expect(panel.locator('[data-slot="1"]')).toContainText("TetaNES");
  await page.getByRole("button", { name: "Cargar Ranura 1" }).click();
  await page
    .getByRole("button", { name: "Confirmar carga de Ranura 1" })
    .click();
  await expect(page.getByTestId("toast")).toContainText("Partida cargada");
  await running(page);

  // A snapshot of another game is refused and nothing changes.
  await page.getByRole("button", { name: "Partidas" }).click();
  await page.getByRole("button", { name: "Borrar Ranura 1" }).click();
  await importFile(
    Buffer.from(JSON.stringify({ ...file, game: "b".repeat(64) })),
  );
  await expect(page.getByRole("alert")).toContainText(
    "Esta partida es de otro juego.",
  );
  await expect(panel.locator('[data-slot="1"]')).toContainText("Vacía");
});

test("leaving saves automatically and reopening offers to continue", async ({
  page,
}) => {
  await page.goto("/");
  await open(page);
  await running(page);
  await page.getByRole("button", { name: "Salir", exact: true }).click();
  await expect(
    page.getByRole("article", { name: "NES", exact: true }).getByRole("button", { name: "Jugar", exact: true }),
  ).toBeVisible();
  await open(page);
  const offer = page.getByRole("dialog", {
    name: "Continuar donde lo dejaste",
  });
  await expect(offer).toBeVisible();
  await expect(page.getByTestId("player-phase")).toHaveText("En pausa");
  await offer.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByTestId("toast")).toContainText("al salir");
  await running(page);
  // Starting over is also possible.
  await page.getByRole("button", { name: "Salir", exact: true }).click();
  await expect(
    page.getByRole("article", { name: "NES", exact: true }).getByRole("button", { name: "Jugar", exact: true }),
  ).toBeVisible();
  await open(page);
  await page.getByRole("button", { name: "Empezar de nuevo" }).click();
  await expect(offer).toHaveCount(0);
  await running(page);
});

test("F5 quick-saves without reloading and F9 quick-loads", async ({
  page,
}) => {
  await page.goto("/");
  await open(page);
  await running(page);
  const url = page.url();
  await page.keyboard.press("F5");
  await expect(page.getByTestId("toast")).toContainText("ranura 1");
  expect(page.url()).toBe(url);
  await page.keyboard.press("F9");
  await expect(page.getByTestId("toast")).toContainText("Partida cargada");
  await running(page);
});

test("cancelling Cargar ROM keeps the current game paused and intact", async ({
  page,
}) => {
  await page.goto("/");
  await open(page);
  await running(page);
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Cargar ROM" }).click();
  await (await chooser).setFiles([]);
  await expect(page.getByTestId("player-phase")).toHaveText("En pausa");
  await expect(
    page.getByRole("heading", { name: "sin-bateria.nes" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reanudar juego" }).click();
  await running(page);
});

test("hiding the tab pauses and keeps an exit snapshot", async ({ page }) => {
  await page.goto("/");
  await open(page);
  await running(page);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.getByTestId("player-phase")).toHaveText("En pausa");
  // Back to visible and reopen: the exit snapshot is offered.
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => false,
    });
  });
  await page.getByRole("button", { name: "Partidas" }).click();
  await expect(
    page
      .getByRole("region", { name: "Partidas" })
      .locator('[data-slot="auto"]'),
  ).toContainText("TetaNES");
});

test("leaving right after a quick save loses nothing and leaks no workers", async ({
  page,
}) => {
  await page.goto("/");
  for (let cycle = 0; cycle < 5; cycle++) {
    await open(page);
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
    await running(page);
    await page.keyboard.press("F5");
    await page.getByRole("button", { name: "Salir", exact: true }).click();
    await expect(
      page.getByRole("article", { name: "NES", exact: true }).getByRole("button", { name: "Jugar", exact: true }),
    ).toBeVisible();
  }
  await expect.poll(() => page.workers().length).toBe(0);
  await open(page);
  await expect(
    page.getByRole("dialog", { name: "Continuar donde lo dejaste" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Partidas" }).click();
  await expect(
    page.getByRole("region", { name: "Partidas" }).locator('[data-slot="1"]'),
  ).toContainText("TetaNES");
});
