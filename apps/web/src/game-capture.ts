// While a game runs, the keyboard, focus, clicks and the wheel over the
// picture belong to it. Every control on the page (buttons, links, fields)
// keeps its native behaviour, so nothing needs a special mark to work;
// browser shortcuts with Ctrl/Meta/Alt are never blocked.
export type CaptureOptions = {
  playing(): boolean;
  screen(): HTMLCanvasElement | undefined;
  /** The game picture: the wheel is captured only over it. */
  picture(): HTMLElement | undefined;
  /** Player shortcuts (Focus, quick save, Escape); true when handled. */
  shortcut(event: KeyboardEvent): boolean;
  keyDown(code: string, repeat: boolean): void;
  keyUp(code: string): void;
};

const isControl = (target: EventTarget | null) =>
  target instanceof Element &&
  !!target.closest(
    "button, a, input, select, textarea, summary, [role=button]",
  );

/** Installs the listeners; returns the function that removes them. */
export function captureGameInput(o: CaptureOptions): () => void {
  const swallow = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const keydown = (e: KeyboardEvent) => {
    if (!o.playing()) return;
    if (o.shortcut(e)) return swallow(e);
    if (e.ctrlKey || e.metaKey || e.altKey || isControl(e.target)) return;
    swallow(e);
    o.keyDown(e.code, e.repeat);
  };
  const keyup = (e: KeyboardEvent) => o.keyUp(e.code);
  const focus = (e: FocusEvent) => {
    if (o.playing() && e.target !== o.screen() && !isControl(e.target))
      o.screen()?.focus({ preventScroll: true });
  };
  const pointer = (e: PointerEvent) => {
    if (!o.playing() || e.target === o.screen() || isControl(e.target)) return;
    // A click on empty space keeps the game captured.
    e.preventDefault();
    e.stopImmediatePropagation();
    o.screen()?.focus({ preventScroll: true });
  };
  const wheel = (e: WheelEvent) => {
    // Elsewhere the page scrolls, so the controls below stay reachable.
    if (
      o.playing() &&
      !e.ctrlKey &&
      e.target instanceof Node &&
      o.picture()?.contains(e.target)
    )
      e.preventDefault();
  };
  document.addEventListener("keydown", keydown, true);
  document.addEventListener("focusin", focus, true);
  document.addEventListener("pointerdown", pointer, true);
  document.addEventListener("wheel", wheel, { passive: false, capture: true });
  window.addEventListener("keyup", keyup);
  return () => {
    document.removeEventListener("keydown", keydown, true);
    document.removeEventListener("focusin", focus, true);
    document.removeEventListener("pointerdown", pointer, true);
    document.removeEventListener("wheel", wheel, true);
    window.removeEventListener("keyup", keyup);
  };
}
