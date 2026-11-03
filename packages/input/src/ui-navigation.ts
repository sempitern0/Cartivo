// Navigating Cartivo's own screens with a gamepad (ADR-006): what the pad
// asks for each frame, and which element lies in a direction. Pure: the UI
// owns focus and clicks, so this runs (and is tested) without a browser.
import type { Pad } from "./nes-input.ts";

export type Direction = "up" | "down" | "left" | "right";
export type Intent = Direction | "accept" | "back";

/** Standard-mapping buttons used by the menus. */
const A = 0;
const B = 1;
const DPAD: Record<Direction, number> = {
  up: 12,
  down: 13,
  left: 14,
  right: 15,
};

const STICK = 0.5;
/** Holding a direction repeats it, like a keyboard. */
const REPEAT_DELAY_MS = 400;
const REPEAT_EVERY_MS = 120;

const pressed = (pad: Pad, button: number) => !!pad.buttons[button]?.pressed;

function heldDirections(pad: Pad): Direction[] {
  const [x = 0, y = 0] = pad.axes;
  return (Object.keys(DPAD) as Direction[]).filter(
    (dir) =>
      pressed(pad, DPAD[dir]) ||
      (dir === "left" && x < -STICK) ||
      (dir === "right" && x > STICK) ||
      (dir === "up" && y < -STICK) ||
      (dir === "down" && y > STICK),
  );
}

/**
 * Turns one pad's state per frame into menu intents: a press fires once
 * (A and B never repeat while held); a held direction repeats after a
 * short delay. The pause gesture (Select+Start) belongs to the game, which
 * reads it through the player's own mapping.
 */
export class PadIntents {
  #buttons = new Set<string>();
  #direction: Direction | undefined;
  #nextRepeat = 0;

  read(pad: Pad | undefined, now: number): Intent[] {
    if (!pad) {
      this.reset();
      return [];
    }
    const out: Intent[] = [];
    const edge = (name: string, down: boolean) => {
      const was = this.#buttons.has(name);
      if (down) this.#buttons.add(name);
      else this.#buttons.delete(name);
      return down && !was;
    };
    if (edge("accept", pressed(pad, A))) out.push("accept");
    if (edge("back", pressed(pad, B))) out.push("back");

    const [held] = heldDirections(pad);
    if (held !== this.#direction) {
      this.#direction = held;
      if (held) {
        out.push(held);
        this.#nextRepeat = now + REPEAT_DELAY_MS;
      }
    } else if (held && now >= this.#nextRepeat) {
      out.push(held);
      this.#nextRepeat = now + REPEAT_EVERY_MS;
    }
    return out;
  }

  /** Forgets held buttons (focus moved elsewhere, pad lost or suspended). */
  reset() {
    this.#buttons.clear();
    this.#direction = undefined;
  }

  /**
   * Marks whatever is held now as already handled, so a button still down
   * when navigation resumes (B that closed a game, A that started one)
   * does not fire again.
   */
  absorb(pad: Pad | undefined, now: number) {
    this.reset();
    this.read(pad, now);
  }
}

export type Box = { x: number; y: number; width: number; height: number };

/**
 * Index of the candidate nearest to `from` in `dir` (by centre), or -1.
 * Distance along the direction counts once; sideways drift counts more,
 * so a row stays a row and a column stays a column. No wrap-around.
 */
export function nearest(from: Box, candidates: readonly Box[], dir: Direction) {
  const cx = from.x + from.width / 2;
  const cy = from.y + from.height / 2;
  let best = -1;
  let bestScore = Infinity;
  candidates.forEach((box, i) => {
    const dx = box.x + box.width / 2 - cx;
    const dy = box.y + box.height / 2 - cy;
    const along =
      dir === "left" ? -dx : dir === "right" ? dx : dir === "up" ? -dy : dy;
    const across =
      dir === "left" || dir === "right" ? Math.abs(dy) : Math.abs(dx);
    if (along <= 1) return;
    const score = along + across * 2;
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best;
}
