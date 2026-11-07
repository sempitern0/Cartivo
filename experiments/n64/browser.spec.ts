import { test, expect } from "@playwright/test";
import { existsSync } from "node:fs";

test("real worker diagnoses the graphics route and reads only the header", async ({
  page,
}) => {
  await page.goto("/");
  const rom = Buffer.alloc(4096);
  rom.set([0x80, 0x37, 0x12, 0x40]);
  rom.write("CARTIVO TEST", 0x20);
  await page.locator("#rom").setInputFiles({
    name: "fixture.z64",
    mimeType: "application/octet-stream",
    buffer: rom,
  });
  await page.getByRole("button", { name: "Comprobar requisitos" }).click();
  await expect(page.locator("#status")).toContainText("Diagnóstico completado");
  const result = JSON.parse((await page.locator("#result").textContent())!);
  expect(result.rom).toEqual({
    title: "CARTIVO TEST",
    byteOrder: "z64",
    bytes: 4096,
  });
  expect(result.headerReadBytes).toBe(64);
  expect(result.wasm).toBe(true);
  // Context creation can be disabled by the host; failure must be explicit.
  expect(typeof result.webgl2).toBe("boolean");
  expect(result.webglReason.length).toBeGreaterThan(0);
  await test.info().attach("capabilities", {
    body: JSON.stringify(result),
    contentType: "application/json",
  });
  await page.getByRole("button", { name: "Comprobar requisitos" }).click();
  await expect(page.locator("#status")).toContainText("Diagnóstico completado");
});

test("invalid ROM is rejected and a subsequent probe recovers", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#rom").setInputFiles({
    name: "bad.z64",
    mimeType: "application/octet-stream",
    buffer: Buffer.alloc(4096),
  });
  await page.locator("#probe").click();
  await expect(page.locator("#status")).toContainText("No se reconoce");
  await page.locator("#rom").setInputFiles([]);
  await page.locator("#probe").click();
  await expect(page.locator("#status")).toContainText("Diagnóstico completado");
});

test("cancel terminates an in-flight probe and discards stale results", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => {
    (document.querySelector("#probe") as HTMLButtonElement).click();
    (document.querySelector("#cancel") as HTMLButtonElement).click();
  });
  await expect(page.locator("#status")).toHaveText("Diagnóstico cancelado.");
  await expect(page.locator("#cancel")).toBeDisabled();
  await page.locator("#probe").click();
  await expect(page.locator("#status")).toContainText("Diagnóstico completado");
});

// Needs the local core build (node experiments/n64/build-core.mjs); without
// it the test is skipped and does not count as N64 support demonstrated.
test("a real session runs the original demo cartridge and reads the pad", async ({
  page,
}) => {
  test.skip(
    !existsSync(new URL(".build/web/n64-core.mjs", import.meta.url)),
    "núcleo local no compilado",
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Arrancar demo" }).click();
  const status = page.locator("#session-status");
  await expect(status).toContainText("En marcha", { timeout: 30_000 });
  const pixel = async () => {
    const before = await page.locator("#session-stats").textContent();
    await expect(page.locator("#session-stats")).not.toHaveText(before!);
    return JSON.parse((await page.locator("#session-stats").textContent())!)
      .pixel as number[];
  };
  // 15-bit colour widened by the RDP: 0x20 → 0x21, 0x60 → 0x63.
  await expect.poll(pixel).toEqual([33, 33, 99]);
  await page.keyboard.down("KeyK");
  await expect.poll(pixel).toEqual([255, 0, 0]);
  await page.keyboard.up("KeyK");
  await page.keyboard.down("Enter");
  await expect.poll(pixel).toEqual([255, 255, 0]);
  await page.keyboard.up("Enter");
  const stats = JSON.parse(
    (await page.locator("#session-stats").textContent())!,
  );
  expect(stats.presented).toBeGreaterThan(0);
  // The demo's 500 Hz square wave arrives at the core's output rate: two
  // sign changes per period, whatever the resampling.
  const audio = async () =>
    JSON.parse((await page.locator("#session-stats").textContent())!).audio;
  const first = await audio();
  await page.waitForTimeout(2500);
  const later = await audio();
  const seconds = (later.frames - first.frames) / later.rate;
  expect(seconds).toBeGreaterThan(1);
  const tone = (later.crossings - first.crossings) / 2 / seconds;
  expect(Math.abs(tone - 500)).toBeLessThan(10);
  await page.getByRole("button", { name: "Detener" }).click();
  await expect(status).toHaveText("Sesión detenida.");
  await expect(page.locator("#session-screen canvas")).toHaveCount(0);
});

test("a lost WebGL context stops the session and says so", async ({ page }) => {
  test.skip(
    !existsSync(new URL(".build/web/n64-core.mjs", import.meta.url)),
    "núcleo local no compilado",
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Arrancar demo" }).click();
  const status = page.locator("#session-status");
  await expect(status).toContainText("En marcha", { timeout: 30_000 });
  await page
    .getByRole("button", { name: "Simular pérdida de contexto" })
    .click();
  await expect(status).toHaveText(
    "Se ha perdido el contexto WebGL: la sesión se ha detenido.",
  );
  await expect(page.locator("#session-screen canvas")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Arrancar demo" }),
  ).toBeEnabled();
});

test("pause holds the emulation, resume continues, the log names the GPU", async ({
  page,
}) => {
  test.skip(
    !existsSync(new URL(".build/web/n64-core.mjs", import.meta.url)),
    "núcleo local no compilado",
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Arrancar demo" }).click();
  const status = page.locator("#session-status");
  await expect(status).toContainText("En marcha", { timeout: 30_000 });
  const stats = async () =>
    JSON.parse((await page.locator("#session-stats").textContent())!);
  const next = async () => {
    const before = await page.locator("#session-stats").textContent();
    await expect(page.locator("#session-stats")).not.toHaveText(before!);
    return stats();
  };
  await page.getByRole("button", { name: "Pausar" }).click();
  await expect(status).toHaveText("En pausa.");
  const held = (await next()).frames;
  expect((await next()).frames).toBe(held);
  await page.getByRole("button", { name: "Reanudar" }).click();
  await expect(status).toContainText("En marcha");
  await expect.poll(async () => (await stats()).frames).toBeGreaterThan(held);
  const { startup, speed } = await next();
  expect(startup.firstFrame).toBeGreaterThan(0);
  expect(speed).toBeGreaterThan(0.9);
  await expect(page.getByLabel("Registro de la sesión")).toContainText(
    "[gpu] WebGL 2.0",
  );
});
