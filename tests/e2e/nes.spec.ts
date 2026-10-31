import { test, expect } from "@playwright/test";
async function start(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Probar demo" }).click();
  await expect(page.getByTestId("player-phase")).toHaveText("Jugando");
  await expect
    .poll(async () =>
      Number(await page.locator("canvas").getAttribute("data-frames")),
    )
    .toBeGreaterThan(10);
}
test("real NES in Worker, pause on controls, SRAM backup and reload", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await start(page);
  const frameBefore = Number(
    await page.locator("canvas").getAttribute("data-frames"),
  );
  await expect
    .poll(async () =>
      Number(await page.locator("canvas").getAttribute("data-frames")),
    )
    .toBeGreaterThan(frameBefore + 3);
  await page.keyboard.down("KeyK");
  await page.waitForTimeout(150);
  await page.keyboard.up("KeyK");
  await page.getByRole("button", { name: "Pausar juego" }).click();
  await expect(page.getByTestId("save-status")).toContainText(
    "Partida guardada",
  );
  await page.getByText("Copias de partida", { exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar partida" }).click();
  const artifact = await download;
  const stream = await artifact.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const backup = JSON.parse(Buffer.concat(chunks).toString());
  expect(backup.bytes[0]).toBe(1);
  await page.getByRole("link", { name: "Configurar controles" }).click();
  await expect(
    page.getByRole("heading", { name: "Controles", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Volver al juego", exact: false })
    .click();
  await expect(page.getByTestId("player-phase")).toHaveText("En pausa");
  await page.getByRole("button", { name: "Cerrar juego" }).click();
  await start(page);
  await page.getByRole("button", { name: "Pausar juego" }).click();
  await expect(page.getByTestId("save-status")).toContainText(
    "Partida guardada",
  );
  await page.getByText("Copias de partida", { exact: true }).click();
  const download2 = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar partida" }).click();
  const s2 = await (await download2).createReadStream();
  const c2: Buffer[] = [];
  for await (const c of s2!) c2.push(Buffer.from(c));
  expect(JSON.parse(Buffer.concat(c2).toString()).bytes[0]).toBe(1);
  await page.screenshot({ path: "test-results/nes-demo.png", fullPage: true });
  expect(errors).toEqual([]);
});
test("unsupported local ROM produces a recoverable error", async ({ page }) => {
  await page.goto("/");
  await page.locator("input[type=file]").setInputFiles({
    name: "invalid.nes",
    mimeType: "application/octet-stream",
    buffer: Buffer.from("not a ROM"),
  });
  await expect(page.getByRole("alert")).toContainText("inválido");
  const errorBox = await page.getByRole("alert").boundingBox();
  const canvasBox = await page.locator("canvas").boundingBox();
  expect(errorBox!.y).toBeLessThan(canvasBox!.y);
  await page.getByRole("button", { name: "Cerrar juego" }).click();
  await expect(
    page.getByRole("button", { name: "Añadir juego" }),
  ).toBeVisible();
});

test("single writer prevents simultaneous sessions for the same game", async ({
  page,
  context,
}) => {
  await start(page);
  await page.getByRole("button", { name: "Pausar juego" }).click();
  const second = await context.newPage();
  await second.goto("/");
  await second.getByRole("button", { name: "Probar demo" }).click();
  await expect(second.getByRole("alert")).toContainText("otra pestaña");
  await second.close();
  await page.bringToFront();
  await page.getByRole("button", { name: "Cerrar juego" }).click();
  await start(page);
  await expect(page.getByTestId("player-phase")).toHaveText("Jugando");
});
test("SRAM import validates identity and survives reopening", async ({
  page,
}) => {
  await start(page);
  await page.getByRole("button", { name: "Pausar juego" }).click();
  await expect(page.getByTestId("save-status")).toContainText(
    "Partida guardada",
  );
  await page.getByText("Copias de partida", { exact: true }).click();
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar partida" }).click();
  const stream = await (await downloading).createReadStream();
  const chunks: Buffer[] = [];
  for await (const c of stream!) chunks.push(Buffer.from(c));
  const backup = JSON.parse(Buffer.concat(chunks).toString());
  await page.locator("input[type=file]").setInputFiles({
    name: "wrong.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ ...backup, game: "wrong" })),
  });
  await expect(page.getByRole("alert")).toContainText("no pertenece");
  const { createHash } = await import("node:crypto");
  backup.bytes[0] = 5;
  backup.sha256 = createHash("sha256")
    .update(Uint8Array.from(backup.bytes))
    .digest("hex");
  await page.locator("input[type=file]").setInputFiles({
    name: "valid.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await expect(page.getByTestId("save-status")).toContainText(
    "Copia importada",
  );
  await page.getByRole("button", { name: "Cerrar juego" }).click();
  await start(page);
  await page.getByRole("button", { name: "Pausar juego" }).click();
  await expect(page.getByTestId("save-status")).toContainText(
    "Partida guardada",
  );
  await page.getByText("Copias de partida", { exact: true }).click();
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar partida" }).click();
  const s = await (await dl).createReadStream();
  const b: Buffer[] = [];
  for await (const c of s!) b.push(Buffer.from(c));
  expect(JSON.parse(Buffer.concat(b).toString()).bytes[0]).toBe(5);
});
test("corrupt current SRAM recovers previous verified generation", async ({
  page,
}) => {
  await start(page);
  await page.getByRole("button", { name: "Pausar juego" }).click();
  await expect(page.getByTestId("save-status")).toContainText(
    "Partida guardada",
  );
  await page.getByRole("button", { name: "Reanudar juego" }).click();
  await expect(page.getByTestId("player-phase")).toHaveText("Jugando");
  const frameBefore = Number(
    await page.locator("canvas").getAttribute("data-frames"),
  );
  await expect
    .poll(async () =>
      Number(await page.locator("canvas").getAttribute("data-frames")),
    )
    .toBeGreaterThan(frameBefore + 3);
  await page.keyboard.down("KeyK");
  await page.waitForTimeout(150);
  await page.keyboard.up("KeyK");
  await page.getByRole("button", { name: "Pausar juego" }).click();
  await expect(page.getByTestId("save-status")).toContainText(
    "Partida guardada",
  );
  await page.getByRole("button", { name: "Cerrar juego" }).click();
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open("cartivo-saves", 1);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction("sram", "readwrite");
          const store = tx.objectStore("sram");
          const cursor = store.openCursor();
          cursor.onsuccess = () => {
            const item = cursor.result;
            if (item) {
              const record = item.value;
              record.current.sha256 = "corrupt";
              item.update(record);
            }
          };
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      }),
  );
  await start(page);
  await expect(page.getByTestId("save-status")).toContainText("recuperada");
  await page.getByRole("button", { name: "Pausar juego" }).click();
  await page.getByText("Copias de partida", { exact: true }).click();
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar partida" }).click();
  const s = await (await dl).createReadStream();
  const chunks: Buffer[] = [];
  for await (const c of s!) chunks.push(Buffer.from(c));
  expect(JSON.parse(Buffer.concat(chunks).toString()).bytes[0]).toBe(0);
});
test("synthetic gamepad changes real emulated SRAM and disconnect pauses", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const p = {
      index: 0,
      id: "Synthetic standard pad",
      mapping: "standard",
      connected: true,
      buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })),
      axes: [0, 0],
    };
    Object.assign(window, { nesPad: p });
    Object.defineProperty(navigator, "getGamepads", {
      value: () => (p.connected ? [p] : []),
    });
  });
  await start(page);
  await expect(
    page.getByRole("button", { name: "Silenciar", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    (window as any).nesPad.buttons[0].pressed = true;
  });
  await page.waitForTimeout(150);
  await page.evaluate(() => {
    (window as any).nesPad.connected = false;
  });
  await expect(page.getByTestId("player-phase")).toHaveText("En pausa");
  await expect(page.getByTestId("save-status")).toContainText(
    "Partida guardada",
  );
  await page.getByText("Copias de partida", { exact: true }).click();
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar partida" }).click();
  const stream = await (await dl).createReadStream();
  const bytes: Buffer[] = [];
  for await (const c of stream!) bytes.push(Buffer.from(c));
  expect(JSON.parse(Buffer.concat(bytes).toString()).bytes[0]).toBe(1);
});

test("keyboard remap from Controls is consumed by the real game", async ({
  page,
}) => {
  await page.goto("/#controles");
  await page
    .getByRole("button", { name: "Asignar tecla A", exact: true })
    .click();
  await page.keyboard.press("KeyC");
  await start(page);
  const before = Number(
    await page.locator("canvas").getAttribute("data-frames"),
  );
  await expect
    .poll(async () =>
      Number(await page.locator("canvas").getAttribute("data-frames")),
    )
    .toBeGreaterThan(before + 3);
  await page.keyboard.down("KeyC");
  await page.waitForTimeout(150);
  await page.keyboard.up("KeyC");
  await page.getByRole("button", { name: "Pausar juego" }).click();
  await expect(page.getByTestId("save-status")).toContainText(
    "Partida guardada",
  );
  await page.getByText("Copias de partida", { exact: true }).click();
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar partida" }).click();
  const stream = await (await dl).createReadStream();
  const chunks: Buffer[] = [];
  for await (const c of stream!) chunks.push(Buffer.from(c));
  expect(JSON.parse(Buffer.concat(chunks).toString()).bytes[0]).toBe(1);
});

test("cancel loading destroys the session without late navigation", async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/*nes.worker*", async (route) => {
    await gate;
    await route.continue().catch(() => {});
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Probar demo" }).click();
  await page.getByRole("button", { name: "Cancelar carga" }).click();
  await expect(
    page.getByRole("button", { name: "Añadir juego" }),
  ).toBeVisible();
  release();
  await expect(page.getByTestId("player-phase")).toHaveCount(0);
});

test("local MMC1 cartridge larger than old NROM cap loads in real worker", async ({
  page,
}) => {
  const { controlDemo } = await import(
    "../../packages/fixtures/src/control-demo.ts"
  );
  const demo = controlDemo();
  const rom = new Uint8Array(16 + 65536 + 8192);
  rom.set(demo.subarray(0, 16));
  rom[4] = 4;
  rom[6] = 0x12;
  for (let bank = 0; bank < 4; bank++)
    rom.set(demo.subarray(16, 16 + 16384), 16 + bank * 16384);
  rom.set(demo.subarray(16 + 16384), 16 + 65536);
  await page.goto("/");
  await page.locator("input[type=file]").setInputFiles({
    name: "original-mmc1-test.nes",
    mimeType: "application/octet-stream",
    buffer: Buffer.from(rom),
  });
  await expect(page.getByTestId("player-phase")).toHaveText("Jugando");
  await expect
    .poll(async () =>
      Number(await page.locator("canvas").getAttribute("data-frames")),
    )
    .toBeGreaterThan(10);
});

test("running game captures navigation keys and scroll until Escape", async ({
  page,
}) => {
  await start(page);
  await expect(page.locator("canvas")).toBeFocused();
  const initial = await page.evaluate(() => scrollY);
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowDown");
  await page.mouse.wheel(0, 500);
  await expect(page.locator("canvas")).toBeFocused();
  expect(await page.evaluate(() => scrollY)).toBe(initial);
  await expect(page.getByTestId("player-phase")).toHaveText("Jugando");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("player-phase")).toHaveText("En pausa");
  await expect(
    page.getByRole("button", { name: "Reanudar juego" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator("canvas")).not.toBeFocused();
});
test("fullscreen includes toolbar and returns safely to paused window", async ({
  page,
}) => {
  await start(page);
  await page
    .getByRole("button", { name: "Pantalla completa", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => !!document.fullscreenElement))
    .toBe(true);
  await expect(page.locator(".player")).toHaveClass(/focus-mode/);
  await expect(page.locator(".player .heading")).toBeHidden();
  const box = await page.locator("canvas").boundingBox();
  expect(box!.width / box!.height).toBeCloseTo(4 / 3, 1);
  expect(box!.y + box!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  await page.screenshot({
    path: "test-results/nes-fullscreen.png",
    fullPage: true,
  });
  await page.evaluate(() => document.exitFullscreen());
  await expect(page.getByTestId("player-phase")).toHaveText("En pausa");
  await expect
    .poll(() => page.evaluate(() => !!document.fullscreenElement))
    .toBe(false);
});

test("Focus preserves the emulated session and hides external chrome", async ({ page }) => {
  await start(page);
  const canvas = page.locator("canvas");
  const before = Number(await canvas.getAttribute("data-frames"));
  await page.keyboard.press("KeyF");
  await expect(page.locator(".player")).toHaveClass(/focus-mode/);
  await expect(page.locator("header")).toBeHidden();
  await expect(page.locator("header")).toBeHidden();
  await expect.poll(async () => Number(await canvas.getAttribute("data-frames"))).toBeGreaterThan(before + 3);
  await page.keyboard.press("KeyF");
  await expect(page.locator(".player")).not.toHaveClass(/focus-mode/);
  await expect(page.getByRole("button", { name: "Pausar juego" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("player-phase")).toHaveText("En pausa");
});

test("video aspect and integer scaling switch without resetting the canvas", async ({ page }) => {
  await start(page);
  await page.getByRole("button", { name: "Pausar juego" }).click();
  const canvas = page.locator("canvas");
  await page.getByRole("button", { name: "Gráficos" }).click();
  await page.getByLabel("Escalado").selectOption("integer");
  await page.getByLabel("Aspecto").selectOption("native");
  await expect(canvas).toHaveAttribute("data-actual-scale", "integer");
  const size = await canvas.boundingBox();
  expect(Math.abs(size!.width / size!.height - 256 / 240)).toBeLessThan(0.02);
  await page.getByLabel("Escalado").selectOption("fit");
  await page.getByLabel("Aspecto").selectOption("corrected");
  await expect(canvas).toHaveAttribute("data-actual-scale", "fit");
  const fitted = await canvas.boundingBox();
  expect(Math.abs(fitted!.width / fitted!.height - 4 / 3)).toBeLessThan(0.02);
});
