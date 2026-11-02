import { test } from "@playwright/test";
test("diag webkit", async ({ page, browserName }) => {
  test.skip(browserName !== "webkit");
  await page.goto("/");
  const n = await page.evaluate(async () => {
    let n = 0;
    const t0 = performance.now();
    await new Promise<void>((r) => {
      const f = () => (++n, performance.now() - t0 < 1000 ? requestAnimationFrame(f) : r());
      requestAnimationFrame(f);
    });
    return n;
  });
  console.log("DIAG rafPerSec", n);
});
