// Checks that the installed app really has everything it needs offline.
// Must match CACHE_PREFIX and MANIFEST_PATH in tools/pwa-plugin.mjs
// (tests/pwa.test.ts checks it).
export const SHELL_CACHE_PREFIX = "cartivo-shell-";
export const PRECACHE_MANIFEST = "__cartivo-precache.json";

/** A precache manifest: file → hash, always with the shell's index.html. */
function isManifest(data: unknown): data is Record<string, string> {
  return (
    !!data &&
    typeof data === "object" &&
    !Array.isArray(data) &&
    Object.hasOwn(data, "index.html") &&
    Object.values(data).every((hash) => typeof hash === "string" && hash !== "")
  );
}

/**
 * True when the cache of the active service worker's `version` is complete.
 * The worker writes the manifest last, so a valid manifest plus every
 * listed file means a finished install; only request keys are read, never
 * the cached bodies.
 */
export async function offlineCacheComplete(
  scope: string,
  version: string,
  storage: Pick<CacheStorage, "keys" | "open"> = caches,
): Promise<boolean> {
  const name = SHELL_CACHE_PREFIX + version;
  // open() would create a missing cache: check it exists first.
  if (!(await storage.keys()).includes(name)) return false;
  const cache = await storage.open(name);
  const manifest = await cache.match(new URL(PRECACHE_MANIFEST, scope).href);
  const files: unknown = await manifest?.json().catch(() => undefined);
  if (!isManifest(files)) return false;
  const stored = new Set((await cache.keys()).map((request) => request.url));
  return Object.keys(files).every((path) =>
    stored.has(new URL(path, scope).href),
  );
}
