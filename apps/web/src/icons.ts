// Original line icons for the Cartivo shell (24×24, currentColor stroke).
// Rendered with {@html}; every icon is decorative and hidden from assistive
// technology, so the surrounding control must carry the accessible name.
const svg = (body: string) =>
  `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;

export const icons = {
  gear: svg(
    '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M4.2 7.5l2.1 1.2M17.7 15.3l2.1 1.2M4.2 16.5l2.1-1.2M17.7 8.7l2.1-1.2"/><circle cx="12" cy="12" r="7"/>',
  ),
  sliders: svg(
    '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  ),
  monitor: svg(
    '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  ),
  folder: svg(
    '<path d="M3 7.5A1.5 1.5 0 0 1 4.5 6H9l2 2h8.5A1.5 1.5 0 0 1 21 9.5v8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z"/>',
  ),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  back: svg('<path d="M19 12H5M11 6l-6 6 6 6"/>'),
  keyboard: svg(
    '<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M6 14h.01M18 14h.01M9 14h6"/>',
  ),
  gamepad: svg(
    '<path d="M7 8h10a4 4 0 0 1 3.9 4.9l-.8 3.4a2 2 0 0 1-3.4.9L14.6 15H9.4l-2.1 2.2a2 2 0 0 1-3.4-.9l-.8-3.4A4 4 0 0 1 7 8z"/><path d="M7.5 11v3M6 12.5h3M15.5 12h.01M17.5 13.5h.01"/>',
  ),
  play: svg('<path d="M8 5.5v13l10-6.5z" fill="currentColor"/>'),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
} as const;
