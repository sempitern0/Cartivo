// Steady audio from a core whose console runs on its own thread (PS2,
// ADR-022): its sound arrives in blocks of about 22 ms, not frame by frame,
// so some frames bring none and others two frames' worth. Played as it
// comes, the page's queue would run dry between blocks and click.

/** Samples held back before any are played: 60 ms at 48 kHz. */
const PREFILL = 2880;
/** Never more latency than this: older samples are dropped (200 ms). */
const MAX_QUEUED = 9600;

/**
 * A small queue between the core and the page: once it holds PREFILL
 * samples it hands out exactly one frame's worth per frame. If the core
 * falls behind and it runs dry, it fills again before playing (one gap
 * instead of a click per block).
 */
export class AudioPace {
  #perFrame: number;
  #queue = new Float32Array(MAX_QUEUED);
  #length = 0;
  #owed = 0;
  #playing = false;

  /** @param sampleRate of the core's output; @param frameRate of the game. */
  constructor(sampleRate: number, frameRate: number) {
    this.#perFrame = sampleRate / frameRate;
  }

  /** Adds what the core produced and returns what `frames` frames play. */
  step(produced: Float32Array, frames: number): Float32Array {
    // Keep the newest samples when more arrive than the queue holds.
    const fresh =
      produced.length > MAX_QUEUED
        ? produced.subarray(produced.length - MAX_QUEUED)
        : produced;
    const excess = this.#length + fresh.length - MAX_QUEUED;
    if (excess > 0) {
      this.#queue.copyWithin(0, excess, this.#length);
      this.#length -= excess;
    }
    this.#queue.set(fresh, this.#length);
    this.#length += fresh.length;
    if (!this.#playing && this.#length >= PREFILL) this.#playing = true;
    if (!this.#playing) return new Float32Array(0);
    this.#owed += frames * this.#perFrame;
    const count = Math.min(Math.floor(this.#owed), this.#length);
    this.#owed -= Math.floor(this.#owed);
    const out = this.#queue.slice(0, count);
    this.#queue.copyWithin(0, count, this.#length);
    this.#length -= count;
    if (!this.#length) this.#playing = false;
    return out;
  }
}
