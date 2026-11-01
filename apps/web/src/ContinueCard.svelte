<script lang="ts">
  import SnapshotThumb from "./SnapshotThumb.svelte";
  import { when } from "./saves.ts";
  import { icons } from "./icons.ts";
  import type { LibraryEntry } from "../../../packages/storage/src/library.ts";
  import type { SystemInfo } from "../../../packages/runtime/src/systems.ts";
  // The most recently played remembered game: one click resumes it from its
  // «Al salir» snapshot (ADR-012).
  let {
    entry,
    system,
    oncontinue,
  }: {
    entry: LibraryEntry;
    system: SystemInfo;
    oncontinue: () => void;
  } = $props();
</script>

<article class="continue card" aria-labelledby="continue-title">
  <div class="thumb"><SnapshotThumb pixels={entry.preview} fill /></div>
  <div class="text">
    <p class="kicker">Continuar</p>
    <h2 id="continue-title">{entry.name}</h2>
    <p class="meta">{system.name} · {when(entry.lastPlayedAt)}</p>
    <button
      class="primary icon-button"
      onclick={oncontinue}
      aria-describedby="continue-title"
      >{@html icons.play}<span>Continuar</span></button
    >
  </div>
</article>

<style>
  .continue {
    display: grid;
    grid-template-columns: minmax(120px, 200px) 1fr;
    gap: 24px;
    align-items: center;
    max-width: 720px;
    margin: 40px auto 0;
    padding: 20px;
    box-shadow: var(--glow);
  }
  .text {
    min-width: 0;
  }
  h2 {
    margin: 8px 0 0;
    font-size: 26px;
    overflow-wrap: anywhere;
  }
  .meta {
    margin: 6px 0 16px;
    color: var(--muted);
    font-size: 14px;
  }
  button {
    min-width: 180px;
    font-size: 17px;
  }
  @media (max-width: 520px) {
    .continue {
      grid-template-columns: 1fr;
      gap: 14px;
    }
    .thumb {
      max-width: 220px;
    }
    button {
      width: 100%;
    }
  }
</style>
