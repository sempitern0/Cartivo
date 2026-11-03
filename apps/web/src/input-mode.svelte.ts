// Which interface Cartivo presents (ADR-006): «Teclado y ratón» or «Mando»
// (modo consola). Automatic by default: it follows the last device used.
// Only presentation changes; the pad navigates the menus in both.
import {
  parseUiPreference,
  resolveUiMode,
  type UiMode,
  type UiPreference,
} from "../../../packages/input/src/ui-navigation.ts";

const KEY = "cartivo:ui:mode:v1";

function stored(): UiPreference {
  try {
    return parseUiPreference(localStorage.getItem(KEY));
  } catch {
    return "auto";
  }
}

class Interface {
  preference = $state<UiPreference>(stored());
  /** The device used last: drives the focus ring and the automatic mode. */
  lastDevice = $state<UiMode>("pointer");
  current = $derived(resolveUiMode(this.preference, this.lastDevice));

  /** Returns false when the browser does not let Cartivo keep the choice. */
  choose(preference: UiPreference) {
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

export const ui = new Interface();
