import type { AspectMode, ScaleMode } from "./display-scaler.ts";

/** Presentation choices only: they never touch the framebuffer or timing. */
export type DisplayPreferences = {
  scale: ScaleMode;
  aspect: AspectMode;
  /** Bilinear smoothing. Off by default to keep the original pixel look. */
  smooth: boolean;
};

export const defaultDisplay: DisplayPreferences = {
  scale: "fit",
  aspect: "corrected",
  smooth: false,
};

const scales: readonly ScaleMode[] = ["fit", "integer", "corrected-integer"];
const aspects: readonly AspectMode[] = ["corrected", "native"];

export function parseDisplay(value: unknown): DisplayPreferences | undefined {
  if (!value || typeof value !== "object") return;
  const v = value as Record<string, unknown>;
  if (v.v !== 1) return;
  if (!scales.includes(v.scale as ScaleMode)) return;
  if (!aspects.includes(v.aspect as AspectMode)) return;
  if (typeof v.smooth !== "boolean") return;
  return {
    scale: v.scale as ScaleMode,
    aspect: v.aspect as AspectMode,
    smooth: v.smooth,
  };
}

export const displayKey = (system: string) => `cartivo:display:${system}:v1`;

type Store = Pick<Storage, "getItem" | "setItem">;

export function readDisplay(system: string, store?: Store): DisplayPreferences {
  try {
    const raw = (store ?? localStorage).getItem(displayKey(system));
    return parseDisplay(JSON.parse(raw ?? "null")) ?? { ...defaultDisplay };
  } catch {
    return { ...defaultDisplay };
  }
}

/** Returns false when storage is unavailable; the choice still applies now. */
export function writeDisplay(
  system: string,
  prefs: DisplayPreferences,
  store?: Store,
): boolean {
  try {
    (store ?? localStorage).setItem(
      displayKey(system),
      JSON.stringify({ v: 1, ...prefs }),
    );
    return true;
  } catch {
    return false;
  }
}
