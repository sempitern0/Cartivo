// Console logos for the start screen cards (ADR-005, revisión 2026-11-08:
// third-party art for private use; provenance in LICENSES.md). One WebP per
// system id in assets/consoles; a system without one keeps the drawn badge.
const files = import.meta.glob<string>("./assets/consoles/*.webp", {
  eager: true,
  query: "?url",
  import: "default",
});

/** The logo's URL for a system id, if there is one. */
export function consoleLogo(system: string): string | undefined {
  return files[`./assets/consoles/${system}.webp`];
}

