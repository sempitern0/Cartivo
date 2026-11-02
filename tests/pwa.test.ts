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
  assert.equal(shouldPrecache("assets/emulator.worker-1.js"), true);
  assert.equal(shouldPrecache("licenses/NOTICE.txt"), true);
  // Every core is installed with the app; the player only picks a game.
  assert.equal(shouldPrecache("assets/mgba-1a2b.wasm"), true);
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

test("cache lookups ignore Vary so crossorigin module requests hit offline", () => {
  const source = buildServiceWorker(entries);
  assert.equal((source.match(/ignoreVary: true/g) ?? []).length, 2);
});

/** Runs a generated service worker against in-memory caches and network. */
async function installWith(
  source: string,
  stores: Map<string, Map<string, Response>>,
) {
  const fetched: string[] = [];
  const handlers: Record<string, (event: unknown) => void> = {};
  const open = async (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const store = stores.get(name)!;
    return {
      match: async (key: string) => store.get(key)?.clone(),
      put: async (key: string, response: Response) => {
        store.set(key, response);
      },
    };
  };
  const scope = {
    registration: { scope: "https://cartivo.test/" },
    location: { origin: "https://cartivo.test" },
    addEventListener: (type: string, fn: (event: unknown) => void) => {
      handlers[type] = fn;
    },
    caches: { keys: async () => [...stores.keys()], open },
    fetch: async (target: string) => {
      fetched.push(target.replace("https://cartivo.test/", ""));
      return new Response(`body of ${target}`);
    },
    Response,
    URL,
  };
  new Function(...Object.keys(scope), "self", source)(
    ...Object.values(scope),
    scope,
  );
  let done: Promise<unknown> = Promise.resolve();
  handlers.install({ waitUntil: (p: Promise<unknown>) => (done = p) });
  await done;
  return fetched;
}

test("an update downloads only the files whose content changed", async () => {
  const stores = new Map<string, Map<string, Response>>();
  const first = [
    { path: "index.html", hash: "a" },
    { path: "assets/core-1.wasm", hash: "w" },
    { path: "assets/index-1.js", hash: "b" },
  ];
  // First install: everything comes from the network, cores included.
  assert.deepEqual(
    (await installWith(buildServiceWorker(first), stores)).sort(),
    ["assets/core-1.wasm", "assets/index-1.js", "index.html"],
  );
  const next = first.map((e) =>
    e.path === "index.html" ? { ...e, hash: "a2" } : e,
  );
  // The core and the unchanged script are copied from the previous cache.
  assert.deepEqual(await installWith(buildServiceWorker(next), stores), [
    "index.html",
  ]);
  const newest = stores.get(CACHE_PREFIX + precacheVersion(next))!;
  assert.equal(
    await newest.get("https://cartivo.test/assets/core-1.wasm")!.text(),
    "body of https://cartivo.test/assets/core-1.wasm",
  );
});
