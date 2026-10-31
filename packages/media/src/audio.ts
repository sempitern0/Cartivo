export class GameAudio {
  private context: AudioContext | undefined;
  private gain: GainNode | undefined;
  private worklet: AudioWorkletNode | undefined;
  async open(url: URL) {
    const context = new AudioContext({ sampleRate: 48000 });
    this.context = context;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        (async () => {
          await context.resume();
          await context.audioWorklet.addModule(url);
        })(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(Error("Audio no disponible")), 5000);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
    if (this.context !== context) {
      await context.close();
      throw Error("Audio cancelado");
    }
    this.worklet = new AudioWorkletNode(context, "cartivo-audio");
    this.gain = context.createGain();
    this.gain.gain.value = 0.3;
    this.worklet.connect(this.gain).connect(context.destination);
  }
  push(audio: Float32Array) {
    this.worklet?.port.postMessage(audio, [audio.buffer as ArrayBuffer]);
  }
  mute(value: boolean) {
    if (this.gain) this.gain.gain.value = value ? 0 : 0.3;
  }
  async resume() {
    await this.context?.resume();
  }
  pause() {
    this.worklet?.port.postMessage("clear");
    void this.context?.suspend().catch(() => {});
  }
  close() {
    const context = this.context;
    this.context = undefined;
    this.worklet?.disconnect();
    this.worklet?.port.close();
    this.gain?.disconnect();
    if (context) void context.close().catch(() => {});
  }
}
