// Who is playing (ADR-016). Cartivo asks on every visit; the choice lasts
// for the tab (sessionStorage), so a reload or an update keeps it.
import {
  deleteProfileData,
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
    this.active = profile;
    try {
      if (profile) sessionStorage.setItem(ACTIVE_KEY, profile.id);
      else sessionStorage.removeItem(ACTIVE_KEY);
    } catch {
      // Without sessionStorage the choice lasts until the page reloads.
    }
  }

  #save(next: Profile[]) {
    writeProfiles(next);
    this.all = next;
  }

  /** Throws a readable message (invalid name, too many profiles, storage). */
  add(name: string): Profile {
    const profile = newProfile(name, this.all);
    this.#save([...this.all, profile]);
    return profile;
  }

  rename(profile: Profile, name: string) {
    const valid = profileName(name);
    if (!valid) throw Error("Escribe un nombre de 1 a 24 caracteres.");
    const renamed = { ...profile, name: valid };
    this.#save(this.all.map((p) => (p.id === profile.id ? renamed : p)));
    if (this.active?.id === profile.id) this.active = renamed;
  }

  /** Deletes a profile and everything it saved (never the first one). */
  async remove(profile: Profile) {
    if (profile.id === PRINCIPAL)
      throw Error("Este perfil no se puede borrar.");
    this.#save(this.all.filter((p) => p.id !== profile.id));
    if (this.active?.id === profile.id) this.choose(undefined);
    await deleteProfileData(profile.id);
  }

  /** A preference key (controls) for the profile playing now. */
  key(name: string) {
    return scoped(name, this.id);
  }
}

export const profiles = new Profiles();
