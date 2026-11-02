<script lang="ts">
  import SnapshotThumb from "./SnapshotThumb.svelte";
  import { when } from "./saves.ts";
  import type { StateMeta } from "../../../packages/storage/src/states.ts";
  // Over the video when a game reopens with an «Al salir» snapshot.
  let {
    offer,
    oncontinue,
    onrestart,
  }: {
    offer: StateMeta;
    oncontinue: () => void;
    onrestart: () => void;
  } = $props();
</script>

<div class="resume-offer" role="dialog" aria-labelledby="resume-title">
  <SnapshotThumb pixels={offer.preview} />
  <div>
    <h2 id="resume-title">Continuar donde lo dejaste</h2>
    <p>Guardada el {when(offer.createdAt)}</p>
    <div class="buttons">
      <button class="primary" onclick={oncontinue}>Continuar</button><button
        onclick={onrestart}>Empezar de nuevo</button
      >
    </div>
  </div>
</div>

<style>
  .resume-offer {
    position: absolute;
    inset: 0;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 22px;
    flex-wrap: wrap;
    padding: 20px;
    border-radius: 14px;
    background: #0a0c12e6;
  }
  h2 {
    margin: 0;
    font-size: 22px;
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
