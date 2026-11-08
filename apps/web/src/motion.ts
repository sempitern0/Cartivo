// Animations (docs/DESIGN.md): automatic follows the system's «reduce
// motion» setting; the player can turn them on or reduce them in Ajustes ›
// Interfaz. Windows with «Animation effects» off asks browsers to reduce
// motion, which hid every animation for players who never chose that here.
export type MotionPreference = "auto" | "full" | "reduce";

export const parseMotion = (value: unknown): MotionPreference =>
  value === "full" || value === "reduce" ? value : "auto";

/** Whether to reduce motion, given the preference and the system setting. */
export const reducesMotion = (
  preference: MotionPreference,
  systemReduces: boolean,
): boolean =>
  preference === "reduce" || (preference === "auto" && systemReduces);
