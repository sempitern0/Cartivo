// Bounded mono queue: 250 ms at 48 kHz. No allocation in the render callback.
declare class AudioWorkletProcessor {
  port: MessagePort;
}
declare function registerProcessor(
  name: string,
  processor: typeof AudioWorkletProcessor,
): void;
class CartivoAudio extends AudioWorkletProcessor {
  private buffer = new Float32Array(12000);
  private read = 0;
  private write = 0;
  private count = 0;
  constructor() {
    super();
    this.port.onmessage = (event) => {
      if (event.data === "clear") {
        this.read = this.write = this.count = 0;
        return;
      }
      if (!(event.data instanceof Float32Array)) return;
      for (const sample of event.data) {
        if (this.count === this.buffer.length) {
          this.read = (this.read + 1) % this.buffer.length;
          this.count--;
        }
        this.buffer[this.write] = Number.isFinite(sample) ? sample : 0;
        this.write = (this.write + 1) % this.buffer.length;
        this.count++;
      }
    };
  }
  process(_inputs: Float32Array[][], outputs: Float32Array[][]) {
    const out = outputs[0]?.[0];
    if (out)
      for (let i = 0; i < out.length; i++) {
        out[i] = this.count ? this.buffer[this.read] : 0;
        if (this.count) {
          this.read = (this.read + 1) % this.buffer.length;
          this.count--;
        }
      }
    return true;
  }
}
registerProcessor("cartivo-audio", CartivoAudio);
export {};
