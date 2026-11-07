import type { SystemInfo } from "../../../packages/runtime/src/systems.ts";

/**
 * A console's accent says what it plays: home cartridges coral, handhelds
 * gold, discs violet (Cartivo's palette, never a maker's colours). Used by
 * the console cards and the games to continue.
 */
export const accentOf = (system: SystemInfo) =>
  system.disc
    ? "var(--profile-4)"
    : system.handheld
      ? "var(--gold)"
      : "var(--coral)";
