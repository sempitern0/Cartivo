<!--
  «Botones de cada consola» in Controles: consoles with their own button
  names and where each one is (Cruz on B), then the buttons only a minority
  of consoles use (buttonGuide in systems.ts). Shown next to the key chips,
  never inside them, so reassigning stays the first thing in that row.
-->
<script lang="ts">
  import { icons } from "./icons.ts";
  import { buttonGuide } from "../../../packages/runtime/src/systems.ts";
  import type { Action } from "../../../packages/input/src/nes-input.ts";

  let { labels }: { labels: Record<Action, string> } = $props();
  const guide = $derived(buttonGuide((action) => labels[action]));
</script>

<section class="guide card" aria-labelledby="guide-title">
  <h3 id="guide-title">
    <span class="device-icon" aria-hidden="true">{@html icons.gamepad}</span
    >Botones de cada consola
  </h3>
  <ul class="guide-consoles">
    {#each guide.consoles as item (item.name)}<li>
        <span class="guide-name">{item.name}</span>
        <ul class="pairs" aria-label={`Botones de ${item.name}`}>
          {#each item.pairs as pair (pair.own)}<li>
              <span class="own">{pair.own}</span><span class="visually-hidden"
                >{" en "}</span
              ><kbd>{pair.key}</kbd>
            </li>{/each}
        </ul>
      </li>{/each}
  </ul>
  {#each guide.minority as note}<p class="hint">{note}</p>{/each}
</section>

<style>
  .device-icon {
    display: inline-flex;
    padding: 6px 8px;
    border-radius: 12px;
    background: #232737;
    color: var(--text);
  }
  .guide {
    margin-top: 20px;
    padding: 18px 20px;
  }
  .guide h3 {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0 0 12px;
    font-size: 16px;
  }
  .guide-consoles {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 10px;
  }
  .guide-consoles > li {
    display: grid;
    grid-template-columns: 130px 1fr;
    align-items: start;
    gap: 12px;
  }
  .guide-name {
    font-weight: 650;
    padding-top: 5px;
  }
  .pairs {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .pairs li {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 6px 4px 10px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: var(--surface-2);
    font-size: 14px;
  }
  .pairs kbd::before {
    content: "→ ";
    color: var(--muted);
  }
  .pairs kbd {
    font: inherit;
    font-weight: 650;
    padding: 2px 8px;
    border-radius: 999px;
    border: 1px solid #3f4457;
    background: #2a2e3d;
    color: var(--teal);
  }
  .guide .hint {
    font-size: 14px;
    color: var(--muted);
  }
  @media (max-width: 640px) {
    .guide-consoles > li {
      grid-template-columns: 1fr;
      gap: 6px;
    }
  }
</style>
