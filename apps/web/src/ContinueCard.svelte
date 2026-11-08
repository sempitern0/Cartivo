<script lang="ts">
  import SnapshotThumb from "./SnapshotThumb.svelte";
  import { when } from "./saves.ts";
  import { icons } from "./icons.ts";
  import { accentOf } from "./accent.ts";
  import { playLabel, type GameCard } from "./library-view.ts";
  import type { SystemInfo } from "../../../packages/runtime/src/systems.ts";
  // The most recently played remembered game: one click resumes it from its
  // «Al salir» snapshot (ADR-012). Compact, but the strongest contrast on the
  // start: its snapshot, name and a filled «Continuar» in the console accent.
  let {
    entry,
    system,
    oncontinue,
  }: {
    entry: GameCard;
    system: SystemInfo;
    oncontinue: () => void;
  } = $props();
</script>

<article
  class="continue card"
  style={`--accent: ${accentOf(system)}`}
  aria-labelledby="continue-title"
>
  <div class="thumb"><SnapshotThumb pixels={entry.preview} fill /></div>
  <div class="text">
    <h2 id="continue-title">{entry.name}</h2>
    <p class="meta">{system.name} · {when(entry.lastPlayedAt)}</p>
    {#if entry.stateUnavailable}<p class="meta">Guardado de otra versión</p>{/if}
  </div>
  <button
    class="icon-button resume"
    data-launch={`continue-${entry.hash}`}
    onclick={oncontinue}
    aria-describedby="continue-title"
    >{@html icons.play}<span>{playLabel(entry)}</span></button
  >
</article>

<style>
  .continue {
    display: grid;
    grid-template-columns: 112px minmax(0, 1fr) auto;
    gap: 18px;
    align-items: center;
    padding: 14px 16px 14px 14px;
    border-color: color-mix(in srgb, var(--accent) 45%, #2c3040);
    background:
      linear-gradient(
        100deg,
        color-mix(in srgb, var(--accent) 14%, transparent),
        transparent 60%
      ),
      linear-gradient(180deg, #1c1f2b, #161822);
  }
  .thumb {
    border-radius: 10px;
    overflow: hidden;
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 60%, transparent);
  }
  .text {
    min-width: 0;
  }
  h2 {
    margin: 0;
    font-size: 21px;
    line-height: 1.2;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .meta {
    margin: 4px 0 0;
    color: var(--muted);
    font-size: 14px;
  }
  .resume {
    border-color: transparent;
    background: var(--accent);
    color: #111218;
    font-weight: 700;
    padding: 10px 18px 10px 14px;
    border-radius: 999px;
  }
  .resume:hover {
    box-shadow: 0 8px 24px -8px var(--accent);
  }
  @media (max-width: 520px) {
    .continue {
      grid-template-columns: 88px minmax(0, 1fr);
    }
    .resume {
      grid-column: 1 / -1;
    }
  }
</style>
