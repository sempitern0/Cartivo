import {
  defaultKeyboard,
  parseKeyboard,
  type Pad,
  type Profile,
  type KeyboardProfile,
} from "./nes-input.ts";
export type PadPreference =
  | { mode: "auto" }
  | { mode: "keyboard" }
  | {
      mode: "pad";
      index: number;
      id: string;
      profile?: Profile;
      deadzone: number;
    };
// Session preference is intentionally not a persistent device identity.
let preference: PadPreference = { mode: "auto" };
export const getPadPreference = () => preference;
export function selectPad(
  pad: Pad | undefined,
  profile?: Profile,
  deadzone = 0.25,
) {
  preference = pad
    ? { mode: "pad", index: pad.index, id: pad.id, profile, deadzone }
    : { mode: "keyboard" };
}
export function readKeyboard(): KeyboardProfile {
  try {
    const saved = parseKeyboard(
      JSON.parse(localStorage.getItem("cartivo:keyboard:v1") ?? "null"),
    );
    if (!saved) return { ...defaultKeyboard };
    // Migrate only the former untouched X/Z defaults; keep custom bindings.
    if (saved.a === "KeyX" && saved.b === "KeyZ") {
      const migrated = { ...saved, a: "KeyK", b: "KeyL" };
      if (parseKeyboard(migrated)) {
        localStorage.setItem("cartivo:keyboard:v1", JSON.stringify(migrated));
        return migrated;
      }
    }
    return saved;
  } catch {
    return { ...defaultKeyboard };
  }
}
