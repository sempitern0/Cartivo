import { test } from "@playwright/test";
test("diag webkit", async ({ page, browserName }) => {
  test.skip(browserName !== "webkit");
  const logs: string[] = [];
  page.on("console", (m) => logs.push(`${m.type()}: ${m.text()}`));
  page.on("pageerror", (e) => logs.push(`pageerror: ${e.message}`));
  await page.goto("/");
  await page.getByRole("article", { name: "NES", exact: true }).getByRole("button", { name: "Probar demo" }).click();
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(1000);
    const info = await page.evaluate(() => ({
      phase: document.querySelector("[data-testid=player-phase]")?.textContent,
      frames: document.querySelector("canvas")?.getAttribute("data-frames"),
      alert: document.querySelector("[role=alert]")?.textContent?.trim(),
      toast: document.querySelector("[data-testid=toast]")?.textContent,
      hidden: document.visibilityState,
      focus: document.hasFocus(),
      tag: typeof (WebAssembly as any).Tag,
      opfs: typeof navigator.storage?.getDirectory,
      locks: typeof navigator.locks,
      audio: typeof AudioWorkletNode,
      text: document.body.innerText.slice(0, 600),
    }));
    console.log("DIAG", i, JSON.stringify(info));
  }
  console.log("DIAG logs", JSON.stringify(logs.slice(0, 40)));
});
