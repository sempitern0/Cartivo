// Turns animation-frame timestamps into emulated frames at the system's rate.
// The game never speeds up to catch up: after a stall (a slow first frame
// while the browser compiles WebAssembly, garbage collection, a busy device)
// the backlog is dropped and play continues. Only stalls that keep coming
// mean the device cannot hold the speed, and the player pauses.
// A demanding console (PS2) is paced in slow motion instead: it is never
// paused for being slow, and while it cannot keep up it runs one frame per
// step, so every frame is shown and requests stay short.

export type PacerStep = { frames: number } | { tooSlow: true };

export class FramePacer {
  #rate: number;
  #maxBacklog: number;
  #tooSlow: { stalls: number; windowMs: number };
  #time = 0;
  #remainder = 0;
  #stalls: number[] = [];
  #slowMotion: boolean;

  /**
   * @param frameRate emulated frames per second.
   * @param maxBacklog frames behind that count as a stall (12 ≈ 200 ms).
   * @param tooSlow stalls within `windowMs` that mean the device is too slow.
   * @param slowMotion never `tooSlow`: a slow game runs below its speed.
   */
  constructor(
    frameRate: number,
    maxBacklog = 12,
    tooSlow = { stalls: 3, windowMs: 5000 },
    slowMotion = false,
  ) {
    this.#slowMotion = slowMotion;
    this.#rate = frameRate / 1000;
    this.#maxBacklog = maxBacklog;
    this.#tooSlow = tooSlow;
  }

  /** Starts (or resumes) counting from `now`, with nothing owed. */
  start(now: number) {
    this.#time = now;
    this.#remainder = 0;
    this.#stalls = [];
  }

  /** Frames to emulate now (at most 3 per call), or `tooSlow`. */
  // In slow motion the owed frames beyond the batch are kept until the
  // backlog is dropped as a stall; they never speed the game up.
  step(now: number): PacerStep {
    this.#remainder += (now - this.#time) * this.#rate;
    this.#time = now;
    if (this.#remainder > this.#maxBacklog) {
      this.#remainder = 0;
      this.#stalls = this.#stalls.filter(
        (t) => now - t < this.#tooSlow.windowMs,
      );
      this.#stalls.push(now);
      if (!this.#slowMotion && this.#stalls.length >= this.#tooSlow.stalls)
        return { tooSlow: true };
      return { frames: 1 };
    }
    // Behind in slow motion: catching up in batches would only make each
    // request longer and the picture choppier.
    const behind =
      this.#slowMotion &&
      now - (this.#stalls.at(-1) ?? -Infinity) < this.#tooSlow.windowMs;
    const frames = Math.min(behind ? 1 : 3, Math.floor(this.#remainder));
    this.#remainder -= frames;
    return { frames };
  }
}
