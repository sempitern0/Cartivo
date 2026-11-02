<script lang="ts">
  import type { SystemInfo } from "../../../packages/runtime/src/systems.ts";
  /** Public files live under the app's base (the root or a sub-path). */
  const asset = (path: string) => `${import.meta.env.BASE_URL}${path}`;
  // «Acerca de esta prueba»: core choice for the next game and licences.
  let {
    system,
    choice,
    running,
    onchoose,
  }: {
    system: SystemInfo;
    choice: string;
    running?: string;
    onchoose: (id: string) => void;
  } = $props();
</script>

<details data-player-chrome>
  <summary>Acerca de esta prueba</summary>
  <fieldset class="core-choice">
    <legend>Núcleo {system.name}</legend>
    {#each system.cores as option (option.id)}<label
        ><input
          type="radio"
          name="core"
          value={option.id}
          checked={choice === option.id}
          onchange={() => onchoose(option.id)}
        />
        {option.label}{#if running === option.id}<span class="secondary"
            >{" · en uso"}</span
          >{/if}</label
      >{/each}
    {#if running && choice !== running}<p
        class="secondary"
        data-testid="core-pending"
      >
        Se usará al abrir el próximo juego o con Cargar ROM.
      </p>{/if}
  </fieldset>
  <p class="secondary">
    Los núcleos se ejecutan en un Worker y comparten la memoria de batería del
    cartucho.
    {#each system.cores.flatMap((c) => c.licenses) as license (license.href)}<a
        href={asset(license.href)}
        target="_blank"
        rel="noreferrer">{license.name}</a
      >
      ·
    {/each}<a href={asset("licenses/NOTICE.txt")} target="_blank" rel="noreferrer"
      >Avisos de terceros</a
    >
  </p>
</details>

<style>
  summary {
    cursor: pointer;
    padding: 12px 0;
  }
  p {
    line-height: 1.6;
  }
  .secondary {
    font-size: 12px;
    color: var(--muted);
  }
  .core-choice {
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 12px 16px;
    display: grid;
    gap: 8px;
  }
  legend {
    font-size: 13px;
    color: var(--muted);
  }
  label {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 32px;
  }
</style>
