import { test } from "node:test";
import assert from "node:assert/strict";
import {
  WorkerSession,
  type Transport,
} from "../packages/runtime/src/worker-client.ts";
class Fake implements Transport {
  listeners = new Map<string, Set<(e: any) => void>>();
  sent: any;
  ended = false;
  postMessage(v: unknown) {
    this.sent = v;
  }
  addEventListener(t: string, f: (e: any) => void) {
    if (!this.listeners.has(t)) this.listeners.set(t, new Set());
    this.listeners.get(t)!.add(f);
  }
  removeEventListener(t: string, f: (e: any) => void) {
    this.listeners.get(t)?.delete(f);
  }
  terminate() {
    this.ended = true;
  }
  reply(extra: object = {}) {
    for (const f of this.listeners.get("message") ?? [])
      f({ data: { ...this.sent, ok: true, state: "running", ...extra } });
  }
}
test("correlates replies and ignores old sessions", async () => {
  const t = new Fake(),
    s = new WorkerSession(t, "a");
  const p = s.request("start");
  t.reply({ sessionId: "old" });
  t.reply({ requestId: 99 });
  t.reply();
  assert.equal(await p, "running");
  s.dispose();
  assert.equal(t.listeners.get("message")!.size, 0);
});
test("timeout terminates worker and rejects future work", async () => {
  const t = new Fake(),
    s = new WorkerSession(t, "a");
  await assert.rejects(s.request("start", { timeoutMs: 5 }), /no responde/);
  assert.equal(t.ended, true);
  await assert.rejects(s.request("start"), /cerrada/);
});
test("cancellation closes session and clears listeners", async () => {
  const t = new Fake(),
    s = new WorkerSession(t, "a"),
    a = new AbortController();
  const p = s.request("start", { signal: a.signal });
  a.abort();
  await assert.rejects(p, /cancelada/);
  assert.equal(t.ended, true);
  s.dispose();
});
test("reject concurrent requests and malformed correlated replies", async () => {
  const t = new Fake(),
    s = new WorkerSession(t, "a");
  const p = s.request("start");
  await assert.rejects(s.request("pause"), /Espera/);
  t.reply({ version: 2 });
  await assert.rejects(p, /inválida/);
  assert.equal(t.ended, true);
});
test("dispose rejects pending request", async () => {
  const t = new Fake(),
    s = new WorkerSession(t, "a");
  const p = s.request("start");
  s.dispose();
  await assert.rejects(p, /cerrada/);
});
