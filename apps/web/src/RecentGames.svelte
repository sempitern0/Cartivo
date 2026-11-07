<script lang="ts">
  import ContinueCard from "./ContinueCard.svelte";
  import SnapshotThumb from "./SnapshotThumb.svelte";
  import { when } from "./saves.ts";
  import { icons } from "./icons.ts";
  import { accentOf } from "./accent.ts";
  import type { LibraryEntry } from "../../../packages/storage/src/library.ts";
  import {
    system as findSystem,
    type SystemInfo,
  } from "../../../packages/runtime/src/systems.ts";
  // Home screen (ADR-012): the three most recently played games in one band
  // above the consoles. The first is «Continuar»; every one resumes from its
  // «Al salir» snapshot. The band ends with the way into the whole library.
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
  <div class="band">
    <ContinueCard
      entry={first.entry}
      system={first.system}
      oncontinue={() => oncontinue(first.entry, first.system)}
    />
    <section class="recent" aria-label="Juegos recientes">
      {#if others.length}
        <ul>
          {#each others as { entry, system } (entry.hash)}
            <li style={`--accent: ${accentOf(system)}`}>
              <div class="thumb">
                <SnapshotThumb pixels={entry.preview} fill />
              </div>
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
      <!-- The library as a shelf of cartridges that fan out on hover, the
           count on the front label. -->
      <a class="shelf" href="#juegos" aria-label={`Ver todos tus juegos (${games.length})`}>
        <span class="carts" aria-hidden="true"
          ><i></i><i></i><i><b>{games.length}</b></i></span
        >
        <span class="shelf-text">Ver todos tus juegos</span>
      </a>
    </section>
  </div>
{/if}

<style>
  .band {
    display: grid;
    grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
    gap: 14px;
    margin: 32px 0 0;
    align-items: stretch;
  }
  .recent {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 14px;
    min-width: 0;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    align-content: center;
    gap: 6px;
    min-width: 0;
  }
  li {
    display: grid;
    grid-template-columns: 48px minmax(0, 1fr) auto;
    gap: 12px;
    align-items: center;
    padding: 6px 6px 6px 8px;
    border-radius: 12px;
    transition: background 0.2s ease;
  }
  li:hover,
  li:has(button:focus-visible) {
    background: #ffffff08;
  }
  .thumb {
    border-radius: 6px;
    overflow: hidden;
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 45%, transparent);
  }
  .info {
    display: grid;
    gap: 1px;
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
    border-radius: 50%;
    background: transparent;
  }
  li button:hover,
  li button:focus-visible {
    background: var(--accent);
    border-color: transparent;
    color: #111218;
  }
  /* «Ver todos tus juegos»: three cartridges on a shelf. */
  .shelf {
    display: grid;
    justify-items: center;
    align-content: center;
    gap: 10px;
    width: 128px;
    padding: 14px 10px 12px;
    border: 1px dashed #3a3f52;
    border-radius: var(--card-radius);
    color: var(--text);
    text-decoration: none;
    text-align: center;
    transition:
      border-color 0.2s ease,
      background 0.2s ease;
  }
  .shelf:hover,
  .shelf:focus-visible {
    border-color: var(--teal);
    border-style: solid;
    background: #40c2ae0f;
  }
  .carts {
    position: relative;
    width: 64px;
    height: 54px;
  }
  .carts i {
    position: absolute;
    bottom: 0;
    left: 14px;
    width: 36px;
    height: 46px;
    border-radius: 4px 4px 7px 7px;
    border: 2px solid #11131a;
    background: linear-gradient(180deg, #2a2e3d 0 30%, #232634 30%);
    transform-origin: 50% 100%;
    transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  /* A notch at the top, like a cartridge's grip. */
  .carts i::before {
    content: "";
    position: absolute;
    top: 3px;
    left: 6px;
    right: 6px;
    height: 3px;
    border-radius: 2px;
    background: #ffffff1a;
  }
  .carts i:nth-child(1) {
    transform: rotate(-12deg) translateX(-6px);
    background: linear-gradient(180deg, #2a2e3d 0 30%, var(--coral) 30%);
  }
  .carts i:nth-child(2) {
    transform: rotate(10deg) translateX(6px);
    background: linear-gradient(180deg, #2a2e3d 0 30%, var(--gold) 30%);
  }
  .carts i:nth-child(3) {
    background: linear-gradient(180deg, #2a2e3d 0 30%, var(--teal) 30%);
  }
  .carts b {
    position: absolute;
    inset: 16px 3px 4px;
    display: grid;
    place-items: center;
    border-radius: 3px;
    background: #11131acc;
    color: var(--text);
    font-size: 14px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }
  .shelf:hover .carts i:nth-child(1),
  .shelf:focus-visible .carts i:nth-child(1) {
    transform: rotate(-22deg) translateX(-12px);
  }
  .shelf:hover .carts i:nth-child(2),
  .shelf:focus-visible .carts i:nth-child(2) {
    transform: rotate(20deg) translateX(12px);
  }
  .shelf:hover .carts i:nth-child(3),
  .shelf:focus-visible .carts i:nth-child(3) {
    transform: translateY(-4px);
  }
  .shelf-text {
    font-size: 14px;
    font-weight: 650;
    line-height: 1.25;
  }
  @media (max-width: 900px) {
    .band {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  @media (max-width: 520px) {
    .recent {
      grid-template-columns: minmax(0, 1fr);
    }
    .shelf {
      width: auto;
      grid-template-columns: auto 1fr;
      justify-items: start;
      align-items: center;
      text-align: left;
      gap: 16px;
    }
  }
</style>
