import { test } from "node:test";
import assert from "node:assert/strict";
import { Session, parseMessage } from "../packages/runtime/src/session.ts";
test("lifecycle and idempotent disposal", () => {
  const s = new Session("a");
  for (const [command, state] of [
    ["start", "running"],
    ["pause", "paused"],
    ["resume", "running"],
    ["stop", "stopped"],
  ])
    assert.equal(s.dispatch({ version: 1, sessionId: "a", command }), state);
  s.dispose();
  s.dispose();
  assert.equal(s.state, "stopped");
});
test("reject stale messages without changing state", () => {
  const s = new Session("a");
  assert.throws(() =>
    s.dispatch({ version: 1, sessionId: "b", command: "start" }),
  );
  assert.equal(s.state, "idle");
});
test("reject invalid transitions and malformed payloads", () => {
  const s = new Session("a");
  assert.throws(() =>
    s.dispatch({ version: 1, sessionId: "a", command: "resume" }),
  );
  for (const x of [
    null,
    {},
    { version: 2, sessionId: "a", command: "start" },
    { version: 1, sessionId: "a", command: "eval" },
  ])
    assert.throws(() => parseMessage(x));
});
