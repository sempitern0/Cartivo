// Cartivo's own screens with a gamepad (ADR-006): the D-pad or left stick
// moves focus to the nearest control in that direction, A presses it and B
// acts as Escape (closes a panel) or, when nothing handles it, presses the
// screen's `[data-pad-back]` control. Whoever reads the pad for something
// else (a running game, the controls test) claims it meanwhile.
import {
  nearest,
  PadIntents,
  type Box,
  type Direction,
} from "../../../packages/input/src/ui-navigation.ts";
import type { Pad } from "../../../packages/input/src/nes-input.ts";

const FOCUSABLE =
  'button, a[href], summary, select, input:not([type="file"]):not([type="hidden"]), [tabindex="0"]';

const owners = new Set<string>();
const intents = new PadIntents();
let absorbNext = false;

/**
 * From a component: while `busy()` holds (and until the component goes),
 * the pad belongs to `owner` and does not move the menus. When it comes
 * back, buttons still held are ignored until released.
 */
export function claimPadWhile(owner: string, busy: () => boolean) {
  $effect(() => {
    if (!busy()) return;
    owners.add(owner);
    return () => {
      if (owners.delete(owner) && !owners.size) absorbNext = true;
    };
  });
}

/** The first connected pad with a known layout (A, B and D-pad positions). */
function standardPad(): Pad | undefined {
  try {
    for (const pad of navigator.getGamepads?.() ?? [])
      if (pad?.connected && pad.mapping === "standard") return pad;
  } catch {
    // Blocked by a permissions policy: the menus stay keyboard and pointer.
  }
  return undefined;
}

function usable(el: HTMLElement) {
  if (el.matches(":disabled") || el.closest("[inert],[hidden]")) return false;
  return el.checkVisibility
    ? el.checkVisibility({ visibilityProperty: true })
    : el.getClientRects().length > 0;
}

/** A radio or checkbox inside its label is reached (and drawn) as the label. */
const target = (el: Element) =>
  (el.matches("input") && el.closest("label")) || el;

function box(el: Element): Box {
  const r = target(el).getBoundingClientRect();
  return { x: r.x, y: r.y, width: r.width, height: r.height };
}

function candidates() {
  return Array.from(document.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    usable,
  );
}

function focus(el: HTMLElement) {
  el.focus({ preventScroll: true });
  target(el).scrollIntoView({ block: "nearest", inline: "nearest" });
}

/** Left/right change a slider or a select, like the arrow keys would. */
function adjust(el: Element, dir: Direction) {
  if (dir !== "left" && dir !== "right") return false;
  const forward = dir === "right";
  if (el instanceof HTMLInputElement && el.type === "range") {
    if (forward) el.stepUp();
    else el.stepDown();
  } else if (el instanceof HTMLSelectElement) {
    const next = el.selectedIndex + (forward ? 1 : -1);
    if (next < 0 || next >= el.options.length) return true;
    el.selectedIndex = next;
  } else return false;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

function move(dir: Direction) {
  const current = document.activeElement;
  if (current && adjust(current, dir)) return;
  const all = candidates();
  const from =
    current instanceof HTMLElement && current !== document.body
      ? current
      : undefined;
  if (!from) {
    // Nothing focused yet: start at the first control on screen.
    const first = all.find((el) => box(el).y + box(el).height > 0) ?? all[0];
    if (first) focus(first);
    return;
  }
  const others = all.filter((el) => el !== from);
  const index = nearest(box(from), others.map(box), dir);
  if (index >= 0) focus(others[index]);
}

function accept() {
  const current = document.activeElement;
  if (current instanceof HTMLElement && current !== document.body)
    current.click();
  else move("down");
}

function back() {
  const from =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : document.body;
  let unhandled = false;
  // Panels stop Escape where they handle it; reaching the window means no
  // one did.
  const reached = () => (unhandled = true);
  window.addEventListener("keydown", reached, { once: true });
  from.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Escape",
      code: "Escape",
      bubbles: true,
      cancelable: true,
    }),
  );
  window.removeEventListener("keydown", reached);
  if (unhandled)
    candidates()
      .find((el) => el.matches("[data-pad-back]"))
      ?.click();
}

/** Starts listening; returns the cleanup. Call once, from the app root. */
export function startPadNavigation() {
  const root = document.documentElement;
  let frame = 0;
  const loop = (now: number) => {
    frame = requestAnimationFrame(loop);
    if (owners.size) return;
    const pad = standardPad();
    if (absorbNext) {
      absorbNext = false;
      intents.absorb(pad, now);
      return;
    }
    const wanted = intents.read(pad, now);
    if (!wanted.length) return;
    root.dataset.input = "pad";
    for (const intent of wanted)
      if (intent === "accept") accept();
      else if (intent === "back") back();
      else move(intent);
  };
  // A pointer or a real key takes the pad's focus ring away again.
  const other = (event: Event) => {
    if (event.isTrusted) delete root.dataset.input;
  };
  frame = requestAnimationFrame(loop);
  window.addEventListener("pointerdown", other, true);
  window.addEventListener("keydown", other, true);
  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener("pointerdown", other, true);
    window.removeEventListener("keydown", other, true);
    delete root.dataset.input;
  };
}
