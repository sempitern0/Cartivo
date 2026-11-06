// Synthetic bytes only. Measures the removed hash/copy work, not game startup.
import { performance } from "node:perf_hooks";
import { digest } from "../packages/storage/src/sram.ts";

const median = (values) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
async function before(bytes) {
  for (let i = 0; i < 2; i++)
    await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes));
}
for (const mib of [1, 8, 32]) {
  const bytes = new Uint8Array(mib * 1024 * 1024);
  await before(bytes);
  await digest(bytes);
  const old = [],
    current = [];
  for (let i = 0; i < 9; i++) {
    // Alternate order to reduce systematic warm-up bias.
    const cases =
      i % 2
        ? [
            [digest, current],
            [before, old],
          ]
        : [
            [before, old],
            [digest, current],
          ];
    for (const [run, samples] of cases) {
      const start = performance.now();
      await run(bytes);
      samples.push(performance.now() - start);
    }
  }
  console.log(
    JSON.stringify({
      mib,
      samples: 9,
      oldMedianMs: +median(old).toFixed(2),
      newMedianMs: +median(current).toFixed(2),
    }),
  );
}
