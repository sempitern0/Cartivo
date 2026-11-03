// How much this browser lets Cartivo keep (ADR-003): decides the notices on
// the home screen. Only facts the browser exposes, never a guess from quotas.
export type StorageHealth =
  /** Saves, Partidas and the library all work. */
  | "ok"
  /** Saves work, but there is no OPFS: no library copies, and the profile
   * is usually ephemeral (a Safari or Firefox private window). */
  | "limited"
  /** No Web Locks or IndexedDB: games run, nothing is saved. */
  | "none";

type Env = {
  indexedDB?: unknown;
  navigator?: {
    locks?: unknown;
    storage?: { getDirectory?: () => Promise<unknown> };
  };
};

export async function storageHealth(
  env: Env = globalThis as Env,
): Promise<StorageHealth> {
  if (!env.indexedDB || !env.navigator?.locks) return "none";
  try {
    await env.navigator.storage!.getDirectory!();
    return "ok";
  } catch {
    return "limited";
  }
}
