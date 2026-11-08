// The game canvas handed to the Worker for a core that draws with WebGL2
// (ADR-017). Checked before anything is downloaded: without these the core
// could never present a frame.

/** Why this browser cannot give a core its own surface, or undefined. */
export function surfaceProblem(): string | undefined {
  const offscreen =
    typeof HTMLCanvasElement !== "undefined" &&
    typeof HTMLCanvasElement.prototype.transferControlToOffscreen ===
      "function";
  if (offscreen && typeof WebGL2RenderingContext !== "undefined") return;
  return "Este navegador no puede ejecutar este sistema: necesita WebGL2 y OffscreenCanvas. Prueba con una versión reciente de Chrome, Edge o Firefox.";
}

/** Transfers the canvas; the page never draws on it again. */
export function surfaceFor(canvas: HTMLCanvasElement | undefined) {
  const problem = surfaceProblem();
  if (problem) throw Error(problem);
  if (!canvas) throw Error("El lienzo del juego no está preparado.");
  return canvas.transferControlToOffscreen();
}
