import { test } from "@playwright/test";
test("diag webkit", async ({ page, browserName }) => {
  test.skip(browserName !== "webkit");
  await page.goto("/");
  const info = await page.evaluate(async () => {
    // rAF rate
    let n = 0;
    const t0 = performance.now();
    await new Promise<void>((r) => {
      const f = () => (++n, performance.now() - t0 < 1000 ? requestAnimationFrame(f) : r());
      requestAnimationFrame(f);
    });
    // worker round trip
    const w = new Worker(URL.createObjectURL(new Blob(["onmessage=e=>postMessage(e.data)"], { type: "text/javascript" })));
    const t1 = performance.now();
    for (let i = 0; i < 50; i++) await new Promise((r) => { w.onmessage = r; w.postMessage(i); });
    const rt = (performance.now() - t1) / 50;
    // wasm compute: tight loop module
    const bytes = new Uint8Array([0,97,115,109,1,0,0,0,1,6,1,96,1,127,1,127,3,2,1,0,7,5,1,1,102,0,0,10,30,1,28,1,1,127,3,64,32,1,65,1,106,34,1,32,0,72,13,0,11,32,1,11]);
    let wasmMs = -1;
    try {
      const { instance } = await WebAssembly.instantiate(bytes);
      const t2 = performance.now();
      (instance.exports.f as (n: number) => number)(50_000_000);
      wasmMs = performance.now() - t2;
    } catch (e) { wasmMs = -2; }
    const t3 = performance.now();
    let x = 0; for (let i = 0; i < 50_000_000; i++) x += i & 1;
    const jsMs = performance.now() - t3;
    return { rafPerSec: n, workerRoundTripMs: rt, wasmLoop50M: wasmMs, jsLoop50M: jsMs, x, ua: navigator.userAgent };
  });
  console.log("DIAG", JSON.stringify(info));
});
