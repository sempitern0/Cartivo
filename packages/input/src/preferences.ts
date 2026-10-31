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
    return (
      parseKeyboard(
        JSON.parse(localStorage.getItem("cartivo:keyboard:v1") ?? "null"),
      ) ?? { ...defaultKeyboard }
    );
  } catch {
    return { ...defaultKeyboard };
  }
}
