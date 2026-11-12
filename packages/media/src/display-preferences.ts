import type { AspectMode, ScaleMode } from "./display-scaler.ts";
import {
  MAX_RENDER_SCALE,
  renderChoices,
  type RenderChoice,
} from "../../runtime/src/render-scale.ts";

/**
 * Presentation choices: they never touch timing, and only `resolution`
 * (consoles drawn by the GPU) changes what the core renders.
 */
export type DisplayPreferences = {
  scale: ScaleMode;
  aspect: AspectMode;
  /** Bilinear smoothing. Off by default to keep the original pixel look. */
  smooth: boolean;
  /** Rendering resolution of a console drawn by the GPU (ADR-023). */
  resolution: RenderChoice;
};

export const defaultDisplay: DisplayPreferences = {
  scale: "fit",
  aspect: "corrected",
  smooth: false,
  resolution: "auto",
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
  // Added later: preferences saved before it mean «auto».
  const resolution = v.resolution ?? "auto";
  if (!renderChoices.includes(resolution as RenderChoice)) return;
  return {
    scale: v.scale as ScaleMode,
    aspect: v.aspect as AspectMode,
    smooth: v.smooth,
    resolution: resolution as RenderChoice,
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

/**
 * The highest resolution this device held at full speed for a system: set
 * when «auto» proved too much, so the next game opens lower.
 */
const ceilingKey = (system: string) => `cartivo:render-ceiling:${system}:v1`;

export function readRenderCeiling(system: string, store?: Store): number {
  try {
    const value = Number((store ?? localStorage).getItem(ceilingKey(system)));
    return Number.isInteger(value) && value >= 1 && value <= MAX_RENDER_SCALE
      ? value
      : MAX_RENDER_SCALE;
  } catch {
    return MAX_RENDER_SCALE;
  }
}

export function writeRenderCeiling(
  system: string,
  ceiling: number,
  store?: Store,
) {
  try {
    (store ?? localStorage).setItem(ceilingKey(system), String(ceiling));
  } catch {
    // Not remembered: the same adjustment happens again next time.
  }
}
