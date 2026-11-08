// The animation preference (motion.ts) as app state. The root carries
// `data-motion` for CSS (theme.css); Svelte transitions take their
// duration from `motion.ms()`.
import { parseMotion, reducesMotion, type MotionPreference } from "./motion.ts";

const KEY = "cartivo:motion:v1";

function stored(): MotionPreference {
  try {
    return parseMotion(localStorage.getItem(KEY));
  } catch {
    return "auto";
  }
}

class Motion {
  preference = $state<MotionPreference>(stored());
  /** The system asks to reduce motion (prefers-reduced-motion). */
  systemReduces = $state(false);
  reduced = $derived(reducesMotion(this.preference, this.systemReduces));

  constructor() {
    const query = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!query) return;
    this.systemReduces = query.matches;
    query.addEventListener?.("change", (e) => (this.systemReduces = e.matches));
  }

  /** A transition's duration: none when motion is reduced. */
  ms(duration: number) {
    return this.reduced ? 0 : duration;
  }

  /** Returns false when the browser does not let Cartivo keep the choice. */
  choose(preference: MotionPreference) {
    this.preference = preference;
    try {
      if (preference === "auto") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, preference);
      return true;
    } catch {
      return false;
    }
  }
}

export const motion = new Motion();
