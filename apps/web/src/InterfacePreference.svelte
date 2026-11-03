<script lang="ts">
  import { ui } from "./input-mode.svelte.ts";
  import type { UiPreference } from "../../../packages/input/src/ui-navigation.ts";
  // Ajustes: which interface Cartivo presents (ADR-006). Automatic by default.
  const options: { value: UiPreference; label: string; hint: string }[] = [
    {
      value: "auto",
      label: "Automática",
      hint: "Cambia sola al usar el mando o el teclado y el ratón.",
    },
    {
      value: "pointer",
      label: "Teclado y ratón",
      hint: "Siempre la interfaz de escritorio.",
    },
    {
      value: "pad",
      label: "Mando",
      hint: "Siempre el modo consola: menú de pausa y leyenda de botones.",
    },
  ];
  let note = $state("");
</script>

<fieldset class="interface card">
  <legend>Interfaz</legend>
  <div class="options">
    {#each options as option (option.value)}<label
        class="option"
        class:checked={ui.preference === option.value}
        ><input
          type="radio"
          name="ui-mode"
          value={option.value}
          checked={ui.preference === option.value}
          onchange={() => {
            note = ui.choose(option.value)
              ? ""
              : "El navegador no permite guardar esta preferencia: solo durará esta sesión.";
          }}
        /><span class="name">{option.label}</span><span class="hint"
          >{option.hint}</span
        ></label
      >{/each}
  </div>
  {#if note}<p class="note" role="status">{note}</p>{/if}
</fieldset>

<style>
  .interface {
    margin: 0 0 24px;
    padding: 18px 20px 20px;
  }
  legend {
    padding: 0 6px;
    font-weight: 650;
  }
  .options {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 12px;
    margin-top: 8px;
  }
  .option {
    position: relative;
    display: grid;
    gap: 4px;
    padding: 12px 14px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--surface-2);
    cursor: pointer;
  }
  .option.checked {
    border-color: var(--teal);
  }
  .option:has(input:focus-visible) {
    outline: 2px solid var(--focus);
    outline-offset: 3px;
  }
  input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }
  .name {
    font-weight: 600;
  }
  .option.checked .name {
    color: var(--teal);
  }
  .hint {
    color: var(--muted);
    font-size: 13px;
    line-height: 1.4;
  }
  .note {
    margin: 12px 0 0;
    color: var(--gold);
    font-size: 14px;
  }
</style>
