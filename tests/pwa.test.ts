import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildServiceWorker,
  precacheVersion,
  shouldPrecache,
  CACHE_PREFIX,
} from "../tools/pwa-plugin.mjs";

const entries = [
  { path: "index.html", hash: "a" },
  { path: "assets/index-1.js", hash: "b" },
  { path: "manifest.webmanifest", hash: "c" },
];

test("precache version is stable and changes with any file content", () => {
  assert.equal(
    precacheVersion(entries),
    precacheVersion([...entries].reverse()),
  );
  const changed = entries.map((e) =>
    e.path === "assets/index-1.js" ? { ...e, hash: "z" } : e,
  );
  assert.notEqual(precacheVersion(entries), precacheVersion(changed));
});

test("service worker never precaches itself or source maps", () => {
  assert.equal(shouldPrecache("sw.js"), false);
  assert.equal(shouldPrecache("assets/index-1.js.map"), false);
  assert.equal(shouldPrecache("assets/nes.worker-1.js"), true);
  assert.equal(shouldPrecache("licenses/NOTICE.txt"), true);
});

test("service worker waits for an explicit update and keeps saves", () => {
  const source = buildServiceWorker(entries);
  assert.match(source, /"index\.html"/);
  assert.match(source, new RegExp(precacheVersion(entries)));
  // skipWaiting only in response to the app's explicit message.
  const install = source.slice(
    source.indexOf('addEventListener("install"'),
    source.indexOf('addEventListener("activate"'),
  );
  assert.doesNotMatch(install, /skipWaiting\(\)/);
  assert.match(source, /cartivo:activate-update[\s\S]*skipWaiting\(\)/);
  // Cleanup is limited to our own shell caches; no IndexedDB access.
  assert.match(
    source,
    new RegExp(`startsWith\\(${JSON.stringify(CACHE_PREFIX)}\\)`),
  );
  assert.doesNotMatch(source, /indexedDB/);
});
