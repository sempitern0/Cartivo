// Checks that the installed app really has everything it needs offline.
// Must match CACHE_PREFIX and MANIFEST_PATH in tools/pwa-plugin.mjs
// (tests/pwa.test.ts checks it).
export const SHELL_CACHE_PREFIX = "cartivo-shell-";
export const PRECACHE_MANIFEST = "__cartivo-precache.json";

/**
 * True when some Cartivo cache is complete. The service worker writes the
 * manifest last, so its presence plus every listed file means a finished
 * install; only request keys are read, never the cached bodies.
 */
export async function offlineCacheComplete(
  scope: string,
  storage: Pick<CacheStorage, "keys" | "open"> = caches,
  version?: string,
): Promise<boolean> {
  for (const name of await storage.keys()) {
    if (!name.startsWith(SHELL_CACHE_PREFIX)) continue;
    if (version !== undefined && name !== SHELL_CACHE_PREFIX + version)
      continue;
    const cache = await storage.open(name);
    const manifest = await cache.match(new URL(PRECACHE_MANIFEST, scope).href);
    if (!manifest) continue;
    let data: unknown;
    try {
      data = await manifest.json();
    } catch {
      continue;
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) continue;
    const files = data as Record<string, unknown>;
    if (
      !Object.hasOwn(files, "index.html") ||
      !Object.values(files).every(
        (hash) => typeof hash === "string" && hash.length > 0,
      )
    )
      continue;
    const listed = Object.keys(files);
    const stored = new Set((await cache.keys()).map((request) => request.url));
    if (listed.every((path) => stored.has(new URL(path, scope).href)))
      return true;
  }
  return false;
}
