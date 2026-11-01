import { test } from "node:test";
import assert from "node:assert/strict";
import { EmulatorClient as NesClient } from "../packages/runtime/src/client.ts";
class Fake extends EventTarget {
  messages: any[] = [];
  terminated = false;
  postMessage(m: unknown) {
    this.messages.push(m);
  }
  terminate() {
    this.terminated = true;
  }
  reply(extra: object = {}) {
    const m = this.messages.at(-1);
    this.dispatchEvent(
      new MessageEvent("message", {
        data: {
          v: 1,
          session: m.session,
          id: m.id,
          ok: true,
          result: { saved: true },
          ...extra,
        },
      }),
    );
  }
}
const turn = () => new Promise<void>((resolve) => setImmediate(resolve));
test("NES client orders pause after frame and ignores stale replies", async () => {
  const worker = new Fake();
  const client = new NesClient(worker as unknown as Worker);
  const first = client.request("advance");
  const second = client.request("pause");
  await turn();
  assert.equal(worker.messages.length, 1);
  worker.reply({ session: "old" });
  assert.equal(worker.messages.length, 1);
  worker.reply();
  await first;
  await turn();
  assert.equal(worker.messages[1].command, "pause");
  worker.reply();
  await second;
  client.dispose();
  assert.equal(worker.terminated, true);
});
test("NES timeout terminates worker and rejects queued requests", async () => {
  const worker = new Fake();
  const client = new NesClient(worker as unknown as Worker, 5);
  const first = client.request("load", { demo: true });
  const second = client.request("pause");
  await Promise.all([
    assert.rejects(first, /no responde/),
    assert.rejects(second, /cerrada/),
  ]);
  assert.equal(worker.terminated, true);
});
test("NES client rejects malformed frames and disposes pending requests", async () => {
  const worker = new Fake();
  const client = new NesClient(worker as unknown as Worker);
  const first = client.request("advance");
  await turn();
  worker.reply({ result: { pixels: new Uint8Array(2) } });
  await assert.rejects(first, /inválidos/);
  assert.equal(worker.terminated, true);
  const w = new Fake();
  const c = new NesClient(w as unknown as Worker);
  const pending = c.request("pause");
  await turn();
  c.dispose();
  await assert.rejects(pending, /cerrada/);
});
