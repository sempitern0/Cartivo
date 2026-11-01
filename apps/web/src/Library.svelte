<script lang="ts">
  import SnapshotThumb from "./SnapshotThumb.svelte";
  import { when } from "./saves.ts";
  import {
    forgetGame,
    readRemember,
    writeRemember,
    type LibraryEntry,
  } from "../../../packages/storage/src/library.ts";
  import {
    system as findSystem,
    type SystemInfo,
  } from "../../../packages/runtime/src/systems.ts";
  // «Tus juegos» (ADR-012): remembered games, the one-time choice and the
  // space they use. Removing a game never touches its Partidas or SRAM.
  let {
    games,
    onplay,
    onchange,
  }: {
    games: LibraryEntry[];
    onplay: (entry: LibraryEntry, system: SystemInfo) => void;
    /** The list changed on disk; the parent reloads it. */
    onchange: () => void;
  } = $props();
  let remember = $state(readRemember() === true);
  let note = $state("");
  let confirming = $state<string>();
  let usage = $state("");
  const megabytes = (bytes: number) =>
    `${(bytes / (1024 * 1024)).toLocaleString("es", { maximumFractionDigits: 1 })} MB`;
  $effect(() => {
    const own = games.reduce((sum, g) => sum + g.size, 0);
    usage = `Ocupan ${megabytes(own)}.`;
    void navigator.storage
      ?.estimate?.()
      .then(({ usage: used, quota }) => {
        if (used !== undefined && quota)
          usage = `Ocupan ${megabytes(own)}. Cartivo usa ${megabytes(used)} de ${megabytes(quota)} disponibles en este navegador.`;
      })
      .catch(() => {});
  });
  function toggle(event: Event) {
    remember = (event.target as HTMLInputElement).checked;
    note = writeRemember(remember)
      ? remember
        ? "Los juegos que abras se recordarán en este dispositivo."
        : "Los juegos nuevos no se recordarán. Los de la lista siguen aquí."
      : "El navegador no permite guardar esta preferencia.";
  }
  async function remove(entry: LibraryEntry) {
    confirming = undefined;
    try {
      await forgetGame(entry.hash);
      note = `${entry.name} ya no está en la lista. Sus partidas se conservan.`;
    } catch {
      note = "No se pudo quitar el juego. Inténtalo de nuevo.";
    }
    onchange();
  }
</script>

<section class="library" aria-labelledby="library-title">
  <h2 id="library-title">Tus juegos</h2>
  {#if games.length}
    <ul>
      {#each games as entry (entry.hash)}
        {@const system = findSystem(entry.system)}
        <li data-game={entry.hash}>
          <div class="thumb"><SnapshotThumb pixels={entry.preview} fill /></div>
          <div class="info">
            <span class="name">{entry.name}</span>
            <span class="hint"
              >{system?.name ?? entry.system} · {when(entry.lastPlayedAt)}</span
            >
          </div>
          <div class="actions">
            {#if confirming === entry.hash}
              <span class="hint">Sus partidas se conservan.</span>
              <button class="danger" onclick={() => remove(entry)}
                >Quitar {entry.name}</button
              ><button onclick={() => (confirming = undefined)}>Cancelar</button>
            {:else}
              <button
                disabled={!system}
                aria-label={`Jugar ${entry.name}`}
                onclick={() => system && onplay(entry, system)}>Jugar</button
              ><button
                aria-label={`Quitar ${entry.name} de la lista`}
                onclick={() => (confirming = entry.hash)}>Quitar</button
              >
            {/if}
          </div>
        </li>
      {/each}
    </ul>
    <p class="hint">{usage}</p>
  {:else}
    <p class="hint">
      Aún no hay juegos recordados. Al abrir uno podrás guardarlo aquí para
      continuar con un clic.
    </p>
  {/if}
  <label class="toggle"
    ><input type="checkbox" checked={remember} onchange={toggle} />
    Recordar juegos nuevos en este dispositivo</label
  >
  <p class="hint">
    Se guarda una copia del archivo solo en este navegador; nunca se envía a
    ningún sitio. El navegador puede borrarla si se queda sin espacio.
  </p>
  {#if note}<p class="note" role="status">{note}</p>{/if}
</section>

<style>
  .library {
    max-width: 720px;
    margin: 56px auto 0;
  }
  h2 {
    margin: 0 0 14px;
    font-size: 22px;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 10px;
  }
  li {
    display: grid;
    grid-template-columns: 64px 1fr auto;
    gap: 14px;
    align-items: center;
    padding: 10px 12px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--surface-2);
  }
  .info {
    min-width: 0;
    display: grid;
    gap: 2px;
  }
  .name {
    font-weight: 650;
    overflow-wrap: anywhere;
  }
  .hint {
    font-size: 13px;
    color: var(--muted);
    line-height: 1.4;
  }
  .actions {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
    justify-content: flex-end;
  }
  .actions button {
    min-height: 40px;
    padding: 8px 14px;
    font-size: 14px;
  }
  .danger {
    border-color: var(--coral);
    color: var(--coral);
  }
  .toggle {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 44px;
    margin-top: 16px;
  }
  .toggle input {
    width: 20px;
    height: 20px;
  }
  .note {
    color: var(--teal);
    font-size: 14px;
  }
  @media (max-width: 520px) {
    li {
      grid-template-columns: 56px 1fr;
    }
    .actions {
      grid-column: 1 / -1;
      justify-content: flex-start;
    }
  }
</style>
