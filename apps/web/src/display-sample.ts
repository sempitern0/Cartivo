// Cartivo's own test picture for the display preview (Ajustes › Pantalla and
// «Ajustes del juego»): drawn here at a console's source resolution, so the
// preview shows what scaling, aspect and smoothing do to real pixels without
// any third-party art.

/** A 16×16 original sprite: a round creature (. empty, o outline, b body, w eye). */
const SPRITE = [
  "................",
  ".....oooooo.....",
  "...oobbbbbboo...",
  "..obbbbbbbbbbo..",
  ".obbbwwbbwwbbbo.",
  ".obbbwobbwobbbo.",
  "obbbbwobbwobbbbo",
  "obbbbbbbbbbbbbbo",
  "obbbbbbbbbbbbbbo",
  "obbboobbbboobbbo",
  ".obbbboooobbbbo.",
  ".obbbbbbbbbbbbo.",
  "..obbbbbbbbbbo..",
  "...oobbbbbboo...",
  ".....oooooo.....",
  "................",
];
const COLORS: Record<string, readonly number[]> = {
  o: [17, 18, 24],
  b: [97, 157, 229],
  w: [250, 250, 250],
};
const SKY = [
  [24, 28, 52],
  [36, 44, 84],
  [52, 66, 120],
  [78, 98, 160],
] as const;
const GROUND = [
  [58, 140, 112],
  [44, 112, 90],
] as const;

/** Where the sprite's centre falls, so the zoom can frame it. */
export function spriteCentre(width: number, height: number) {
  return { x: Math.floor(width / 2), y: Math.floor(height * 0.6) };
}

/**
 * RGBA pixels: banded sky, a diagonal (shows uneven scaling), a 1-pixel
 * checker strip (shows smoothing), tiled ground and the sprite.
 */
export function samplePixels(width: number, height: number): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(width * height * 4);
  const ground = Math.floor(height * 0.75);
  const put = (x: number, y: number, [r, g, b]: readonly number[]) => {
    const at = (y * width + x) * 4;
    pixels[at] = r;
    pixels[at + 1] = g;
    pixels[at + 2] = b;
    pixels[at + 3] = 255;
  };
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      put(
        x,
        y,
        y >= ground
          ? GROUND[((x >> 3) + ((y - ground) >> 3)) & 1]
          : SKY[Math.min(3, Math.floor((y / ground) * 4))],
      );
  const { x: cx, y: cy } = spriteCentre(width, height);
  // The checker strip and the diagonal sit just left of the sprite.
  for (let y = cy - 8; y < cy + 8; y++)
    for (let x = cx - 30; x < cx - 14; x++)
      if (x >= 0 && y >= 0) put(x, y, (x + y) & 1 ? COLORS.w : COLORS.o);
  for (let i = 0; i < 24; i++) {
    const x = cx + 12 + i;
    const y = cy + 8 - Math.floor(i / 2);
    if (x < width && y >= 0) put(x, y, COLORS.w);
  }
  SPRITE.forEach((row, sy) =>
    [...row].forEach((cell, sx) => {
      const x = cx - 8 + sx;
      const y = cy - 8 + sy;
      if (COLORS[cell] && x >= 0 && x < width && y >= 0 && y < height)
        put(x, y, COLORS[cell]);
    }),
  );
  return pixels;
}
