/** Bounded local diagnostics; request time includes messaging and Worker work. */
export class FrameMetrics {
  #samples: { end: number; duration: number; frames: number; start: number }[] =
    [];
  #previous = 0;

  reset(now: number) {
    this.#samples = [];
    this.#previous = now;
  }

  record(end: number, duration: number, frames: number) {
    if (
      !Number.isFinite(end) ||
      !Number.isFinite(duration) ||
      duration < 0 ||
      !Number.isInteger(frames) ||
      frames < 1 ||
      end <= this.#previous
    )
      return;
    this.#samples.push({ end, duration, frames, start: this.#previous });
    this.#previous = end;
    if (this.#samples.length > 120) this.#samples.shift();
  }

  snapshot() {
    const samples = this.#samples;
    const count = samples.length;
    const durations = samples
      .map((sample) => sample.duration)
      .sort((a, b) => a - b);
    const elapsed = count ? samples[count - 1].end - samples[0].start : 0;
    return {
      samples: count,
      fps:
        elapsed > 0
          ? (samples.reduce((sum, sample) => sum + sample.frames, 0) * 1000) /
            elapsed
          : 0,
      meanMs: count
        ? durations.reduce((sum, duration) => sum + duration, 0) / count
        : 0,
      p95Ms: count ? durations[Math.ceil(count * 0.95) - 1] : 0,
    };
  }
}
