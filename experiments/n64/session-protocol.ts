// Messages between the laboratory page and session.worker.ts.
export type SessionRequest =
  | { type: "start"; canvas: OffscreenCanvas; rom: Uint8Array; module: string }
  | {
      type: "input";
      /** RETRO_DEVICE_ID_JOYPAD_* bit order. */
      buttons: number;
      /** −32768…32767, y down (libretro). */
      lx: number;
      ly: number;
      rx: number;
      ry: number;
    }
  | { type: "status"; x: number; y: number }
  | { type: "stop" };

export type SessionEvent =
  | { type: "log"; text: string }
  | { type: "running"; fps: number }
  | {
      type: "status";
      frames: number;
      presented: number;
      pixel: number[];
      width: number;
      height: number;
    }
  | { type: "stopped" }
  | { type: "error"; message: string };
