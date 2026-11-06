import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildServiceWorker,
  precacheVersion,
  shouldPrecache,
  CACHE_PREFIX,
  MANIFEST_PATH,
} from "../tools/pwa-plugin.mjs";
import {
  offlineCacheComplete,
  PRECACHE_MANIFEST,
  SHELL_CACHE_PREFIX,
} from "../apps/web/src/offline-cache.ts";

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
  assert.equal((source.match(/ignoreVary: true/g) ?? []).length, 3);
});

/** Runs a generated service worker against in-memory caches and network. */
async function installWith(
  source: string,
  stores: Map<string, Map<string, Response>>,
  network = async (target: string) => new Response(`body of ${target}`),
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
      return network(target);
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

test("installs a few files at a time and only completes with all of them", async () => {
  const many = Array.from({ length: 20 }, (_, i) => ({
    path: `assets/file-${i}.js`,
    hash: String(i),
  }));
  let inFlight = 0;
  let peak = 0;
  const slow = async (target: string) => {
    peak = Math.max(peak, ++inFlight);
    await new Promise((resolve) => setTimeout(resolve, 2));
    inFlight--;
    return new Response(`body of ${target}`);
  };
  const stores = new Map<string, Map<string, Response>>();
  assert.equal(
    (await installWith(buildServiceWorker(many), stores, slow)).length,
    20,
  );
  assert.ok(peak <= 6, `at most 6 downloads at once (${peak})`);

  // One missing file: the install fails and the cache has no manifest, so
  // the browser keeps the previous version.
  const broken = new Map<string, Map<string, Response>>();
  const missing = async (target: string) =>
    target.endsWith("file-7.js")
      ? new Response("", { status: 404 })
      : new Response("ok");
  await assert.rejects(installWith(buildServiceWorker(many), broken, missing));
  const cache = broken.get(CACHE_PREFIX + precacheVersion(many))!;
  assert.equal(cache.has(`https://cartivo.test/${MANIFEST_PATH}`), false);
});

test("offline is reported only for a complete cache", async () => {
  assert.equal(SHELL_CACHE_PREFIX, CACHE_PREFIX);
  assert.equal(PRECACHE_MANIFEST, MANIFEST_PATH);
  const scope = "https://cartivo.test/";
  const fake = (files: string[], manifest?: string[]) => {
    const store = new Map<string, Response>(
      files.map((f) => [scope + f, new Response("x")]),
    );
    if (manifest)
      store.set(
        scope + MANIFEST_PATH,
        new Response(
          JSON.stringify(Object.fromEntries(manifest.map((f) => [f, "h"]))),
        ),
      );
    return {
      keys: async () => [CACHE_PREFIX + "v1", "other-cache"],
      open: async () =>
        ({
          match: async (key: string) => store.get(key)?.clone(),
          keys: async () => [...store.keys()].map((url) => new Request(url)),
        }) as unknown as Cache,
    };
  };
  const files = ["index.html", "assets/core-1.wasm"];
  assert.equal(await offlineCacheComplete(scope, fake(files, files)), true);
  assert.equal(
    await offlineCacheComplete(scope, fake(files, files), "not-installed"),
    false,
  );
  // A core missing, or an install that never wrote its manifest.
  assert.equal(
    await offlineCacheComplete(scope, fake(["index.html"], files)),
    false,
  );
  assert.equal(await offlineCacheComplete(scope, fake(files)), false);
  assert.equal(await offlineCacheComplete(scope, fake([], [])), false);
  assert.equal(
    await offlineCacheComplete(scope, fake(["core.wasm"], ["core.wasm"])),
    false,
  );
});

test("update handshake rejects other tabs and unknown senders", async () => {
  for (const [windows, sender, accepted] of [
    [[{ id: "a", url: "https://test/app/" }], "a", true],
    [
      [
        { id: "a", url: "https://test/app/" },
        { id: "b", url: "https://test/app/game" },
      ],
      "a",
      false,
    ],
    [[{ id: "a", url: "https://test/app/" }], "b", false],
    [[], "a", false],
  ] as const) {
    const handlers: Record<string, (event: any) => void> = {};
    let activated = false;
    let reply: unknown;
    let pending: Promise<unknown> | undefined;
    const scope = {
      registration: { scope: "https://test/app/" },
      location: { origin: "https://test" },
      clients: { matchAll: async () => windows },
      skipWaiting: async () => {
        activated = true;
      },
      addEventListener: (name: string, handler: (event: any) => void) => {
        handlers[name] = handler;
      },
    };
    new Function("self", buildServiceWorker(entries))(scope);
    handlers.message({
      data: { type: "cartivo:activate-update" },
      source: { id: sender },
      ports: [
        {
          postMessage: (value: unknown) => {
            reply = value;
          },
        },
      ],
      waitUntil: (promise: Promise<unknown>) => {
        pending = promise;
      },
    });
    await pending;
    assert.deepEqual(reply, { accepted });
    assert.equal(activated, accepted);
  }
});

test("activation retains old shell assets while a window may still use them", async () => {
  for (const windows of [[], [{ id: "active" }]]) {
    const handlers: Record<string, (event: any) => void> = {};
    const removed: string[] = [];
    let claimed = false;
    let pending: Promise<unknown> | undefined;
    const scope = {
      registration: { scope: "https://test/" },
      clients: {
        matchAll: async () => windows,
        claim: async () => {
          claimed = true;
        },
      },
      addEventListener: (name: string, handler: (event: any) => void) => {
        handlers[name] = handler;
      },
    };
    new Function("self", "caches", buildServiceWorker(entries))(scope, {
      keys: async () => [
        CACHE_PREFIX + "old",
        CACHE_PREFIX + precacheVersion(entries),
        "other-app",
      ],
      delete: async (key: string) => {
        removed.push(key);
      },
    });
    handlers.activate({
      waitUntil: (promise: Promise<unknown>) => {
        pending = promise;
      },
    });
    await pending;
    assert.deepEqual(removed, windows.length ? [] : [CACHE_PREFIX + "old"]);
    assert.equal(claimed, true);
  }
});

test("old hashed assets remain available offline after activation", async () => {
  const handlers: Record<string, (event: any) => void> = {};
  let pending: Promise<Response> | undefined;
  const scope = {
    registration: { scope: "https://test/" },
    location: { origin: "https://test" },
    addEventListener: (name: string, handler: (event: any) => void) => {
      handlers[name] = handler;
    },
  };
  new Function("self", "caches", "fetch", buildServiceWorker(entries))(
    scope,
    {
      keys: async () => [CACHE_PREFIX + "old", "other-app"],
      open: async (key: string) => ({
        match: async () =>
          key === CACHE_PREFIX + "old" ? new Response("old asset") : undefined,
      }),
    },
    () => {
      throw new Error("offline");
    },
  );
  handlers.fetch({
    request: new Request("https://test/assets/old-hash.js"),
    respondWith: (promise: Promise<Response>) => {
      pending = promise;
    },
  });
  assert.equal(await (await pending)!.text(), "old asset");
});
