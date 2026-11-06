<script lang="ts">
  import { tick } from "svelte";
  import { profiles } from "./profile.svelte.ts";
  import {
    MAX_PROFILE_NAME,
    MAX_PROFILES,
    PRINCIPAL,
    type Profile,
  } from "../../../packages/storage/src/profiles.ts";
  // «¿Quién juega?» (ADR-016): shown on every visit. One main action, pick a
  // profile; creating, renaming and deleting live under «Gestionar».
  let { onchoose }: { onchoose: (profile: Profile) => void } = $props();
  let managing = $state(false);
  /** The form open: a new profile, or renaming one. */
  let editing = $state<{ profile?: Profile; name: string }>();
  let confirming = $state<string>();
  let note = $state("");
  let heading = $state.raw<HTMLHeadingElement>();
  let field = $state.raw<HTMLInputElement>();
  $effect(() => heading?.focus({ preventScroll: true }));

  const initial = (p: Profile) => [...p.name][0]?.toUpperCase() ?? "?";
  async function edit(profile?: Profile) {
    confirming = undefined;
    note = "";
    editing = { profile, name: profile?.name ?? "" };
    await tick();
    field?.focus();
  }
  function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!editing) return;
    try {
      if (editing.profile) {
        profiles.rename(editing.profile, editing.name);
        note = `Perfil renombrado: ${editing.name.trim()}.`;
      } else {
        const created = profiles.add(editing.name);
        note = `Perfil creado: ${created.name}.`;
      }
      editing = undefined;
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
    } catch {
      note = "No se pudo borrar el perfil. Inténtalo de nuevo.";
    }
  }
</script>

<section class="profiles-page" aria-labelledby="profiles-title">
  <div class="titles">
    <p class="kicker">Antes de jugar</p>
    <h1 id="profiles-title" bind:this={heading} tabindex="-1">¿Quién juega?</h1>
  </div>
  <ul class="profiles" aria-label="Perfiles">
    {#each profiles.all as profile (profile.id)}
      <li class="card">
        <button
          class="profile"
          style={`--color: var(--profile-${profile.color})`}
          onclick={() => onchoose(profile)}
          ><span class="avatar" aria-hidden="true">{initial(profile)}</span
          ><span class="name">{profile.name}</span></button
        >
        {#if managing}
          <div class="manage">
            {#if confirming === profile.id}
              <span class="hint">Se borran sus partidas, juegos y controles.</span>
              <button class="danger" onclick={() => remove(profile)}
                >Borrar {profile.name}</button
              ><button onclick={() => (confirming = undefined)}>Cancelar</button>
            {:else}
              <button
                aria-label={`Renombrar ${profile.name}`}
                onclick={() => edit(profile)}>Renombrar</button
              >
              {#if profile.id !== PRINCIPAL}<button
                  aria-label={`Borrar ${profile.name}`}
                  onclick={() => {
                    editing = undefined;
                    confirming = profile.id;
                  }}>Borrar</button
                >{/if}
            {/if}
          </div>
        {/if}
      </li>
    {/each}
  </ul>
  {#if editing}
    <form class="edit card" onsubmit={submit}>
      <label
        >{editing.profile ? `Nuevo nombre de ${editing.profile.name}` : "Nombre del perfil"}
        <input
          bind:this={field}
          bind:value={editing.name}
          maxlength={MAX_PROFILE_NAME}
          autocomplete="off"
          required
        /></label
      >
      <div class="row">
        <button class="primary" type="submit"
          >{editing.profile ? "Guardar" : "Crear perfil"}</button
        ><button type="button" onclick={() => (editing = undefined)}
          >Cancelar</button
        >
      </div>
    </form>
  {/if}
  <div class="actions">
    {#if profiles.all.length < MAX_PROFILES}<button
        class="link"
        onclick={() => edit()}>Nuevo perfil</button
      >{/if}
    <button
      class="link"
      aria-pressed={managing}
      onclick={() => {
        managing = !managing;
        confirming = undefined;
      }}>{managing ? "Listo" : "Gestionar perfiles"}</button
    >
  </div>
  {#if note}<p class="hint" role="status">{note}</p>{/if}
  <p class="hint">
    Cada perfil guarda sus partidas, sus juegos y sus controles en este
    dispositivo. Sin contraseña: elige el tuyo.
  </p>
</section>

<style>
  .profiles-page {
    display: grid;
    gap: 20px;
    max-width: 960px;
    margin: 0 auto;
  }
  .profiles {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 16px;
  }
  .profiles li {
    display: grid;
    gap: 10px;
    padding: 12px;
  }
  .profile {
    flex-direction: column;
    gap: 12px;
    padding: 20px 12px;
    background: transparent;
    border-color: transparent;
    width: 100%;
  }
  .profile:hover .avatar,
  .profile:focus-visible .avatar {
    box-shadow: var(--glow);
  }
  .avatar {
    display: grid;
    place-items: center;
    width: 88px;
    height: 88px;
    border-radius: 24px;
    background: var(--color);
    color: #111218;
    font-size: 40px;
    font-weight: 700;
  }
  .name {
    font-size: 18px;
    font-weight: 600;
    overflow-wrap: anywhere;
  }
  .manage,
  .row,
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
    align-items: center;
  }
  .manage .hint {
    flex-basis: 100%;
    text-align: center;
  }
  .link {
    background: transparent;
    border: 0;
    color: var(--blue);
  }
  .edit {
    display: grid;
    gap: 12px;
    padding: 16px;
  }
  .edit label {
    display: grid;
    gap: 8px;
  }
  .edit input {
    min-height: 44px;
    padding: 0 12px;
    border-radius: 12px;
    border: 1px solid var(--border);
    background: var(--surface-2);
    color: var(--text);
    font: inherit;
  }
  .danger {
    border-color: var(--coral);
    color: var(--coral);
  }
  .hint {
    margin: 0;
    text-align: center;
  }
</style>
