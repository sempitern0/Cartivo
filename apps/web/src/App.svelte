<script lang="ts">
  import { onDestroy, onMount, tick } from "svelte";
  import Player from "./Player.svelte";
  import ControlsPanel from "./ControlsPanel.svelte";
  import { WorkerSession } from "../../../packages/runtime/src/worker-client.ts";
  import type {
    Command,
    State,
  } from "../../../packages/runtime/src/session.ts";
  import "./theme.css";
  let session: WorkerSession | undefined;
  let controlsPage = $state(false);
  let game = $state<{ file?: File }>();
  let fileInput = $state.raw<HTMLInputElement>();
  function chooseGame(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (file) game = { file };
  }
  let pageHeading = $state.raw<HTMLHeadingElement>();
  onMount(() => {
    const sync = async () => {
      controlsPage = location.hash === "#controles";
      await tick();
      pageHeading?.focus({ preventScroll: true });
      window.scrollTo(0, 0);
    };
    void sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  });
  let sessionState = $state<State>("idle");
  let error = $state("");
  let busy = $state(false);
  let generation = 0;
  const labels: Record<State, string> = {
    idle: "Preparada",
    running: "En marcha",
    paused: "En pausa",
    stopped: "Finalizada",
  };
  function restart() {
    generation++;
    session?.dispose();
    session = undefined;
    sessionState = "idle";
    error = "";
    busy = false;
  }
  async function send(command: Command) {
    const token = generation;
    busy = true;
    error = "";
    try {
      session ??= new WorkerSession(
        new Worker(new URL("./diagnostic.worker.ts", import.meta.url), {
          type: "module",
        }),
        crypto.randomUUID(),
      );
      const next = await session.request(command);
      if (token === generation) sessionState = next;
    } catch (e) {
      if (token === generation)
        error = e instanceof Error ? e.message : "No se pudo continuar";
    } finally {
      if (token === generation) busy = false;
    }
  }
  onDestroy(() => {
    generation++;
    session?.dispose();
  });
</script>

<svelte:head
  ><meta
    name="description"
    content="Tu colección retro, sin complicaciones."
  /></svelte:head
>
<main>
  <header>
    <span class="brand"
      >cartivo<span class="palette" aria-hidden="true"
        ><i></i><i></i><i></i><i></i></span
      ></span
    >
    <nav aria-label="Principal">
      <a href="#controles" aria-current={controlsPage ? "page" : undefined}
        >Controles</a
      ><span class="phase">En desarrollo</span>
    </nav>
  </header>
  {#if controlsPage}
    <section class="controls-page">
      <a class="back" href="#inicio"
        >← {game ? "Volver al juego" : "Volver al inicio"}</a
      >
      <p class="eyebrow">A TU MANERA</p>
      <h1 bind:this={pageHeading} tabindex="-1">Controles</h1>
      <p class="intro">Prepara tu próxima partida.</p>
      <ControlsPanel />
    </section>
  {:else if !game}
    <section class="welcome">
      <p class="eyebrow">TUS JUEGOS. TU MOMENTO.</p>
      <h1 id="inicio" bind:this={pageHeading} tabindex="-1">Vuelve a jugar.</h1>
      <p class="intro">Elige un juego. Nosotros nos encargamos del resto.</p>
      <button class="primary" onclick={() => fileInput?.click()}
        >Elegir juego</button
      >
      <input
        bind:this={fileInput}
        type="file"
        accept=".nes"
        onchange={chooseGame}
        hidden
      />
      <p>
        <button
          onclick={() => {
            game = {};
          }}>Probar demo NES</button
        >
      </p>
      <p class="availability">
        NES experimental: cartuchos NROM NTSC. Prueba la demo sin aportar ningún
        juego.
      </p>
    </section>
    <details>
      <summary>Laboratorio <span>Prueba de sesión</span></summary>
      <div class="lab">
        <h2>Diagnóstico sin emulación</h2>
        <p>
          Esta prueba ejecuta el control de sesión en segundo plano. No carga
          juegos ni guarda partidas.
        </p>
        <p role="status" aria-live="polite">
          {busy ? "Un momento…" : labels[sessionState]}
        </p>
        <div class="controls">
          <button
            onclick={() => send("start")}
            disabled={busy || sessionState !== "idle"}>Iniciar prueba</button
          ><button
            onclick={() => send(sessionState === "paused" ? "resume" : "pause")}
            disabled={busy ||
              (sessionState !== "running" && sessionState !== "paused")}
            >{sessionState === "paused" ? "Reanudar" : "Pausar"}</button
          ><button
            onclick={() => send("stop")}
            disabled={busy || sessionState === "stopped"}>Finalizar</button
          ><button onclick={restart}
            >{busy ? "Cancelar" : "Nueva sesión"}</button
          >
        </div>
        {#if error}<p role="alert" class="error">{error}</p>{/if}
      </div>
    </details>
  {/if}
  {#if game}<div hidden={controlsPage}>
      <Player
        file={game.file}
        visible={!controlsPage}
        onclose={() => {
          game = undefined;
        }}
      />
    </div>{/if}
  <footer>Tu colección permanece en tu dispositivo.</footer>
</main>

<style>
  nav {
    display: flex;
    align-items: center;
    gap: 20px;
    flex-wrap: wrap;
  }
  nav a {
    padding: 10px 0;
    text-decoration: none;
  }
  nav a[aria-current="page"] {
    color: var(--teal);
  }
  a:focus-visible {
    outline: 3px solid var(--gold);
    outline-offset: 5px;
  }
  .controls-page {
    max-width: 720px;
    margin: 40px auto;
  }
  .controls-page h1 {
    font-size: 44px;
    letter-spacing: -2px;
  }
  .controls-page .intro {
    margin-bottom: 20px;
  }
  .back {
    display: inline-block;
    margin-bottom: 36px;
  }
  .controls-page :global(section) {
    margin-top: 0;
  }
  main {
    max-width: 960px;
    margin: auto;
    padding: 36px 28px;
  }
  header {
    flex-wrap: wrap;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 20px;
  }
  .brand {
    font-size: 28px;
    font-weight: 750;
    letter-spacing: -1px;
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .palette {
    display: flex;
    gap: 4px;
  }
  .palette i {
    width: 6px;
    height: 18px;
    border-radius: 3px;
    background: var(--coral);
  }
  .palette i:nth-child(2) {
    background: var(--blue);
  }
  .palette i:nth-child(3) {
    background: var(--teal);
  }
  .palette i:nth-child(4) {
    background: var(--gold);
  }
  .phase,
  footer {
    color: var(--muted);
    font-size: 13px;
  }
  .welcome {
    text-align: center;
    padding: 100px 0 90px;
  }
  .eyebrow {
    font-size: 11px;
    letter-spacing: 2px;
    color: var(--teal);
  }
  h1 {
    font-size: clamp(40px, 7vw, 70px);
    letter-spacing: -3px;
    margin: 20px 0;
  }
  .intro {
    color: var(--muted);
    font-size: 18px;
    line-height: 1.6;
    margin-bottom: 32px;
  }
  .availability {
    font-size: 13px;
    color: var(--muted);
    margin: 18px auto 0;
    max-width: 340px;
    line-height: 1.6;
  }
  details {
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
  }
  summary {
    padding: 22px 4px;
    cursor: pointer;
    color: var(--muted);
    min-height: 44px;
  }
  summary span {
    font-size: 12px;
    margin-left: 12px;
  }
  .lab {
    padding: 0 4px 28px;
  }
  .lab p {
    color: var(--muted);
    max-width: 580px;
    line-height: 1.6;
  }
  h2 {
    font-size: 20px;
  }
  .controls {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }
  .lab .error {
    color: var(--coral);
  }
  footer {
    text-align: center;
    padding: 30px 0;
  }
  @media (max-width: 500px) {
    main {
      padding: 24px 20px;
    }
    .welcome {
      padding: 72px 0;
    }
    h1 {
      letter-spacing: -2px;
    }
    .phase {
      max-width: 90px;
      text-align: right;
    }
  }
</style>
