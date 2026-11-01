import type { Command, State } from "./session.ts";
export interface Transport {
  postMessage(value: unknown): void;
  addEventListener(
    type: "message" | "error",
    listener: (event: any) => void,
  ): void;
  removeEventListener(
    type: "message" | "error",
    listener: (event: any) => void,
  ): void;
  terminate(): void;
}
export class WorkerSession {
  #transport: Transport;
  #id: string;
  #sequence = 0;
  #disposed = false;
  #pending:
    | {
        requestId: number;
        resolve: (state: State) => void;
        reject: (e: Error) => void;
        cleanup: () => void;
      }
    | undefined;
  constructor(transport: Transport, id: string) {
    this.#transport = transport;
    this.#id = id;
    transport.addEventListener("message", this.#receive);
    transport.addEventListener("error", this.#error);
  }
  #error = () =>
    this.dispose(
      new Error("El proceso se ha detenido. Crea una nueva sesión."),
    );
  #receive = (event: { data: unknown }) => {
    const m = event.data as Record<string, unknown> | null;
    const p = this.#pending;
    if (!m || !p || m.sessionId !== this.#id || m.requestId !== p.requestId)
      return;
    if (
      m.version !== 1 ||
      typeof m.ok !== "boolean" ||
      (m.ok &&
        (typeof m.state !== "string" ||
          !["idle", "running", "paused", "stopped"].includes(m.state))) ||
      (!m.ok && typeof m.error !== "string")
    ) {
      this.dispose(new Error("Respuesta inválida del proceso"));
      return;
    }
    this.#pending = undefined;
    p.cleanup();
    if (m.ok) p.resolve(m.state as State);
    else p.reject(new Error(String(m.error).slice(0, 300)));
  };
  request(
    command: Command,
    options: { signal?: AbortSignal; timeoutMs?: number } = {},
  ): Promise<State> {
    if (this.#disposed) return Promise.reject(new Error("Sesión cerrada"));
    if (this.#pending)
      return Promise.reject(new Error("Espera a que termine la operación"));
    if (options.signal?.aborted)
      return Promise.reject(new Error("Operación cancelada"));
    return new Promise((resolve, reject) => {
      const requestId = ++this.#sequence;
      const abort = () =>
        this.dispose(new Error("Operación cancelada. Crea una nueva sesión."));
      const timer = setTimeout(
        () =>
          this.dispose(
            new Error("El proceso no responde. Crea una nueva sesión."),
          ),
        options.timeoutMs ?? 3000,
      );
      this.#pending = {
        requestId,
        resolve,
        reject,
        cleanup: () => {
          clearTimeout(timer);
          options.signal?.removeEventListener("abort", abort);
        },
      };
      options.signal?.addEventListener("abort", abort, { once: true });
      try {
        this.#transport.postMessage({
          version: 1,
          sessionId: this.#id,
          requestId,
          command,
        });
      } catch {
        this.#error();
      }
    });
  }
  dispose(reason = new Error("Sesión cerrada")): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#transport.removeEventListener("message", this.#receive);
    this.#transport.removeEventListener("error", this.#error);
    this.#transport.terminate();
    const p = this.#pending;
    this.#pending = undefined;
    if (p) {
      p.cleanup();
      p.reject(reason);
    }
  }
}
