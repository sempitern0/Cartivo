<!--
  The disc tray of a game on several discs (an .m3u, ADR-015), in the player's
  toolbar: «Disco N» opens a menu (Bits UI, ADR-019) with every disc as a
  radio item; the one in the tray is checked. Choosing another asks the player
  to swap it.
-->
<script lang="ts">
  import { DropdownMenu } from "bits-ui";
  import { fly } from "svelte/transition";
  import { icons } from "./icons.ts";
  import { motion } from "./motion.svelte.ts";
  import type { DiscTrayState } from "../../../packages/runtime/src/protocol.ts";

  let {
    discs,
    disabled = false,
    onchange,
  }: {
    discs: DiscTrayState;
    disabled?: boolean;
    onchange: (index: number) => void;
  } = $props();
</script>

<DropdownMenu.Root>
  <DropdownMenu.Trigger
    class="tool icon-button"
    {disabled}
    aria-label={`Disco ${discs.current + 1} de ${discs.names.length}: cambiar de disco`}
    >{@html icons.disc}<span>Disco {discs.current + 1}</span></DropdownMenu.Trigger
  >
  <DropdownMenu.Portal>
    <DropdownMenu.Content
      forceMount
      align="end"
      sideOffset={6}
      onEscapeKeydown={(e) => e.stopPropagation()}
    >
      {#snippet child({ wrapperProps, props, open })}
        {#if open}
          <div {...wrapperProps}>
            <div
              {...props}
              class="disc-menu"
              data-pad-scope
              transition:fly={{ y: -6, duration: motion.ms(160) }}
            >
              <!-- A radio group: assistive technology announces the disc in
                   the tray as checked. Controlled by the tray itself, so a
                   refused swap never shows the wrong disc. -->
              <DropdownMenu.RadioGroup
                aria-label="Disco en la bandeja"
                bind:value={
                  () => String(discs.current), (index) => onchange(Number(index))
                }
              >
                {#each discs.names as name, index (index)}
                  <DropdownMenu.RadioItem class="disc-item" value={String(index)}>
                    {#snippet children({ checked })}
                      <span class="check" aria-hidden="true"
                        >{#if checked}{@html icons.check}{/if}</span
                      ><span
                        ><strong>Disco {index + 1}</strong><small>{name}</small
                        ></span
                      >
                    {/snippet}
                  </DropdownMenu.RadioItem>
                {/each}
              </DropdownMenu.RadioGroup>
            </div>
          </div>
        {/if}
      {/snippet}
    </DropdownMenu.Content>
  </DropdownMenu.Portal>
</DropdownMenu.Root>

<style>
  :global(.disc-menu) {
    min-width: 240px;
    max-width: min(360px, calc(100vw - 32px));
    padding: 6px;
    border-radius: 14px;
    border: 1px solid var(--border);
    background: var(--surface);
    box-shadow: 0 18px 40px #0008;
  }
  :global(.disc-item) {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 48px;
    padding: 6px 12px;
    border-radius: 10px;
    cursor: pointer;
    outline: none;
  }
  :global(.disc-item[data-highlighted]) {
    background: var(--surface-2);
  }
  :global(.disc-item strong) {
    display: block;
    font-size: 14px;
  }
  :global(.disc-item small) {
    display: block;
    color: var(--muted);
    font-size: 12px;
    overflow-wrap: anywhere;
  }
  :global(.disc-item .check) {
    display: inline-flex;
    width: 20px;
    color: var(--teal);
  }
</style>
