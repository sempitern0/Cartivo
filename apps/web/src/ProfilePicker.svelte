<script lang="ts">
  import { onMount, tick } from "svelte";
  import { icons } from "./icons.ts";
  import { profiles } from "./profile.svelte.ts";
  import {
    initials,
    lastUsed,
    MAX_PROFILE_NAME,
    MAX_PROFILES,
    PRINCIPAL,
    PROFILE_COLORS,
    type Profile,
  } from "../../../packages/storage/src/profiles.ts";
  // «¿Quién juega?» (ADR-016): shown on every visit, starting on whoever
  // played last, so Enter or A plays at once. One main action, picking a
  // profile; adding is the last tile, editing and deleting live under
  // «Gestionar perfiles» and happen inside each tile.
  let { onchoose }: { onchoose: (profile: Profile) => void } = $props();

  let managing = $state(false);
  /** The tile showing a form: a profile being edited, or "new". */
  let editing = $state<string>();
  let draft = $state({ name: "", color: 0 });
  let confirming = $state<string>();
  let note = $state("");
  let grid = $state.raw<HTMLUListElement>();
  const NEW = "new";
  const colors = [...Array(PROFILE_COLORS).keys()];
  const colorNames = ["Azul", "Coral", "Turquesa", "Oro", "Lila", "Naranja"];

  /** Focus a control of a tile once it is drawn (`[data-tile=…]`). */
  async function focusTile(id: string, selector = "button, input") {
    await tick();
    grid
      ?.querySelector<HTMLElement>(`[data-tile="${id}"]`)
      ?.querySelector<HTMLElement>(selector)
      ?.focus({ preventScroll: false });
  }
  onMount(() => void focusTile(lastUsed(profiles.all).id, ".profile"));

  function edit(profile?: Profile) {
    confirming = undefined;
    note = "";
    editing = profile?.id ?? NEW;
    const used = new Set(profiles.all.map((p) => p.color));
    draft = profile
      ? { name: profile.name, color: profile.color }
      : { name: "", color: colors.find((c) => !used.has(c)) ?? 0 };
    void focusTile(editing, "input");
  }
  function cancel() {
    const back = editing === NEW ? NEW : editing;
    editing = undefined;
    if (back) void focusTile(back);
  }
  function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!editing) return;
    try {
      if (editing === NEW) {
        const created = profiles.add(draft.name, draft.color);
        note = `Perfil creado: ${created.name}.`;
        editing = undefined;
        void focusTile(created.id, ".profile");
      } else {
        const profile = profiles.all.find((p) => p.id === editing)!;
        profiles.update(profile, draft.name, draft.color);
        note = `Cambios guardados: ${draft.name.trim()}.`;
        editing = undefined;
        void focusTile(profile.id);
      }
    } catch (error) {
      note =
        error instanceof Error && !(error instanceof DOMException)
          ? error.message
          : "El navegador no permite guardar perfiles.";
    }
  }
  async function remove(profile: Profile) {
    confirming = undefined;
    try {
      await profiles.remove(profile);
      note = `${profile.name} y sus partidas se han borrado de este dispositivo.`;
      void focusTile(PRINCIPAL);
    } catch {
      note = "No se pudo borrar el perfil. Inténtalo de nuevo.";
    }
  }
  /** Escape (or B on a pad) backs out of a form or a confirmation first. */
  function onkeydown(event: KeyboardEvent) {
    if (event.key !== "Escape") return;
    if (editing) cancel();
    else if (confirming) {
      const id = confirming;
      confirming = undefined;
      void focusTile(id);
    } else if (managing) managing = false;
    else return;
    event.stopPropagation();
    event.preventDefault();
  }
</script>

{#snippet avatar(name: string, color: number, size: "lg" | "sm" = "lg")}
  <span
    class="avatar {size}"
    style={`--color: var(--profile-${color})`}
    aria-hidden="true">{initials(name) || "?"}</span
  >
{/snippet}

{#snippet form(title: string, submitLabel: string)}
  <form class="form" aria-label={title} onsubmit={submit}>
    {@render avatar(draft.name, draft.color)}
    <label class="field"
      ><span>Nombre</span><input
        bind:value={draft.name}
        maxlength={MAX_PROFILE_NAME}
        autocomplete="off"
        spellcheck="false"
        placeholder="Tu nombre"
        required
      /></label
    >
    <fieldset class="swatches">
      <legend>Color</legend>
      {#each colors as color (color)}
        <label class="swatch" style={`--color: var(--profile-${color})`}
          ><input
            type="radio"
            name="color"
            value={color}
            bind:group={draft.color}
            aria-label={colorNames[color]}
          /></label
        >
      {/each}
    </fieldset>
    <div class="form-actions">
      <button class="primary" type="submit">{submitLabel}</button>
      <button type="button" onclick={cancel}>Cancelar</button>
    </div>
  </form>
{/snippet}

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<section
  class="profiles-page"
  aria-labelledby="profiles-title"
  {onkeydown}
>
  <div class="intro">
    <p class="kicker">Cartivo</p>
    <h1 id="profiles-title">¿Quién juega?</h1>
    <p class="lede">
      Los juegos son compartidos. Cada perfil guarda sus partidas y sus controles en este
      dispositivo.
    </p>
  </div>

  <ul class="profiles" aria-label="Perfiles" bind:this={grid}>
    {#each profiles.all as profile, index (profile.id)}
      <li
        class="tile"
        style={`--i: ${index}`}
        data-tile={profile.id}
        class:managing
      >
        {#if editing === profile.id}
          {@render form(`Editar ${profile.name}`, "Guardar")}
        {:else if confirming === profile.id}
          <div class="confirm" role="group" aria-label={`Borrar ${profile.name}`}>
            {@render avatar(profile.name, profile.color)}
            <p>
              <strong>¿Borrar a {profile.name}?</strong>
              Se borran sus partidas y sus controles. Los juegos compartidos se conservan. No se puede deshacer.
            </p>
            <div class="form-actions">
              <button class="danger" onclick={() => remove(profile)}
                >Borrar {profile.name}</button
              >
              <button
                onclick={() => {
                  confirming = undefined;
                  void focusTile(profile.id);
                }}>Cancelar</button
              >
            </div>
          </div>
        {:else}
          <button
            class="profile"
            disabled={managing}
            onclick={() => onchoose(profile)}
            >{@render avatar(profile.name, profile.color)}<span class="name"
              >{profile.name}</span
            ></button
          >
          {#if managing}
            <div class="tools">
              <button
                class="icon-button square"
                aria-label={`Editar ${profile.name}`}
                title="Editar"
                onclick={() => edit(profile)}>{@html icons.pencil}</button
              >
              {#if profile.id !== PRINCIPAL}<button
                  class="icon-button square"
                  aria-label={`Borrar ${profile.name}`}
                  title="Borrar"
                  onclick={() => {
                    editing = undefined;
                    confirming = profile.id;
                    void focusTile(profile.id, ".danger");
                  }}>{@html icons.trash}</button
                >{/if}
            </div>
          {/if}
        {/if}
      </li>
    {/each}
    {#if profiles.all.length < MAX_PROFILES}
      <li class="tile" style={`--i: ${profiles.all.length}`} data-tile={NEW}>
        {#if editing === NEW}
          {@render form("Nuevo perfil", "Crear perfil")}
        {:else}
          <button class="profile add" onclick={() => edit()}
            ><span class="avatar lg add" aria-hidden="true"
              >{@html icons.plus}</span
            ><span class="name">Añadir perfil</span></button
          >
        {/if}
      </li>
    {/if}
  </ul>

  <div class="footer">
    <button
      class="manage"
      aria-pressed={managing}
      onclick={() => {
        managing = !managing;
        confirming = undefined;
        editing = undefined;
      }}
      >{@html managing ? icons.check : icons.pencil}<span
        >{managing ? "Listo" : "Gestionar perfiles"}</span
      ></button
    >
    <p class="status" role="status">{note}</p>
  </div>
</section>

<style>
  .profiles-page {
    display: grid;
    justify-items: center;
    gap: 32px;
    padding: clamp(8px, 4vh, 48px) 0;
  }
  .intro {
    display: grid;
    gap: 10px;
    text-align: center;
  }
  .intro h1 {
    margin: 0;
    font-size: clamp(32px, 5vw, 48px);
    letter-spacing: -0.02em;
  }
  .lede {
    margin: 0;
    color: var(--muted);
    max-width: 44ch;
  }
  .profiles {
    list-style: none;
    margin: 0;
    padding: 0;
    width: 100%;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 20px;
  }
  .tile {
    position: relative;
    width: 200px;
    display: grid;
    align-content: start;
  }
  .profile {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    width: 100%;
    padding: 20px 12px 18px;
    border-radius: var(--card-radius);
    background: transparent;
    border-color: transparent;
    transition:
      background 0.18s ease,
      transform 0.18s ease;
  }
  .profile:not(:disabled):hover,
  .profile:focus-visible {
    background: var(--surface);
    transform: translateY(-3px);
  }
  .profile:not(:disabled):hover .avatar,
  .profile:focus-visible .avatar {
    box-shadow:
      0 0 0 3px var(--bg),
      0 0 0 6px var(--color),
      0 12px 32px color-mix(in srgb, var(--color) 35%, transparent);
  }
  .profile:disabled {
    cursor: default;
    opacity: 1;
  }
  .avatar {
    display: grid;
    place-items: center;
    border-radius: 28%;
    background:
      radial-gradient(120% 120% at 20% 10%, #ffffff40, transparent 55%),
      var(--color);
    color: #111218;
    font-weight: 750;
    letter-spacing: 0.02em;
    transition:
      box-shadow 0.18s ease,
      transform 0.14s ease;
    user-select: none;
  }
  .avatar.lg {
    width: 112px;
    height: 112px;
    font-size: 40px;
  }
  .avatar.add {
    --color: var(--surface);
    background: transparent;
    border: 2px dashed var(--border);
    color: var(--muted);
  }
  .avatar.add :global(svg) {
    width: 40px;
    height: 40px;
  }
  .profile.add:hover .avatar.add,
  .profile.add:focus-visible .avatar.add {
    border-color: var(--blue);
    color: var(--text);
    box-shadow: none;
  }
  .name {
    font-size: 18px;
    font-weight: 600;
    max-width: 100%;
    overflow-wrap: anywhere;
    text-align: center;
  }
  .add .name {
    color: var(--muted);
  }
  .tools {
    position: absolute;
    top: 6px;
    right: 6px;
    display: flex;
    gap: 6px;
  }
  .tools button {
    min-width: 44px;
    padding: 0;
    background: color-mix(in srgb, var(--surface) 92%, transparent);
  }
  .managing .avatar {
    opacity: 0.6;
  }
  .form,
  .confirm {
    display: grid;
    justify-items: center;
    gap: 14px;
    padding: 18px 14px;
    border-radius: var(--card-radius);
    background: var(--surface);
    border: 1px solid var(--border);
  }
  .confirm p {
    margin: 0;
    text-align: center;
    color: var(--muted);
    font-size: 14px;
  }
  .confirm strong {
    display: block;
    color: var(--text);
    font-size: 16px;
    margin-bottom: 4px;
  }
  .field {
    display: grid;
    gap: 6px;
    width: 100%;
    font-size: 13px;
    color: var(--muted);
  }
  .field input {
    min-height: 44px;
    padding: 0 12px;
    border-radius: 12px;
    border: 1px solid var(--border);
    background: var(--surface-2);
    color: var(--text);
    font: inherit;
    font-size: 16px;
  }
  .field input:focus {
    outline: 2px solid var(--blue);
    outline-offset: 1px;
  }
  .swatches {
    border: 0;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
  }
  .swatches legend {
    width: 100%;
    margin-bottom: 6px;
    text-align: center;
    font-size: 13px;
    color: var(--muted);
  }
  .swatch {
    position: relative;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--color);
    cursor: pointer;
  }
  .swatch input {
    position: absolute;
    inset: 0;
    margin: 0;
    opacity: 0;
    cursor: pointer;
  }
  .swatch:has(input:checked) {
    box-shadow:
      0 0 0 3px var(--surface),
      0 0 0 5px var(--text);
  }
  .swatch:has(input:focus-visible) {
    outline: 2px solid var(--focus);
    outline-offset: 5px;
  }
  .form-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
  }
  .danger {
    border-color: var(--coral);
    color: var(--coral);
  }
  .footer {
    display: grid;
    justify-items: center;
    gap: 12px;
  }
  .manage {
    background: transparent;
    color: var(--muted);
  }
  .manage[aria-pressed="true"] {
    color: var(--text);
    border-color: var(--blue);
  }
  .status {
    margin: 0;
    min-height: 1.4em;
    color: var(--muted);
    text-align: center;
  }
  @media (max-width: 520px) {
    .tile {
      width: calc(50% - 10px);
    }
    .avatar.lg {
      width: 88px;
      height: 88px;
      font-size: 32px;
    }
  }
  /* Entrance: the intro, then the tiles one after another (theme.css turns
     it off under prefers-reduced-motion). */
  .intro {
    animation: tile-in 420ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
  }
  .tile {
    animation: tile-in 480ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
    animation-delay: calc(120ms + var(--i, 0) * 60ms);
  }
  .profile:not(:disabled):active .avatar {
    transform: scale(0.94);
  }
  @keyframes tile-in {
    from {
      opacity: 0;
      transform: translateY(18px) scale(0.96);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .profile,
    .avatar {
      transition: none;
    }
    .profile:not(:disabled):hover,
    .profile:focus-visible {
      transform: none;
    }
  }
</style>
