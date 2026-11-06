// Player profiles on one device (ADR-016): each profile has its own battery
// saves, Partidas, library and controls; ROM copies are shared by hash.
// The first profile owns everything saved before profiles existed, under the
// original names: nothing is migrated, so nothing can be lost on upgrade.
// Other profiles use the same stores with "@<id>" appended to their names.

export type Profile = {
  /** Lowercase letters and digits; "principal" for the first profile. */
  id: string;
  name: string;
  /** Index into the profile palette (theme.css `--profile-<n>`). */
  color: number;
};

export const PRINCIPAL = "principal";
export const PROFILE_COLORS = 6;
export const MAX_PROFILE_NAME = 24;
export const MAX_PROFILES = 8;
export const PROFILES_KEY = "cartivo:profiles:v1";

const principal: Profile = { id: PRINCIPAL, name: "Jugador 1", color: 0 };

export const isProfileId = (value: unknown): value is string =>
  typeof value === "string" && /^[a-z0-9]{1,16}$/.test(value);

/** The name of a store (database, lock, preference) for a profile. */
export const scoped = (name: string, profile: string) =>
  profile === PRINCIPAL ? name : `${name}@${profile}`;

/** A trimmed name of 1–24 characters, or undefined. */
export function profileName(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const name = value.trim().replace(/\s+/g, " ");
  return name && name.length <= MAX_PROFILE_NAME ? name : undefined;
}

function parseProfile(value: unknown): Profile | undefined {
  if (!value || typeof value !== "object") return undefined;
  const p = value as Record<string, unknown>;
  const name = profileName(p.name);
  if (
    !isProfileId(p.id) ||
    !name ||
    !Number.isInteger(p.color) ||
    (p.color as number) < 0 ||
    (p.color as number) >= PROFILE_COLORS
  )
    return undefined;
  return { id: p.id, name, color: p.color as number };
}

type Store = Pick<Storage, "getItem" | "setItem">;

/** Every profile, the first one always present and first. */
export function readProfiles(store: Store = localStorage): Profile[] {
  let stored: unknown;
  try {
    stored = JSON.parse(store.getItem(PROFILES_KEY) ?? "null");
  } catch {
    stored = null;
  }
  const list = Array.isArray(stored)
    ? stored.map(parseProfile).filter((p): p is Profile => !!p)
    : [];
  const unique = list.filter(
    (p, i) => list.findIndex((q) => q.id === p.id) === i,
  );
  const first = unique.find((p) => p.id === PRINCIPAL) ?? principal;
  return [first, ...unique.filter((p) => p.id !== PRINCIPAL)].slice(
    0,
    MAX_PROFILES,
  );
}

export function writeProfiles(
  profiles: readonly Profile[],
  store: Store = localStorage,
) {
  store.setItem(PROFILES_KEY, JSON.stringify(profiles));
}

/** A new profile with a fresh id and the first colour not yet in use. */
export function newProfile(
  name: string,
  existing: readonly Profile[],
  random: () => number = Math.random,
): Profile {
  const valid = profileName(name);
  if (!valid) throw Error("Escribe un nombre de 1 a 24 caracteres.");
  if (existing.length >= MAX_PROFILES)
    throw Error(`Caben ${MAX_PROFILES} perfiles en este dispositivo.`);
  let id: string;
  do
    id = Math.floor(random() * 36 ** 8)
      .toString(36)
      .padStart(8, "0");
  while (id === PRINCIPAL || existing.some((p) => p.id === id));
  const used = new Set(existing.map((p) => p.color));
  const color =
    [...Array(PROFILE_COLORS).keys()].find((c) => !used.has(c)) ??
    existing.length % PROFILE_COLORS;
  return { id, name: valid, color };
}

/** The databases a profile owns (sram.ts, states.ts, library.ts). */
export const PROFILE_DATABASES = [
  "cartivo-saves",
  "cartivo-states",
  "cartivo-library",
] as const;

/**
 * Deletes everything a (non-first) profile owns: its databases and its
 * preferences. ROM copies only it remembered become orphans, which the
 * library prunes later (pruneOrphanRoms).
 */
export async function deleteProfileData(
  profile: string,
  store: Pick<Storage, "length" | "key" | "removeItem"> = localStorage,
) {
  if (profile === PRINCIPAL || !isProfileId(profile))
    throw Error("Este perfil no se puede borrar.");
  await Promise.all(
    PROFILE_DATABASES.map(
      (name) =>
        new Promise<void>((resolve, reject) => {
          const req = indexedDB.deleteDatabase(scoped(name, profile));
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
          // Another tab still has it open: it is deleted once that closes.
          req.onblocked = () => resolve();
        }),
    ),
  );
  const suffix = `@${profile}`;
  const keys: string[] = [];
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i);
    if (key?.endsWith(suffix)) keys.push(key);
  }
  for (const key of keys) store.removeItem(key);
}
