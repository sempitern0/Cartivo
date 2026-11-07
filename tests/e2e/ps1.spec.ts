import { test, expect, type Page } from "./fixtures.ts";
import { playDemo, playing } from "./play.ts";

// PlayStation runs PCSX-ReARMed with its HLE BIOS (ADR-015) and Cartivo's
// own PS-EXE fixture, which reaches the core through the disc VFS. The
// core widens 15-bit colour: full intensity is 255.
const card = (page: Page) =>
  page.getByRole("article", { name: "PlayStation", exact: true });

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

async function demoExe() {
  const { ps1ControlDemo } =
    await import("../../packages/fixtures/src/ps1-control-demo.ts");
  return Buffer.from(ps1ControlDemo());
}

test("PlayStation demo: the HLE BIOS boots it and the pad recolours it", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await playDemo(page, "PlayStation", 30);
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveAttribute("width", "640");
  await expect(canvas).toHaveAttribute("height", "480");
  await expect.poll(() => shows(page, [255, 255, 255])).toBe(true);
  // Cross = K (B position), Circle = L (A position), Start = Enter.
  for (const [key, rgb] of [
    ["KeyK", [255, 0, 0]],
    ["KeyL", [0, 255, 0]],
    ["Enter", [255, 255, 0]],
  ] as const) {
    await page.keyboard.down(key);
    await expect.poll(() => shows(page, rgb)).toBe(true);
    await page.keyboard.up(key);
  }
  // Memory card 1 is saved like battery RAM.
  await page.getByRole("button", { name: "Pausar juego" }).click();
  await page.getByText("Copias de partida", { exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar partida" }).click();
  const chunks: Buffer[] = [];
  for await (const chunk of (await (await download).createReadStream())!)
    chunks.push(Buffer.from(chunk));
  const backup = JSON.parse(Buffer.concat(chunks).toString()) as {
    format: string;
    bytes: number[];
  };
  expect(backup.format).toBe("cartivo-ps1-sram-v1");
  expect(backup.bytes).toHaveLength(128 * 1024);
  expect(errors).toEqual([]);
});

test("PlayStation quick-saves with F5 and loads with F9", async ({ page }) => {
  await page.goto("/");
  await playDemo(page, "PlayStation");
  await page.keyboard.press("F5");
  await expect(page.getByTestId("toast")).toContainText("ranura 1");
  await page.keyboard.press("F9");
  await expect(page.getByTestId("toast")).toContainText("Partida cargada");
  await page.getByRole("button", { name: "Partidas" }).click();
  await expect(page.locator('[data-slot="1"]')).toContainText("PCSX-ReARMed");
});

test("files opened together: the program boots with an unrelated file", async ({
  page,
}) => {
  await page.goto("/");
  const exe = await demoExe();
  const chooser = page.waitForEvent("filechooser");
  await card(page).getByRole("button", { name: "Jugar", exact: true }).click();
  await (
    await chooser
  ).setFiles([
    { name: "LEEME.txt", mimeType: "text/plain", buffer: Buffer.from("x") },
    {
      name: "original-demo.exe",
      mimeType: "application/octet-stream",
      buffer: exe,
    },
  ]);
  await playing(page, 30);
  await expect(
    page.getByRole("heading", { name: "original-demo.exe" }),
  ).toBeVisible();
  await expect.poll(() => shows(page, [255, 255, 255])).toBe(true);
});

test("a .cue opened alone asks for its tracks, then the disc boots", async ({
  page,
}) => {
  const { ps1DiscDemo } =
    await import("../../packages/fixtures/src/ps1-disc-demo.ts");
  const { cue, bin } = ps1DiscDemo();
  await page.goto("/");
  let chooser = page.waitForEvent("filechooser");
  await card(page).getByRole("button", { name: "Jugar", exact: true }).click();
  await (
    await chooser
  ).setFiles({
    name: "Cartivo Demo.cue",
    mimeType: "application/octet-stream",
    buffer: Buffer.from(cue),
  });
  const alert = card(page).getByRole("alert");
  await expect(alert).toContainText("Faltan pistas de «Cartivo Demo.cue»");
  await expect(alert).toContainText("Cartivo Demo (Track 1).bin");
  const choose = alert.getByRole("button", { name: "Elegir pistas" });
  await expect(choose).toBeFocused();
  chooser = page.waitForEvent("filechooser");
  await choose.click();
  await (
    await chooser
  ).setFiles({
    name: "Cartivo Demo (Track 1).bin",
    mimeType: "application/octet-stream",
    buffer: Buffer.from(bin),
  });
  await playing(page, 30);
  await expect(
    page.getByRole("heading", { name: "Cartivo Demo.cue" }),
  ).toBeVisible();
  await expect.poll(() => shows(page, [255, 255, 255])).toBe(true);
});

test("Controles names the PlayStation buttons", async ({ page }) => {
  await page.goto("/#controles");
  await expect(
    page.getByText(
      "En PlayStation, Cruz, Círculo, Cuadrado, Triángulo, L1 y R1 están en B, A, Y, X, L y R.",
    ),
  ).toBeVisible();
  await expect(
    page.getByText("L2 y R2 solo los usa PlayStation."),
  ).toBeVisible();
});
