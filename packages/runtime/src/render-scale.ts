// The resolution a console drawn by the GPU (N64, PS2: systems.ts `surface`)
// is rendered at: a whole multiple of its own. Cartivo picks it for the
// device's screen, so going full screen needs no change; the player can fix
// it in «Ajustes del juego» (ADR-023).

/** The largest multiple of the console's resolution a core draws at. */
export const MAX_RENDER_SCALE = 4;

/** What the player chose: Cartivo decides, or a fixed multiple. */
export type RenderChoice = "auto" | 1 | 2 | 3 | 4;

export const renderChoices: readonly RenderChoice[] = ["auto", 1, 2, 3, 4];

/**
 * The multiple that best fills a screen of `screenLines` physical lines
 * with a picture of `sourceLines`: the nearest one, so a 1080-line screen
 * gets ×2 (not ×3, more than twice the work for little gain). `ceiling` is
 * the most this device has been seen to hold at full speed.
 */
export function autoRenderScale(
  screenLines: number,
  sourceLines: number,
  ceiling = MAX_RENDER_SCALE,
): number {
  const nearest = Math.round(screenLines / sourceLines) || 1;
  return Math.max(1, Math.min(nearest, ceiling, MAX_RENDER_SCALE));
}

export const renderScale = (
  choice: RenderChoice,
  screenLines: number,
  sourceLines: number,
  ceiling?: number,
): number =>
  choice === "auto"
    ? autoRenderScale(screenLines, sourceLines, ceiling)
    : choice;
