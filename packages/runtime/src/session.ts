export type State = "idle" | "running" | "paused" | "stopped";
export type Command = "start" | "pause" | "resume" | "stop";
export interface Message {
  version: 1;
  sessionId: string;
  command: Command;
}
export function parseMessage(value: unknown): Message {
  if (!value || typeof value !== "object") throw new Error("Mensaje inválido");
  const v = value as Record<string, unknown>;
  if (
    v.version !== 1 ||
    typeof v.sessionId !== "string" ||
    !v.sessionId ||
    v.sessionId.length > 128 ||
    !["start", "pause", "resume", "stop"].includes(String(v.command))
  )
    throw new Error("Protocolo inválido");
  return { version: 1, sessionId: v.sessionId, command: v.command as Command };
}
export class Session {
  #state: State = "idle";
  readonly id: string;
  constructor(id: string) {
    if (!id) throw new Error("ID obligatorio");
    this.id = id;
  }
  get state(): State {
    return this.#state;
  }
  dispatch(raw: unknown): State {
    const m = parseMessage(raw);
    if (m.sessionId !== this.id) throw new Error("Sesión obsoleta");
    if (m.command === "stop") return (this.#state = "stopped");
    if (m.command === "start" && this.#state === "idle")
      return (this.#state = "running");
    if (m.command === "pause" && this.#state === "running")
      return (this.#state = "paused");
    if (m.command === "resume" && this.#state === "paused")
      return (this.#state = "running");
    throw new Error("Transición no permitida");
  }
  dispose(): void {
    this.#state = "stopped";
  }
}
