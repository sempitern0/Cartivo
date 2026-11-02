<script lang="ts">
  import {
    backupFormat,
    MAX_BACKUP_FILE,
  } from "../../../packages/storage/src/formats.ts";
  import type { EmulatorClient } from "../../../packages/runtime/src/client.ts";
  import { downloadJson } from "./download.ts";
  // «Copias de partida»: export and import the cartridge's battery RAM as a
  // versioned JSON file with its checksum. Only for games with a battery.
  let {
    client,
    systemId,
    paused,
    busy = $bindable(),
    onstatus,
    onproblem,
    onimported,
  }: {
    client: EmulatorClient | undefined;
    systemId: string;
    /** Import needs a paused game; export also works after an error. */
    paused: boolean;
    busy: boolean;
    onstatus: (message: string) => void;
    onproblem: (message: string) => void;
    /** The game restarted with the imported battery RAM. */
    onimported: () => void;
  } = $props();
  let importInput = $state.raw<HTMLInputElement>();

  async function exportSave() {
    if (busy || !client) return;
    busy = true;
    try {
      const r = await client.request("save");
      if (!r.save) throw Error("No hay partida exportable");
      downloadJson("cartivo-partida.json", {
        format: backupFormat(systemId),
        game: r.hash,
        sha256: r.saveHash,
        bytes: Array.from(r.save),
      });
      onstatus("Copia exportada.");
    } catch (e) {
      onproblem(e instanceof Error ? e.message : "Exportación fallida");
    } finally {
      busy = false;
    }
  }

  async function importSave(e: Event) {
    const input = e.target as HTMLInputElement;
    const backup = input.files?.[0];
    input.value = "";
    if (!backup || !paused || busy || !client) return;
    busy = true;
    try {
      if (backup.size > MAX_BACKUP_FILE) throw Error("Copia demasiado grande");
      await client.request("import", {
        backup: JSON.parse(await backup.text()),
      });
      onimported();
    } catch (e) {
      onproblem(e instanceof Error ? e.message : "Importación fallida");
    } finally {
      busy = false;
    }
  }
</script>

<details data-player-chrome>
  <summary>Copias de partida</summary>
  <p>
    Importar reinicia el juego con la copia seleccionada. Se conserva una
    generación anterior del guardado local.
  </p>
  <div class="buttons">
    <button onclick={exportSave} disabled={busy}>Exportar partida</button
    ><button onclick={() => importInput?.click()} disabled={busy || !paused}
      >Importar partida</button
    >
  </div>
  <input
    bind:this={importInput}
    type="file"
    accept="application/json,.json"
    onchange={importSave}
    hidden
  />
</details>

<style>
  summary {
    cursor: pointer;
    padding: 12px 0;
  }
  p {
    line-height: 1.6;
  }
  .buttons {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    align-items: center;
  }
</style>
