// Who is playing (ADR-016). Cartivo asks on every visit; the choice lasts
// for the tab (sessionStorage), so a reload or an update keeps it.
import {
  deleteProfileData,
  isProfileColor,
  newProfile,
  PRINCIPAL,
  profileName,
  readProfiles,
  scoped,
  writeProfiles,
  type Profile,
} from "../../../packages/storage/src/profiles.ts";

const ACTIVE_KEY = "cartivo:profile:active";

function list(): Profile[] {
  try {
    return readProfiles();
  } catch {
    return readProfiles({ getItem: () => null, setItem: () => {} });
  }
}

function chosen(all: readonly Profile[]): Profile | undefined {
  try {
    const id = sessionStorage.getItem(ACTIVE_KEY);
    return all.find((p) => p.id === id);
  } catch {
    return undefined;
  }
}

class Profiles {
  all = $state.raw<Profile[]>(list());
  /** Undefined until the player picks a profile for this visit. */
  active = $state.raw<Profile | undefined>(chosen(this.all));
  /** The id stores use; the first profile until one is picked. */
  id = $derived(this.active?.id ?? PRINCIPAL);

  choose(profile: Profile | undefined) {
    if (profile) {
      profile = { ...profile, lastUsedAt: Date.now() };
      // Remembering who played last is a convenience: never block on it.
      const used = profile;
      try {
        this.#change((all) => all.map((p) => (p.id === used.id ? used : p)));
      } catch {
        // Storage refused: the picker just starts on the first profile.
      }
    }
    this.active = profile;
    try {
      if (profile) sessionStorage.setItem(ACTIVE_KEY, profile.id);
      else sessionStorage.removeItem(ACTIVE_KEY);
    } catch {
      // Without sessionStorage the choice lasts until the page reloads.
    }
  }

  /**
   * Read-modify-write against storage, not this tab's copy: another tab may
   * have added or removed a profile meanwhile, and overwriting it with a
   * stale list would hide that profile and its saves.
   */
  #change(update: (current: Profile[]) => Profile[]) {
    const next = update(readProfiles());
    writeProfiles(next);
    this.all = next;
  }

  /** Throws a readable message (invalid name, too many profiles, storage). */
  add(name: string, color?: number): Profile {
    let profile!: Profile;
    this.#change((all) => {
      const created = newProfile(name, all);
      profile = isProfileColor(color) ? { ...created, color } : created;
      return [...all, profile];
    });
    return profile;
  }

  /** New name and colour; throws a readable message. */
  update(profile: Profile, name: string, color: number) {
    const valid = profileName(name);
    if (!valid) throw Error("Escribe un nombre de 1 a 24 caracteres.");
    if (!isProfileColor(color)) throw Error("Elige uno de los colores.");
    const updated = { ...profile, name: valid, color };
    this.#change((all) => all.map((p) => (p.id === profile.id ? updated : p)));
    if (this.active?.id === profile.id) this.active = updated;
  }

  /** Deletes a profile and everything it saved (never the first one). */
  async remove(profile: Profile) {
    if (profile.id === PRINCIPAL)
      throw Error("Este perfil no se puede borrar.");
    this.#change((all) => all.filter((p) => p.id !== profile.id));
    if (this.active?.id === profile.id) this.choose(undefined);
    await deleteProfileData(profile.id);
  }

  /** A preference key (controls) for the profile playing now. */
  key(name: string) {
    return scoped(name, this.id);
  }
}

export const profiles = new Profiles();
