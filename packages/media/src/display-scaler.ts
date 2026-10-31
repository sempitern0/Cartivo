/**
 * Presentation geometry. Never changes the emulator's framebuffer or timing.
 * Sizes are CSS pixels; HiDPI rendering is the browser's responsibility.
 */
export type ScaleMode = "fit" | "integer" | "corrected-integer";
export type AspectMode = "corrected" | "native";
export type VideoDescriptor = {
  sourceWidth: number;
  sourceHeight: number;
  displayAspect: number;
  pixelArt: boolean;
  dynamicResolution: boolean;
};
export type DisplayLayout = {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
  actualMode: "fit" | "integer" | "corrected-integer";
  fallback: boolean;
};

export const NES_VIDEO: VideoDescriptor = {
  sourceWidth: 256,
  sourceHeight: 240,
  displayAspect: 4 / 3,
  pixelArt: true,
  dynamicResolution: false,
};

export function displayLayout(
  containerWidth: number,
  containerHeight: number,
  video: VideoDescriptor,
  mode: ScaleMode = "fit",
  aspect: AspectMode = "corrected",
): DisplayLayout {
  const W = Math.max(
    0,
    Math.floor(Number.isFinite(containerWidth) ? containerWidth : 0),
  );
  const H = Math.max(
    0,
    Math.floor(Number.isFinite(containerHeight) ? containerHeight : 0),
  );
  const sw = video.sourceWidth;
  const sh = video.sourceHeight;
  if (
    !Number.isFinite(sw) ||
    !Number.isFinite(sh) ||
    sw <= 0 ||
    sh <= 0 ||
    !Number.isFinite(video.displayAspect) ||
    video.displayAspect <= 0 ||
    !W ||
    !H
  ) {
    return {
      width: 0,
      height: 0,
      offsetX: 0,
      offsetY: 0,
      actualMode: "fit",
      fallback: mode !== "fit",
    };
  }
  const dar = aspect === "native" ? sw / sh : video.displayAspect;
  let width = 0;
  let height = 0;
  let actualMode: DisplayLayout["actualMode"] = "fit";
  if (mode === "integer") {
    const factor = Math.floor(Math.min(W / sw, H / sh));
    if (factor >= 1) {
      width = sw * factor;
      height = sh * factor;
      actualMode = "integer";
    }
  } else if (
    mode === "corrected-integer" &&
    aspect === "corrected" &&
    sw === 256 &&
    sh === 240 &&
    Math.abs(dar - 4 / 3) < 1e-6
  ) {
    // Square output pixel grid with 5 horizontal and 4 vertical CSS pixels
    // per source pixel (and integer multiples thereof).
    const factor = Math.floor(Math.min(W / (sw * 5), H / (sh * 4)));
    if (factor >= 1) {
      width = sw * 5 * factor;
      height = sh * 4 * factor;
      actualMode = "corrected-integer";
    }
  }
  if (!width || !height) {
    // Constrain both dimensions, with no crop/stretch even below 1x.
    width = Math.min(W, Math.floor(H * dar));
    height = Math.min(H, Math.floor(width / dar));
    // Preserve fit in narrow viewports where flooring would collapse a dimension.
    if (!width || !height) {
      height = Math.min(H, Math.floor(W / dar));
      width = Math.min(W, Math.floor(height * dar));
    }
    actualMode = "fit";
  }
  return {
    width,
    height,
    offsetX: Math.floor((W - width) / 2),
    offsetY: Math.floor((H - height) / 2),
    actualMode,
    fallback: mode !== actualMode,
  };
}
