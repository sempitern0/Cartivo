import type { SystemInfo } from "./systems.ts";

// Per-system core choice. The NES key is unchanged from earlier releases.
const key = (systemId: string) => `cartivo:core:${systemId}:v1`;

type Store = Pick<Storage, "getItem" | "setItem">;

export function readCore(system: SystemInfo, store?: Store): string {
  try {
    const value = (store ?? localStorage).getItem(key(system.id));
    return system.cores.some((c) => c.id === value)
      ? (value as string)
      : system.defaultCore;
  } catch {
    return system.defaultCore;
  }
}

export function writeCore(
  system: SystemInfo,
  id: string,
  store?: Store,
): boolean {
  if (!system.cores.some((c) => c.id === id)) return false;
  try {
    (store ?? localStorage).setItem(key(system.id), id);
    return true;
  } catch {
    return false;
  }
}
