import { test, expect, type Page } from "@playwright/test";

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

test("leaving saves automatically and reopening offers to continue", async ({
  page,
}) => {
  await page.goto("/");
  await open(page);
  await running(page);
  await page.getByRole("button", { name: "Salir", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Jugar", exact: true }),
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
