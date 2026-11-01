import { nesCores, type NesCoreId } from "../../adapters/src/core-ids.ts";

/** Default NES core once TetaNES passed its gate (ADR-008). */
export const defaultNesCore: NesCoreId = "tetanes";
const key = "cartivo:core:nes:v1";

export function isNesCore(value: unknown): value is NesCoreId {
  return (nesCores as readonly unknown[]).includes(value);
}

type Store = Pick<Storage, "getItem" | "setItem">;

export function readNesCore(store?: Store): NesCoreId {
  try {
    const value = (store ?? localStorage).getItem(key);
    return isNesCore(value) ? value : defaultNesCore;
  } catch {
    return defaultNesCore;
  }
}

export function writeNesCore(id: NesCoreId, store?: Store): boolean {
  try {
    (store ?? localStorage).setItem(key, id);
    return true;
  } catch {
    return false;
  }
}
