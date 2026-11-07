<script lang="ts">
  import ContinueCard from "./ContinueCard.svelte";
  import SnapshotThumb from "./SnapshotThumb.svelte";
  import { when } from "./saves.ts";
  import { icons } from "./icons.ts";
  import type { LibraryEntry } from "../../../packages/storage/src/library.ts";
  import {
    system as findSystem,
    type SystemInfo,
  } from "../../../packages/runtime/src/systems.ts";
  // Home screen (ADR-012): the three most recently played games. The first
  // is the large «Continuar»; every one resumes from its «Al salir» snapshot.
  let {
    games,
    oncontinue,
  }: {
    /** Remembered games, most recent first. */
    games: LibraryEntry[];
    oncontinue: (entry: LibraryEntry, system: SystemInfo) => void;
  } = $props();
  const recent = $derived(
    games
      .flatMap((entry) => {
        const system = findSystem(entry.system);
        return system ? [{ entry, system }] : [];
      })
      .slice(0, 3),
  );
</script>

{#if recent.length}
  {@const [first, ...others] = recent}
  <ContinueCard
    entry={first.entry}
    system={first.system}
    oncontinue={() => oncontinue(first.entry, first.system)}
  />
  <section class="recent" aria-label="Juegos recientes">
    {#if others.length}
      <ul>
        {#each others as { entry, system } (entry.hash)}
          <li class="card">
            <div class="thumb"><SnapshotThumb pixels={entry.preview} fill /></div>
            <div class="info">
              <span class="name">{entry.name}</span>
              <span class="meta">{system.name} · {when(entry.lastPlayedAt)}</span>
            </div>
            <button
              class="icon-button"
              aria-label={`Continuar ${entry.name}`}
              data-launch={`continue-${entry.hash}`}
              onclick={() => oncontinue(entry, system)}
              >{@html icons.play}</button
            >
          </li>
        {/each}
      </ul>
    {/if}
    <a class="all" href="#juegos"
      >Ver todos tus juegos ({games.length})</a
    >
  </section>
{/if}

<style>
  .recent {
    max-width: 720px;
    margin: 12px auto 0;
    display: grid;
    gap: 12px;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 12px;
  }
  li {
    display: grid;
    grid-template-columns: 64px minmax(0, 1fr) auto;
    gap: 12px;
    align-items: center;
    padding: 10px 12px;
  }
  .info {
    display: grid;
    gap: 2px;
    min-width: 0;
  }
  .name {
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .meta {
    color: var(--muted);
    font-size: 13px;
  }
  li button {
    width: 44px;
    padding: 0;
  }
  .all {
    justify-self: end;
    padding: 10px 4px;
    font-weight: 600;
  }
</style>
