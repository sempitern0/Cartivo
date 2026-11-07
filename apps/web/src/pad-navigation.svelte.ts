// Cartivo's own screens with a gamepad (ADR-006): the D-pad or left stick
// moves focus to the nearest control in that direction, A presses it and B
// acts as Escape (closes a panel) or, when nothing handles it, presses the
// screen's `[data-pad-back]` control. Whoever reads the pad for something
// else (a running game, the controls test) claims it meanwhile.
import {
  nearest,
  PadIntents,
  PadActivity,
  type Box,
  type Direction,
} from "../../../packages/input/src/ui-navigation.ts";
import type { Pad } from "../../../packages/input/src/nes-input.ts";
import { ui } from "./input-mode.svelte.ts";

const FOCUSABLE =
  'button, a[href], summary, select, input:not([type="file"]):not([type="hidden"]), [tabindex="0"]';

/** Who reads the pad now, and whether using it may switch the interface. */
const owners = new Map<string, { switchesInterface: boolean }>();
const intents = new PadIntents();
let absorbNext = false;

/**
 * From a component: while `busy()` holds (and until the component goes),
 * the pad belongs to `owner` and does not move the menus. When it comes
 * back, buttons still held are ignored until released. Playing with it
 * still switches the automatic interface to «Mando»; configuring it (the
 * controls test) passes `switchesInterface: false`, so the screen being
 * set up does not change under the player.
 */
export function claimPadWhile(
  owner: string,
  busy: () => boolean,
  { switchesInterface = true } = {},
) {
  $effect(() => {
    if (!busy()) return;
    owners.set(owner, { switchesInterface });
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

/**
 * Controls on screen; inside an open modal (the pause menu), only its own,
 * and while a game is open, only the player's (`[data-pad-scope]`), so the
 * pad never wanders to the page around it.
 */
function candidates() {
  const scope =
    document.querySelector("dialog:modal") ??
    Array.from(document.querySelectorAll<HTMLElement>("[data-pad-scope]")).find(
      usable,
    ) ??
    document;
  return Array.from(scope.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
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

/** The focused element, if it is one of `all` (on screen, in the dialog). */
function focusedIn(all: HTMLElement[]) {
  const current = document.activeElement;
  return current instanceof HTMLElement && all.includes(current)
    ? current
    : undefined;
}

function move(dir: Direction) {
  const all = candidates();
  const from = focusedIn(all);
  if (from && adjust(from, dir)) return;
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
  const current = focusedIn(candidates());
  if (current) current.click();
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
  let frame = 0;
  const activity = new PadActivity();
  const loop = (now: number) => {
    frame = requestAnimationFrame(loop);
    const pad = standardPad();
    const used = activity.read(pad);
    if (used && [...owners.values()].every((o) => o.switchesInterface))
      ui.lastDevice = "pad";
    // Without a pad, the automatic interface goes back to keyboard and mouse.
    if (!pad && ui.lastDevice === "pad") ui.lastDevice = "pointer";
    if (owners.size) return;
    if (absorbNext) {
      absorbNext = false;
      intents.absorb(pad, now);
      return;
    }
    const wanted = intents.read(pad, now);
    if (!wanted.length) return;
    for (const intent of wanted)
      if (intent === "accept") accept();
      else if (intent === "back") back();
      else move(intent);
  };
  // A pointer or a real key hands the interface back to them.
  const other = (event: Event) => {
    if (event.isTrusted) ui.lastDevice = "pointer";
  };
  frame = requestAnimationFrame(loop);
  window.addEventListener("pointerdown", other, true);
  window.addEventListener("keydown", other, true);
  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener("pointerdown", other, true);
    window.removeEventListener("keydown", other, true);
  };
}
