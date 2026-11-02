<script lang="ts">
  import { icons } from "./icons.ts";
  let { padStatus, padConnected }: { padStatus: string; padConnected: boolean } =
    $props();
</script>

<ul class="status" data-player-chrome aria-label="Dispositivos">
  <li data-testid="pad-status" class:on={padConnected}>
    {@html icons.gamepad}<span>{padStatus}</span>
  </li>
  <li data-testid="keyboard-status" class="on">
    {@html icons.keyboard}<span>Teclado conectado</span>
  </li>
</ul>

<style>
  .status {
    list-style: none;
    padding: 0;
    margin: 18px 0 6px;
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: 10px 0;
    color: var(--muted);
    font-size: 15px;
  }
  li {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 0 22px;
  }
  li + li {
    border-left: 1px solid var(--border);
  }
  li.on {
    color: var(--text);
  }
</style>
