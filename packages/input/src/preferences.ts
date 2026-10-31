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
    // Upgrade previous arrow-based defaults individually, preserving manual
    // direction remaps and all unrelated actions.
    const migrated = { ...saved };
    const directions = {
      up: ["ArrowUp", "KeyW"],
      down: ["ArrowDown", "KeyS"],
      left: ["ArrowLeft", "KeyA"],
      right: ["ArrowRight", "KeyD"],
    } as const;
    for (const [action, [oldCode, newCode]] of Object.entries(directions)) {
      if (migrated[action as keyof KeyboardProfile] === oldCode)
        migrated[action as keyof KeyboardProfile] = newCode;
    }
    if (saved.select === "ShiftRight" && !Object.values(migrated).includes("KeyQ"))
      migrated.select = "KeyQ";
    if (saved.a === "KeyX" && saved.b === "KeyZ") {
      migrated.a = "KeyL";
      migrated.b = "KeyK";
    }
    if (parseKeyboard(migrated)) {
      if (JSON.stringify(migrated) !== JSON.stringify(saved))
        localStorage.setItem("cartivo:keyboard:v1", JSON.stringify(migrated));
      return migrated;
    }
    return saved;
  } catch {
    return { ...defaultKeyboard };
  }
}
