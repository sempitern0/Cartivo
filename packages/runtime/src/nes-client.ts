import type { NesCommand, NesResult, NesRequest } from "./nes-protocol.ts";
/** Single in-flight request, ordered commands, correlated replies and fatal timeout. */
export class NesClient {
  private worker: Worker;
  private session = crypto.randomUUID();
  private id = 0;
  private closed = false;
  private tail: Promise<unknown> = Promise.resolve();
  private pending:
    | {
        id: number;
        resolve: (r: NesResult) => void;
        reject: (e: Error) => void;
        timer: ReturnType<typeof setTimeout>;
      }
    | undefined;
  private timeoutMs: number;
  constructor(worker: Worker, timeoutMs = 10000) {
    this.timeoutMs = timeoutMs;
    this.worker = worker;
    worker.addEventListener("message", this.message);
    worker.addEventListener("error", this.error);
    worker.addEventListener("messageerror", this.error);
  }
  private error = () =>
    this.dispose("El núcleo se ha detenido inesperadamente.");
  private message = (event: MessageEvent) => {
    const r = event.data;
    const p = this.pending;
    if (!p || r?.session !== this.session || r?.id !== p.id) return;
    clearTimeout(p.timer);
    this.pending = undefined;
    if (r.v !== 1 || typeof r.ok !== "boolean") {
      p.reject(Error("Respuesta del núcleo inválida"));
      this.dispose();
      return;
    }
    if (!r.ok) {
      p.reject(
        Error(typeof r.error === "string" ? r.error : "Error del núcleo"),
      );
      return;
    }
    const result = r.result as NesResult;
    if (
      !result ||
      typeof result !== "object" ||
      (result.pixels &&
        (!(result.pixels instanceof Uint8ClampedArray) ||
          result.pixels.length !== 256 * 240 * 4)) ||
      (result.audio &&
        (!(result.audio instanceof Float32Array) ||
          result.audio.length > 48000))
    ) {
      p.reject(Error("Datos de vídeo/audio inválidos"));
      this.dispose();
      return;
    }
    p.resolve(result);
  };
  request(
    command: NesCommand,
    payload: Partial<NesRequest> = {},
  ): Promise<NesResult> {
    const next = this.tail
      .catch(() => {})
      .then(
        () =>
          new Promise<NesResult>((resolve, reject) => {
            if (this.closed) {
              reject(Error("Sesión cerrada"));
              return;
            }
            const id = ++this.id;
            const timer = setTimeout(
              () =>
                this.dispose("El núcleo no responde. Vuelve a abrir el juego."),
              this.timeoutMs,
            );
            this.pending = { id, resolve, reject, timer };
            try {
              this.worker.postMessage({
                ...payload,
                v: 1,
                session: this.session,
                id,
                command,
              });
            } catch {
              this.dispose("No se pudo enviar el archivo al núcleo");
            }
          }),
      );
    this.tail = next;
    return next;
  }
  dispose(reason = "Sesión cerrada") {
    if (this.closed) return;
    this.closed = true;
    if (this.pending) {
      clearTimeout(this.pending.timer);
      this.pending.reject(Error(reason));
      this.pending = undefined;
    }
    this.worker.removeEventListener("message", this.message);
    this.worker.removeEventListener("error", this.error);
    this.worker.removeEventListener("messageerror", this.error);
    this.worker.terminate();
  }
}
