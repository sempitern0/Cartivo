<script lang="ts">
  import { onDestroy } from "svelte";
  import { WorkerSession } from "../../../packages/runtime/src/worker-client.ts";
  import type { Command, State } from "../../../packages/runtime/src/session.ts";

  let session: WorkerSession | undefined;
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

<details>
  <summary>Laboratorio <span>Prueba de sesión</span></summary>
  <div class="lab">
    <h2>Diagnóstico sin emulación</h2>
    <p>Esta prueba ejecuta el control de sesión en segundo plano. No carga juegos ni guarda partidas.</p>
    <p role="status" aria-live="polite">{busy ? "Un momento…" : labels[sessionState]}</p>
    <div class="controls">
      <button onclick={() => send("start")} disabled={busy || sessionState !== "idle"}>Iniciar prueba</button>
      <button onclick={() => send(sessionState === "paused" ? "resume" : "pause")}
        disabled={busy || (sessionState !== "running" && sessionState !== "paused")}>
        {sessionState === "paused" ? "Reanudar" : "Pausar"}
      </button>
      <button onclick={() => send("stop")} disabled={busy || sessionState === "stopped"}>Finalizar</button>
      <button onclick={restart}>{busy ? "Cancelar" : "Nueva sesión"}</button>
    </div>
    {#if error}<p role="alert" class="error">{error}</p>{/if}
  </div>
</details>
<style>
  details { border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
  summary { padding: 22px 4px; cursor: pointer; color: var(--muted); min-height: 44px; }
  summary span { font-size: 12px; margin-left: 12px; }
  .lab { padding: 0 4px 28px; }
  .lab p { color: var(--muted); max-width: 580px; line-height: 1.6; }
  h2 { font-size: 20px; }
  .controls { display: flex; gap: 10px; flex-wrap: wrap; }
  .lab .error { color: var(--coral); }
</style>
