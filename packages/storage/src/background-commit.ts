// Periodic battery-RAM commits that never hold up the game (ADR-007): the
// write runs in the background while frames keep flowing, and its outcome is
// reported with a later frame. One write at a time; the operations that
// depend on it (pause, snapshots, reset, import) wait with settle().

export type CommitReport = { saved: boolean; saveError?: string };

export class BackgroundCommit {
  #commit: () => Promise<boolean>;
  #every: number;
  #last = 0;
  #pending: Promise<void> | undefined;
  #report: CommitReport | undefined;

  /**
   * `commit` must take its bytes synchronously when called (before its
   * first await), so the frames that follow cannot change what is written.
   */
  constructor(commit: () => Promise<boolean>, every = 120) {
    this.#commit = commit;
    this.#every = every;
  }

  /**
   * After each frame batch: starts a commit every `every` frames without
   * waiting for it, and returns the outcome of one that finished since the
   * previous call (once). A failed commit is retried on the next tick.
   */
  tick(frames: number): CommitReport {
    const report = this.#report ?? { saved: false };
    this.#report = undefined;
    if (!this.#pending && frames - this.#last >= this.#every) {
      const previous = this.#last;
      this.#last = frames;
      this.#pending = this.#commit().then(
        (saved) => {
          this.#report = { saved };
        },
        (e: unknown) => {
          this.#last = previous;
          this.#report = {
            saved: false,
            saveError: e instanceof Error ? e.message : "Guardado fallido",
          };
        },
      );
      void this.#pending.finally(() => (this.#pending = undefined));
    }
    return report;
  }

  /** Waits for the commit in flight, if any; its outcome stays for tick(). */
  async settle() {
    await this.#pending;
  }

  /** Counts from frame 0 again (a reset or an import restarted the core). */
  restart() {
    this.#last = 0;
  }
}
