// Display preferences of the running system (scale, aspect, smoothing),
// remembered per system on this device.
import {
  readDisplay,
  writeDisplay,
  type DisplayPreferences,
} from "../../../packages/media/src/display-preferences.ts";
import type {
  AspectMode,
  ScaleMode,
} from "../../../packages/media/src/display-scaler.ts";
import type { SystemInfo } from "../../../packages/runtime/src/systems.ts";

export class DisplaySettings {
  scale = $state<ScaleMode>("fit");
  aspect = $state<AspectMode>("corrected");
  smooth = $state(false);
  /** Says whether the last change will be remembered. */
  note = $state("");
  #system: SystemInfo;

  constructor(system: SystemInfo) {
    this.#system = system;
    const saved = readDisplay(system.id);
    this.scale = saved.scale;
    this.aspect = saved.aspect;
    this.smooth = saved.smooth;
  }

  set(patch: Partial<DisplayPreferences>) {
    const next = {
      scale: this.scale,
      aspect: this.aspect,
      smooth: this.smooth,
      ...patch,
    };
    this.scale = next.scale;
    this.aspect = next.aspect;
    this.smooth = next.smooth;
    this.note = writeDisplay(this.#system.id, next)
      ? `Se recordará para ${this.#system.name} en este dispositivo.`
      : "Aplicado solo en esta sesión: el navegador no permite guardarlo.";
  }
}
