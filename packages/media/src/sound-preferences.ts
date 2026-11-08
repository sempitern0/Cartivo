// Sound for every game on this device (Ajustes › Sonido): a volume and a
// mute switch, read when a session opens its audio.
export type SoundPreferences = {
  /** 0–1 of the player's full level (the output's 0.3 gain). */
  volume: number;
  muted: boolean;
};

export const defaultSound: SoundPreferences = { volume: 1, muted: false };
export const SOUND_KEY = "cartivo:sound:v1";

type Store = Pick<Storage, "getItem" | "setItem">;

export function parseSound(value: unknown): SoundPreferences | undefined {
  if (!value || typeof value !== "object") return;
  const v = value as Record<string, unknown>;
  if (
    typeof v.volume !== "number" ||
    !(v.volume >= 0 && v.volume <= 1) ||
    typeof v.muted !== "boolean"
  )
    return;
  return { volume: v.volume, muted: v.muted };
}

export function readSound(store?: Store): SoundPreferences {
  try {
    const raw = (store ?? localStorage).getItem(SOUND_KEY);
    return (raw && parseSound(JSON.parse(raw))) || { ...defaultSound };
  } catch {
    return { ...defaultSound };
  }
}

/** False when the browser does not let it be stored. */
export function writeSound(value: SoundPreferences, store?: Store): boolean {
  try {
    (store ?? localStorage).setItem(SOUND_KEY, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/** The output gain for these preferences. */
export const gainOf = ({ volume, muted }: SoundPreferences) =>
  muted ? 0 : 0.3 * volume;
