import { test, expect, type Page } from "./fixtures.ts";

// Save-data integrity under repetition and damage (handoff stage A).
// Drives the real emulator Worker through protocol v1, so it runs against
// the Vite dev server where the Worker source has a stable URL.

type Result = Record<string, unknown> & {
  states?: { slot: string; core: string; coreVersion: string }[];
  save?: Uint8Array;
};

async function harness(page: Page) {
  await page.goto("/");
  await page.evaluate(() => {
    const neutral = {
      up: false,
      down: false,
      left: false,
      right: false,
      a: false,
      b: false,
      select: false,
      start: false,
    };
    (window as any).cartivoSession = (core: string) => {
      const worker = new Worker("/src/emulator.worker.ts", { type: "module" });
      const session = crypto.randomUUID();
      let id = 0;
      const req = (command: string, extra: object = {}) =>
        new Promise<any>((resolve, reject) => {
          const mine = ++id;
          const on = (e: MessageEvent) => {
            if (e.data?.id !== mine || e.data?.session !== session) return;
            worker.removeEventListener("message", on);
            if (e.data.ok) resolve(e.data.result);
            else reject(Error(e.data.error));
          };
          worker.addEventListener("message", on);
          worker.postMessage({ v: 1, session, id: mine, command, ...extra });
        });
      return {
        worker,
        req,
        load: () => req("load", { demo: true, system: "nes", core }),
        frames: (n: number, input: object = {}) =>
          req("advance", {
            count: Math.min(3, n),
            input: { ...neutral, ...input },
          }),
      };
    };
  });
}

test.beforeEach(({ baseURL }) => {
  test.skip(
    !baseURL?.includes(":5173"),
    "Uses the Worker source URL served by Vite dev.",
  );
});

test("100 open → play → save → close cycles keep SRAM and snapshots intact", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await harness(page);
  const report = await page.evaluate(async () => {
    const make = (window as any).cartivoSession;
    let counter = 0;
    let previousCore = "";
    const errors: string[] = [];
    for (let cycle = 0; cycle < 100; cycle++) {
      // Two cycles per core, alternating: exercises cross-core SRAM and
      // the refusal to load another core's snapshot.
      const core = cycle % 4 < 2 ? "tetanes" : "jsnes";
      const s = make(core);
      const loaded = await s.load();
      if (loaded.core !== core)
        errors.push(`cycle ${cycle}: core ${loaded.core}`);
      const slot = loaded.states.find((x: any) => x.slot === "1");
      if (cycle > 0 && !slot) errors.push(`cycle ${cycle}: slot 1 missing`);
      if (slot) {
        try {
          await s.req("state-load", { slot: "1" });
          if (previousCore !== core)
            errors.push(
              `cycle ${cycle}: loaded a ${previousCore} state in ${core}`,
            );
        } catch (e) {
          if (previousCore === core)
            errors.push(`cycle ${cycle}: ${(e as Error).message}`);
          else if (!/núcleo/.test((e as Error).message))
            errors.push(
              `cycle ${cycle}: unclear error ${(e as Error).message}`,
            );
        }
      }
      const before = (await s.req("save")).save[0];
      if (before !== counter % 256)
        errors.push(
          `cycle ${cycle}: SRAM ${before}, expected ${counter % 256}`,
        );
      for (let i = 0; i < 4; i++) await s.frames(3);
      await s.frames(3, { a: true });
      await s.frames(3);
      counter++;
      const after = (await s.req("save")).save[0];
      if (after !== counter % 256)
        errors.push(`cycle ${cycle}: A did not write SRAM (${after})`);
      await s.req("state-save", { slot: "1" });
      const paused = await s.req("pause");
      if (!paused.saved) errors.push(`cycle ${cycle}: SRAM not confirmed`);
      s.worker.terminate();
      previousCore = core;
    }
    return { errors, counter };
  });
  expect(report.errors).toEqual([]);
  expect(report.counter).toBe(100);
  await expect.poll(() => page.workers().length).toBe(0);
});

/** Edits the stored slot 1 record directly in IndexedDB. */
async function damage(page: Page, mode: "corrupt" | "version") {
  await page.evaluate(async (mode) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open("cartivo-states", 1);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    const tx = db.transaction("states", "readwrite");
    const store = tx.objectStore("states");
    const keys = await new Promise<IDBValidKey[]>((resolve) => {
      const r = store.getAllKeys();
      r.onsuccess = () => resolve(r.result);
    });
    const key = keys.find((k) => String(k).endsWith(":1"))!;
    const record = await new Promise<any>((resolve) => {
      const r = store.get(key);
      r.onsuccess = () => resolve(r.result);
    });
    if (mode === "corrupt") record.bytes[0] ^= 0xff;
    else record.coreVersion = "0.0.1";
    store.put(record, key);
    await new Promise((resolve) => (tx.oncomplete = resolve));
    db.close();
  }, mode);
}

test("damaged or foreign-version snapshots fail explicitly and are kept", async ({
  page,
}) => {
  await harness(page);
  const save = async () =>
    page.evaluate(async () => {
      const s = (window as any).cartivoSession("tetanes");
      await s.load();
      await s.frames(3);
      await s.req("state-save", { slot: "1" });
      s.worker.terminate();
    });
  const attempt = () =>
    page.evaluate(async () => {
      const s = (window as any).cartivoSession("tetanes");
      const loaded = await s.load();
      let message = "";
      try {
        await s.req("state-load", { slot: "1" });
      } catch (e) {
        message = (e as Error).message;
      }
      const kept = loaded.states.some((x: any) => x.slot === "1");
      s.worker.terminate();
      return { message, kept };
    });

  await save();
  await damage(page, "corrupt");
  let result = await attempt();
  expect(result.message).toMatch(/dañada/);
  expect(result.kept).toBe(true);

  await save();
  await damage(page, "version");
  result = await attempt();
  expect(result.message).toMatch(/otra versión/);
  expect(result.kept).toBe(true);
});
