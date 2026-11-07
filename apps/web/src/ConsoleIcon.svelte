<!--
  Original Cartivo console badge: the brand frame (teal → coral edge, soft
  sheen, «C» seal) around a generic hardware silhouette drawn for Cartivo.
  No third-party logos or trade dress (docs/DESIGN.md). Decorative: the card
  heading names the console.
-->
<script lang="ts">
  let { system }: { system: string } = $props();

  const handheld =
    '<rect x="13" y="5" width="22" height="38" rx="3.5"/><path d="M19 29.5v6.5M15.75 32.75h6.5"/><circle cx="28.5" cy="34" r="1.7" class="dot"/><circle cx="32" cy="30.5" r="1.7" class="dot"/>';
  const pad =
    '<rect x="5" y="15" width="38" height="18" rx="4"/><path d="M10.5 24h7M14 20.5v7"/><circle cx="31" cy="24" r="2.4" class="dot"/><circle cx="37.5" cy="24" r="2.4" class="dot"/>';
  /** Silhouettes on a 48×48 grid, white strokes (currentColor). */
  const glyphs: Record<string, string> = {
    nes: '<path d="M11 8h26v30a2.5 2.5 0 0 1-2.5 2.5h-21A2.5 2.5 0 0 1 11 38z"/><rect x="16.5" y="13.5" width="15" height="11" rx="1.5"/><path d="M16 31h16M16 35.5h16"/>',
    gb: `${handheld}<rect x="17" y="9.5" width="14" height="12.5" rx="1.2"/>`,
    gbc: `${handheld}<rect x="17" y="9.5" width="14" height="12.5" rx="1.2"/><path class="tint coral" d="M19 13h10"/><path class="tint teal" d="M19 16h10"/><path class="tint gold" d="M19 19h10"/>`,
    gba: '<rect x="3.5" y="13" width="41" height="22" rx="8"/><rect x="15" y="17" width="18" height="14" rx="1.5"/><path d="M7.5 24h6M10.5 21v6"/><circle cx="38" cy="22.25" r="1.7" class="dot"/><circle cx="34.75" cy="26" r="1.7" class="dot"/>',
    snes: '<path d="M14 16h20a8.5 8.5 0 0 1 0 17c-2.6 0-4.4-1.3-6-3.2h-8c-1.6 1.9-3.4 3.2-6 3.2a8.5 8.5 0 0 1 0-17z"/><path d="M10 24.5h7M13.5 21v7"/><circle cx="35" cy="20.75" r="1.6" class="dot"/><circle cx="38.75" cy="24.5" r="1.6" class="dot"/><circle cx="35" cy="28.25" r="1.6" class="dot"/><circle cx="31.25" cy="24.5" r="1.6" class="dot"/>',
    sms: pad,
    md: '<path d="M9 18.5c6.5-3.2 23.5-3.2 30 0 4.5 2.2 5.5 8.5 3.3 12.4-2 3.6-6 3.9-8.8 1.1H14.5c-2.8 2.8-6.8 2.5-8.8-1.1C3.5 27 4.5 20.7 9 18.5z"/><path d="M10.5 25h6.5M13.75 21.75v6.5"/><circle cx="29.5" cy="27" r="1.8" class="dot"/><circle cx="33.75" cy="25" r="1.8" class="dot"/><circle cx="38" cy="23" r="1.8" class="dot"/>',
    ps1: '<circle cx="24" cy="24" r="17"/><circle cx="24" cy="24" r="5"/><path class="sheen" d="M24 12a12 12 0 0 1 11 7.5M13.5 30a12 12 0 0 0 6 5"/>',
  };
</script>

<span class="badge" aria-hidden="true">
  <svg
    class="glyph"
    viewBox="0 0 48 48"
    fill="none"
    stroke="currentColor"
    stroke-width="2.4"
    stroke-linecap="round"
    stroke-linejoin="round"
    focusable="false">{@html glyphs[system] ?? pad}</svg
  >
  <svg class="seal" viewBox="0 0 24 24" fill="none" stroke-width="4" stroke-linecap="round" focusable="false"
    ><path d="M17 6.8A7.5 7.5 0 0 0 4.5 12" stroke="var(--teal)" /><path
      d="M4.5 12A7.5 7.5 0 0 0 17 17.2"
      stroke="var(--coral)"
    /></svg
  >
</span>

<style>
  .badge {
    position: relative;
    display: grid;
    place-items: center;
    width: 76px;
    aspect-ratio: 1;
    border-radius: 22px;
    border: 2px solid transparent;
    background:
      radial-gradient(120% 70% at 0% 0%, #40c2ae2e, transparent 60%) padding-box,
      radial-gradient(90% 60% at 100% 100%, #ed58712e, transparent 65%) padding-box,
      linear-gradient(160deg, #191c28, #10121a) padding-box,
      linear-gradient(135deg, var(--teal) 10%, #8a8fa5 50%, var(--coral) 90%)
        border-box;
    box-shadow:
      0 0 0 3px #0c0e14,
      0 10px 24px #0008;
    color: var(--text);
    overflow: hidden;
    transition:
      transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1),
      box-shadow 0.28s ease;
  }
  /* The diagonal sheen of the brand frame. */
  .badge::before {
    content: "";
    position: absolute;
    inset: -40% -10% auto -60%;
    height: 90%;
    border-radius: 50%;
    border-bottom: 1px solid #40c2ae40;
    transform: rotate(-24deg);
    pointer-events: none;
  }
  .glyph {
    width: 62%;
  }
  .glyph :global(.dot) {
    fill: currentColor;
    stroke: none;
  }
  .glyph :global(.tint) {
    stroke-width: 2.2;
  }
  .glyph :global(.coral) {
    stroke: var(--coral);
  }
  .glyph :global(.teal) {
    stroke: var(--teal);
  }
  .glyph :global(.gold) {
    stroke: var(--gold);
  }
  .glyph :global(.sheen) {
    stroke-width: 1.6;
    opacity: 0.55;
  }
  .seal {
    position: absolute;
    right: 6px;
    bottom: 6px;
    width: 15px;
  }
</style>
