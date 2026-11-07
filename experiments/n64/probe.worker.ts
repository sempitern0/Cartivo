import { inspectRomHeader, MAX_N64_ROM_BYTES } from "./preflight.ts";
import type { ProbeRequest, ProbeResult } from "./protocol.ts";

self.onmessage = async ({ data }: MessageEvent<ProbeRequest>) => {
  let gl: WebGL2RenderingContext | null = null;
  const started = performance.now();
  const send = (result: ProbeResult) => self.postMessage(result);
  try {
    if (
      !data ||
      data.version !== 1 ||
      typeof OffscreenCanvas === "undefined" ||
      !(data.canvas instanceof OffscreenCanvas) ||
      (data.file !== undefined && !(data.file instanceof Blob))
    )
      throw new Error("Solicitud de diagnóstico inválida.");
    const file = data.file;
    // Reject impossible sizes before IO or allocating graphics resources.
    if (
      file &&
      (file.size < 4096 || file.size > MAX_N64_ROM_BYTES || file.size % 4 !== 0)
    )
      throw new Error(
        "El prototipo admite cartuchos alineados de 4 KiB a 64 MiB.",
      );
    const rom = file
      ? inspectRomHeader(
          new Uint8Array(await file.slice(0, 64).arrayBuffer()),
          file.size,
        )
      : undefined;
    let webgl2 = false;
    let webglReason = "WebGL2 no está disponible en este Worker.";
    try {
      gl = data.canvas.getContext("webgl2", { antialias: false, depth: false });
      if (gl) {
        gl.clearColor(0.25, 0.5, 0.75, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        const pixel = new Uint8Array(4);
        // One diagnostic readback, never a per-frame presentation path.
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
        webgl2 =
          !gl.isContextLost() &&
          gl.getError() === gl.NO_ERROR &&
          Math.abs(pixel[0] - 64) <= 1 &&
          Math.abs(pixel[1] - 128) <= 1 &&
          Math.abs(pixel[2] - 191) <= 1 &&
          pixel[3] === 255;
        webglReason = webgl2
          ? "Contexto WebGL2 y framebuffer comprobados en Worker."
          : "El framebuffer de prueba no produjo el resultado esperado.";
      }
    } catch {
      webglReason =
        "El navegador rechazó la creación o el uso de WebGL2 en Worker.";
    }
    send({
      version: 1,
      ok: true,
      webgl2,
      webglReason,
      wasm:
        typeof WebAssembly !== "undefined" &&
        WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0])),
      isolated: self.crossOriginIsolated === true,
      rom,
      headerReadBytes: file ? 64 : 0,
      elapsedMs: performance.now() - started,
    });
  } catch (error) {
    send({
      version: 1,
      ok: false,
      error: error instanceof Error ? error.message : "Falló el diagnóstico.",
    });
  } finally {
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    self.close();
  }
};
