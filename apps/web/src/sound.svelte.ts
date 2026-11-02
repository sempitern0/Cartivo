// Game audio for one session. Optional by design: a game always starts,
// even when the browser blocks audio until a user gesture.
import audioWorkletUrl from "./audio.worklet.ts?worker&url";
import { GameAudio } from "../../../packages/media/src/audio.ts";

export class GameSound {
  ready = $state(false);
  muted = $state(false);
  #audio: GameAudio | undefined;
  #closed = false;

  /** Opens a new output; resolves false when the browser refuses it. */
  async #open(): Promise<boolean> {
    this.#audio?.close();
    const next = new GameAudio();
    this.#audio = next;
    try {
      await next.open(new URL(audioWorkletUrl, location.href));
      if (this.#closed || this.#audio !== next) {
        next.close();
        return false;
      }
      next.mute(this.muted);
      this.ready = true;
      return true;
    } catch {
      next.close();
      if (this.#audio === next) {
        this.#audio = undefined;
        this.ready = false;
      }
      return false;
    }
  }

  /** At start: never awaited, never blocks the game. */
  start() {
    void this.#open();
  }

  /** «Activar sonido»: retries after a user gesture. */
  async enable(playing: boolean): Promise<boolean> {
    if (this.ready) return true;
    const ok = await this.#open();
    if (ok && playing) void this.#audio?.resume();
    return ok || this.#closed;
  }

  resume() {
    // Unlocking may stay pending until a gesture; never await it.
    void this.#audio?.resume().catch(() => {
      this.ready = false;
    });
  }

  pause() {
    this.#audio?.pause();
  }

  push(samples: Float32Array) {
    this.#audio?.push(samples);
  }

  toggleMute() {
    this.muted = !this.muted;
    this.#audio?.mute(this.muted);
  }

  close() {
    this.#closed = true;
    this.#audio?.close();
    this.#audio = undefined;
  }
}
