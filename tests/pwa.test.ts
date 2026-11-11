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
  assert.equal((source.match(/ignoreVary: true/g) ?? []).length, 2);
});

/** Loads a generated service worker over in-memory caches and network. */
function loadWorker(
  source: string,
  stores: Map<string, Map<string, Response>>,
  network: (target: string) => Promise<Response>,
) {
  const fetched: string[] = [];
  // The worker passes a URL or, from its fetch handler, the request itself.
  const key = (k: string | { url: string }) =>
    typeof k === "string" ? k : k.url;
  const handlers: Record<string, (event: unknown) => void> = {};
  const open = async (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const store = stores.get(name)!;
    return {
      match: async (k: string | { url: string }) => store.get(key(k))?.clone(),
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
    fetch: async (request: string | { url: string }) => {
      const target = key(request);
      fetched.push(target.replace("https://cartivo.test/", ""));
      return network(target);
    },
    Headers,
    Response,
    URL,
  };
  new Function(...Object.keys(scope), "self", source)(
    ...Object.values(scope),
    scope,
  );
  return { handlers, fetched };
}

/** Runs a generated service worker's install; returns the downloaded paths. */
async function installWith(
  source: string,
  stores: Map<string, Map<string, Response>>,
  network = async (target: string) => new Response(`body of ${target}`),
) {
  const { handlers, fetched } = loadWorker(source, stores, network);
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

test("everything the worker serves is cross-origin isolated (ADR-020)", async () => {
  const stores = new Map<string, Map<string, Response>>();
  // Cached copies stored without the headers, as from a version installed
  // before isolation, and a file missing from the cache.
  const plain = async (target: string) =>
    new Response(`body of ${target}`, {
      headers: { "Content-Type": "text/javascript" },
    });
  await installWith(buildServiceWorker(entries), stores, plain);
  const { handlers } = loadWorker(buildServiceWorker(entries), stores, plain);
  const serve = async (path: string, mode = "cors") => {
    let served: Promise<Response> | undefined;
    handlers.fetch({
      request: { method: "GET", mode, url: `https://cartivo.test/${path}` },
      respondWith: (p: Promise<Response>) => (served = p),
    });
    return served!;
  };
  for (const [path, mode] of [
    ["", "navigate"],
    ["assets/index-1.js", "cors"],
    ["assets/not-precached.js", "cors"],
  ]) {
    const response = await serve(path, mode);
    assert.equal(
      response.headers.get("Cross-Origin-Opener-Policy"),
      "same-origin",
      path,
    );
    assert.equal(
      response.headers.get("Cross-Origin-Embedder-Policy"),
      "require-corp",
      path,
    );
    assert.equal(response.headers.get("Content-Type"), "text/javascript", path);
    assert.match(await response.text(), /^body of /, path);
  }
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
  const check = (storage: ReturnType<typeof fake>, version = "v1") =>
    offlineCacheComplete(scope, version, storage);
  assert.equal(await check(fake(files, files)), true);
  // Only the active worker's version counts, never an older cache.
  assert.equal(await check(fake(files, files), "not-installed"), false);
  // A core missing, or an install that never wrote its manifest.
  assert.equal(await check(fake(["index.html"], files)), false);
  assert.equal(await check(fake(files)), false);
  // An empty manifest, or one without the shell, proves nothing.
  assert.equal(await check(fake([], [])), false);
  assert.equal(await check(fake(["core.wasm"], ["core.wasm"])), false);
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

test("activation removes old shell caches, even with the updating window open", async () => {
  // The update is accepted only from the single open window, which reloads:
  // keeping old caches would grow storage by a whole build per update.
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
    assert.deepEqual(removed, [CACHE_PREFIX + "old"]);
    assert.equal(claimed, true);
  }
});
