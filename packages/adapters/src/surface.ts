// What the cores that draw on the game canvas share (ADR-017): the WebGL2
// context an Emscripten module renders on, and the readback of its picture.

/** Emscripten's GL library, as the surface cores export it. */
export type EmscriptenGl = {
  createContext(
    canvas: OffscreenCanvas,
    attributes: Record<string, unknown>,
  ): number;
  makeContextCurrent(handle: number): boolean;
};

/**
 * Creates the canvas's WebGL2 context for a module and makes it current.
 * The drawing buffer is kept between frames so surfaceFrame() can read a
 * preview at any time. `system` names the console in the error.
 */
export function useSurface(
  gl: EmscriptenGl,
  canvas: OffscreenCanvas,
  system: string,
  stencil: boolean,
) {
  const context = gl.createContext(canvas, {
    majorVersion: 2,
    minorVersion: 0,
    alpha: false,
    depth: true,
    stencil,
    antialias: false,
    preserveDrawingBuffer: true,
  });
  if (!context || !gl.makeContextCurrent(context))
    throw Error(
      `Este navegador no ofrece WebGL2 en segundo plano, que ${system} necesita.`,
    );
}

/**
 * The picture on the surface as RGBA, for Partidas and «Continuar»
 * previews: one readback on demand, never per frame. Rows come bottom-up
 * from GL and are flipped. Empty if the canvas has no WebGL2 context.
 */
export function surfaceFrame(canvas: OffscreenCanvas): Uint8ClampedArray {
  const gl = canvas.getContext("webgl2");
  if (!gl) return new Uint8ClampedArray(0);
  const { width, height } = canvas;
  const read = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING);
  const pack = gl.getParameter(gl.PIXEL_PACK_BUFFER_BINDING);
  const bottomUp = new Uint8ClampedArray(width * height * 4);
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
  gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, bottomUp);
  // The cores cache their bindings: leave them as they were.
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, read);
  gl.bindBuffer(gl.PIXEL_PACK_BUFFER, pack);
  const row = width * 4;
  const frame = new Uint8ClampedArray(bottomUp.length);
  for (let y = 0; y < height; y++)
    frame.set(
      bottomUp.subarray((height - 1 - y) * row, (height - y) * row),
      y * row,
    );
  for (let i = 3; i < frame.length; i += 4) frame[i] = 255;
  return frame;
}
