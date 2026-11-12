<!--
  One console on the start screen (docs/DESIGN.md): the whole card plays
  (its «Jugar» button is the keyboard and pad target), shows every format,
  asks for a disc's missing tracks, and takes a dropped file for this
  console. The parent decides what playing and picking mean.
-->
<script lang="ts">
  import ConsoleIcon from "./ConsoleIcon.svelte";
  import { consoleLogo } from "./console-art.ts";
  import { accentOf } from "./accent.ts";
  import { hasFiles } from "./game-source.ts";
  import { icons } from "./icons.ts";
  import type { SystemInfo } from "../../../packages/runtime/src/systems.ts";

  let {
    system,
    dragging,
    waiting,
    missing,
    onplay,
    onpick,
    onpicktracks,
    oncanceltracks,
    ondropfiles,
  }: {
    system: SystemInfo;
    /** A file is being dragged over the page: every card invites it. */
    dragging: boolean;
    /** Name of a file opened from the OS that waits on this card. */
    waiting?: string;
    /** A .cue opened here without some of the tracks it names. */
    missing?: { file: string; tracks: string[] };
    /** «Jugar»: the waiting files, or the file picker. */
    onplay: () => void;
    /** «Elegir otro juego» instead of the waiting one. */
    onpick: () => void;
    onpicktracks: () => void;
    oncanceltracks: () => void;
    ondropfiles: (files: File[]) => void;
  } = $props();

  /** With a logo, the logo is the card; the name stays for screen readers. */
  const logo = $derived(consoleLogo(system.id));
  /** A dragged file is over this very card. */
  let over = $state(false);

  function dragOver(e: DragEvent) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    over = true;
  }
  function dragLeave(e: DragEvent) {
    const card = e.currentTarget as HTMLElement;
    if (!card.contains(e.relatedTarget as Node | null)) over = false;
  }
  function drop(e: DragEvent) {
    if (!hasFiles(e)) return;
    // Handled: the page's own drop handler sees defaultPrevented and only
    // ends its drag state.
    e.preventDefault();
    over = false;
    const files = Array.from(e.dataTransfer?.files ?? []);
    if (files.length) ondropfiles(files);
  }
  function click(e: MouseEvent) {
    if (!(e.target as Element).closest("button, a")) onplay();
  }
  /**
   * The whole card takes a click and a dropped file for pointer users; the
   * keyboard and the pad use its «Jugar» button, so the card itself stays a
   * plain article (no interactive role to announce twice).
   */
  function pointerTarget(card: HTMLElement) {
    const events = [
      ["dragover", dragOver],
      ["dragleave", dragLeave],
      ["drop", drop],
      ["click", click],
    ] as const;
    for (const [type, listener] of events)
      card.addEventListener(type, listener as EventListener);
    return {
      destroy() {
        for (const [type, listener] of events)
          card.removeEventListener(type, listener as EventListener);
      },
    };
  }
</script>

<article
  class="console-card"
  class:card={!logo}
  class:cover={!!logo}
  class:dragging
  class:over
  class:waiting
  style:--accent={accentOf(system)}
  aria-labelledby={`console-${system.id}`}
  use:pointerTarget
>
  {#if logo}
    <img class="cover-art" src={logo} alt="" draggable="false" decoding="async" />
    {#if system.experimental}<span class="corner-tag" aria-hidden="true"
        >Experimental</span
      >{/if}
  {:else}
    <ConsoleIcon system={system.id} />
  {/if}
  <div class="console-text" class:visually-hidden={!!logo}>
    <h2 id={`console-${system.id}`}>{system.name}</h2>
    <p>
      {system.longName}{#if system.experimental}<span class="tag"
          >Experimental</span
        >{/if}
    </p>
  </div>
  {#if missing}
    <div class="tracks" role="alert">
      <p>
        <strong>Faltan archivos de «{missing.file}»</strong>
        {missing.tracks.join(", ")}. Elígelos para jugar.
      </p>
      <div class="tracks-actions">
        <button class="primary" onclick={onpicktracks}>Elegir archivos</button
        ><button class="link" onclick={oncanceltracks}>Cancelar</button>
      </div>
    </div>
  {/if}
  <div class="console-foot">
    <span class="formats"
      ><span class="visually-hidden">Formatos:</span
      >{#each system.extensions as extension}<span class="format"
          >{extension}</span
        >{/each}</span
    >
    {#if waiting}
      <button class="link other" onclick={onpick}>Elegir otro juego</button>
    {/if}
    <button class="play" data-launch={`play-${system.id}`} onclick={onplay}
      ><span class="play-label">{waiting ? `Jugar ${waiting}` : "Jugar"}</span
      ><span class="play-icon">{@html icons.play}</span></button
    >
  </div>
  <span class="drop-cue" aria-hidden="true"
    >{@html icons.play}Suelta para jugar</span
  >
</article>

<style>
  .console-card {
    position: relative;
    min-width: 0;
    grid-row: 1 / -1;
    padding: 20px 20px 18px;
    display: grid;
    grid-template-rows: subgrid;
    row-gap: 16px;
    box-shadow: 0 0 0 1px #2c3040;
    cursor: pointer;
    transition:
      transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1),
      box-shadow 0.25s ease,
      border-color 0.25s ease;
  }
  /* Hover, keyboard or pad focus: the card lifts, its badge turns and its
     play button lights up in the card's accent. */
  .console-card:hover,
  .console-card:has(.play:focus-visible),
  :global(:root[data-input="pad"]) .console-card:has(.play:focus) {
    transform: translateY(-4px);
    border-color: color-mix(in srgb, var(--accent) 55%, transparent);
    box-shadow:
      0 0 0 1px color-mix(in srgb, var(--accent) 35%, transparent),
      0 18px 40px -18px color-mix(in srgb, var(--accent) 45%, transparent);
  }
  .console-card:hover :global(.badge),
  .console-card:has(.play:focus-visible) :global(.badge) {
    transform: rotate(-4deg) scale(1.05);
  }
  .console-card:active:not(:has(.tracks:active, .other:active)) {
    transform: translateY(-1px) scale(0.985);
  }
  .console-card > :global(.badge) {
    justify-self: start;
  }
  /* The logo is the card (docs/DESIGN.md): a square that fills with its
     image, which zooms in slightly on hover. The formats and the play
     button sit on a dark band at the foot, so they read over any logo. */
  .console-card.cover {
    aspect-ratio: 1;
    align-self: start;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    padding: 9%;
    border-radius: 21%;
    overflow: hidden;
    isolation: isolate;
    background: #0b0c12;
    box-shadow: 0 14px 30px -14px #000c;
  }
  .cover-art {
    position: absolute;
    inset: 0;
    z-index: -2;
    width: 100%;
    height: 100%;
    object-fit: cover;
    user-select: none;
    transition: transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  .console-card.cover::after {
    content: "";
    position: absolute;
    inset: 55% 0 0;
    z-index: -1;
    background: linear-gradient(to bottom, transparent, #07080ccc 70%);
    pointer-events: none;
  }
  .console-card.cover:hover .cover-art,
  .console-card.cover:has(.play:focus-visible) .cover-art {
    transform: scale(1.05);
  }
  .console-card.cover:hover,
  .console-card.cover:has(.play:focus-visible),
  :global(:root[data-input="pad"]) .console-card.cover:has(.play:focus) {
    box-shadow:
      0 0 0 2px color-mix(in srgb, var(--accent) 70%, transparent),
      0 22px 44px -18px color-mix(in srgb, var(--accent) 60%, transparent);
  }
  .console-card.cover.dragging {
    outline: 2px dashed color-mix(in srgb, var(--accent) 60%, transparent);
    outline-offset: 4px;
  }
  /* Solid at rest: it sits over the logo's «C» seal. */
  .cover .play-icon {
    background: #0b0d14f0;
    border-color: #ffffff2e;
  }
  .cover .format {
    background: #0b0d14b3;
    border-color: #ffffff26;
    color: var(--text);
  }
  .corner-tag {
    position: absolute;
    top: 9%;
    right: 9%;
    padding: 3px 10px;
    border-radius: 999px;
    background: #0b0d14cc;
    border: 1px solid color-mix(in srgb, var(--accent) 60%, transparent);
    color: var(--text);
    font-size: 12px;
    font-weight: 650;
  }
  .cover .tracks {
    position: absolute;
    inset: 0;
    z-index: 1;
    align-content: center;
    padding: 9%;
    border: 0;
    border-radius: 0;
    background: #12141cf2;
    overflow: auto;
  }
  .cover .other {
    padding: 4px 10px;
    border-radius: 999px;
    background: #0b0d14cc;
  }
  .cover.waiting .play-label {
    text-shadow: 0 1px 3px #000;
  }
  .console-text {
    min-width: 0;
  }
  .console-text h2 {
    margin: 0;
    font-size: 30px;
    font-weight: 800;
    letter-spacing: -0.04em;
    line-height: 1.05;
    text-wrap: balance;
  }
  .console-text > p {
    margin: 6px 0 0;
    color: var(--muted);
    font-size: 14px;
    line-height: 1.35;
  }
  /* A playable system whose limits its compatibility sheet lists. */
  .tag {
    margin-left: 8px;
    padding: 1px 8px;
    border-radius: 999px;
    border: 1px solid color-mix(in srgb, var(--accent) 55%, transparent);
    color: var(--text);
    font-size: 12px;
    font-weight: 600;
    vertical-align: 1px;
  }
  .console-foot {
    display: flex;
    align-items: flex-end;
    gap: 10px;
    min-width: 0;
  }
  /* Every format the console opens, wrapping when there are several. */
  .formats {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    min-width: 0;
    margin-right: auto;
    padding-bottom: 8px;
  }
  .waiting .formats {
    display: none;
  }
  .format {
    padding: 3px 8px;
    border-radius: 999px;
    background: #ffffff0d;
    border: 1px solid #ffffff14;
    color: var(--muted);
    font-size: 13px;
  }
  /* «Jugar»: a round play button. Its name stays for assistive technology;
     only a waiting file shows its label («Jugar juego.nes»). */
  .play {
    display: inline-flex;
    align-items: center;
    flex: none;
    max-width: 100%;
    min-height: 44px;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--text);
    font-weight: 650;
  }
  .play:not(:disabled):active {
    transform: none;
  }
  .play:focus-visible {
    outline: none;
  }
  .console-card:has(.play:focus-visible) {
    outline: 2px solid var(--focus);
    outline-offset: 3px;
  }
  .play-label {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
  .waiting .play {
    flex: 0 1 auto;
    min-width: 0;
  }
  .waiting .play-label {
    position: static;
    width: auto;
    height: auto;
    clip: auto;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-right: 10px;
  }
  .play-icon {
    display: grid;
    place-items: center;
    flex: none;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    border: 1px solid #ffffff1f;
    background: #ffffff0a;
    transition:
      background 0.25s ease,
      color 0.25s ease,
      border-color 0.25s ease,
      box-shadow 0.25s ease,
      transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  .console-card:hover .play-icon,
  .play:focus-visible .play-icon,
  :global(:root[data-input="pad"]) .play:focus .play-icon,
  .waiting .play-icon {
    background: var(--accent);
    border-color: transparent;
    color: #0d1016;
    box-shadow: 0 6px 20px -6px var(--accent);
    transform: scale(1.06);
  }
  .console-card:active .play-icon {
    transform: scale(0.94);
  }
  .other,
  .tracks {
    cursor: auto;
  }
  /* A file dragged over the page: every card invites it; the card under the
     pointer takes it. */
  .console-card.dragging {
    border-style: dashed;
    border-color: color-mix(in srgb, var(--accent) 45%, transparent);
  }
  .console-card.over {
    border-color: var(--accent);
    box-shadow:
      0 0 0 2px var(--accent),
      0 20px 50px -18px color-mix(in srgb, var(--accent) 60%, transparent);
    transform: translateY(-4px) scale(1.01);
  }
  .drop-cue {
    position: absolute;
    inset: 0;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    border-radius: inherit;
    background: #12141cdb;
    backdrop-filter: blur(3px);
    color: var(--accent);
    font-weight: 700;
    font-size: 17px;
    opacity: 0;
    transform: scale(0.96);
    pointer-events: none;
    transition:
      opacity 0.18s ease,
      transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  .over .drop-cue {
    opacity: 1;
    transform: none;
  }
  .tracks {
    display: grid;
    gap: 10px;
    padding: 12px 14px;
    border-radius: 12px;
    border: 1px solid color-mix(in srgb, var(--gold) 55%, transparent);
    background: color-mix(in srgb, var(--gold) 10%, transparent);
  }
  .tracks p {
    margin: 0;
    font-size: 14px;
    color: var(--muted);
    overflow-wrap: anywhere;
  }
  .tracks strong {
    display: block;
    color: var(--text);
  }
  .tracks-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
  }
  .link {
    background: transparent;
    border: 0;
    padding: 6px 0;
    min-height: 32px;
    color: var(--blue);
    font-size: 14px;
  }
</style>
