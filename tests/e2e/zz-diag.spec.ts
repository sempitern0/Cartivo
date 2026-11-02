import { test } from "@playwright/test";
const snap = (page: import("@playwright/test").Page) =>
  page.evaluate(() => ({
    phase: document.querySelector("[data-testid=player-phase]")?.textContent,
    frames: document.querySelector("canvas")?.getAttribute("data-frames"),
    alert: [...document.querySelectorAll("[role=alert]")].map((e) => e.textContent?.trim()).join(" | "),
    toast: document.querySelector("[data-testid=toast]")?.textContent,
    sw: !!navigator.serviceWorker?.controller,
  }));
test("diag webkit", async ({ page, browserName }) => {
  test.skip(browserName !== "webkit");
  const logs: string[] = [];
  page.on("console", (m) => logs.push(`${m.type()}: ${m.text()}`));
  page.on("pageerror", (e) => logs.push(`pageerror: ${e.message}`));
  await page.goto("/");
  await page.getByRole("article", { name: "Game Boy", exact: true }).getByRole("button", { name: "Probar demo" }).click();
  for (let i = 0; i < 4; i++) { await page.waitForTimeout(1000); console.log("DIAG gb", i, JSON.stringify(await snap(page))); }
  await page.goto("/");
  const { controlDemo } = await import("../../packages/fixtures/src/control-demo.ts");
  await page.locator("input[type=file]").setInputFiles({ name: "x.nes", mimeType: "application/octet-stream", buffer: Buffer.from(controlDemo()) });
  await page.waitForTimeout(2500);
  console.log("DIAG nes", JSON.stringify(await snap(page)));
  const yes = page.getByRole("button", { name: "Sí, recordar" });
  if (await yes.count()) await yes.click();
  await page.waitForTimeout(2500);
  console.log("DIAG nes after remember", JSON.stringify(await snap(page)));
  console.log("DIAG logs", JSON.stringify(logs.filter((l) => !l.includes("[vite]")).slice(0, 30)));
});
