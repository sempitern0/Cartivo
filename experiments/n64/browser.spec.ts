import { test, expect } from "@playwright/test";

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
  await expect(page.getByRole("status")).toContainText(
    "Diagnóstico completado",
  );
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
  await expect(page.getByRole("status")).toContainText(
    "Diagnóstico completado",
  );
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
  await expect(page.getByRole("status")).toContainText("No se reconoce");
  await page.locator("#rom").setInputFiles([]);
  await page.locator("#probe").click();
  await expect(page.getByRole("status")).toContainText(
    "Diagnóstico completado",
  );
});

test("cancel terminates an in-flight probe and discards stale results", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => {
    (document.querySelector("#probe") as HTMLButtonElement).click();
    (document.querySelector("#cancel") as HTMLButtonElement).click();
  });
  await expect(page.getByRole("status")).toHaveText("Diagnóstico cancelado.");
  await expect(page.locator("#cancel")).toBeDisabled();
  await page.locator("#probe").click();
  await expect(page.getByRole("status")).toContainText(
    "Diagnóstico completado",
  );
});
