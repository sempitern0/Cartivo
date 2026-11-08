<!--
  Cartivo's progress bar: the brand gradient (teal → coral) on a dark track.
  With a value it fills to it; without one it sweeps (indeterminate). The
  label names it for assistive technology.
-->
<script lang="ts">
  let { value, label }: { value?: number; label: string } = $props();
  const percent = $derived(
    value === undefined ? undefined : Math.round(Math.min(1, Math.max(0, value)) * 100),
  );
</script>

<div
  class="progress"
  class:indeterminate={percent === undefined}
  role="progressbar"
  aria-label={label}
  aria-valuemin={percent === undefined ? undefined : 0}
  aria-valuemax={percent === undefined ? undefined : 100}
  aria-valuenow={percent}
>
  <span class="fill" style:width={percent === undefined ? undefined : `${percent}%`}
  ></span>
</div>

<style>
  .progress {
    position: relative;
    width: 100%;
    height: 6px;
    border-radius: 999px;
    background: #ffffff14;
    overflow: hidden;
  }
  .fill {
    position: absolute;
    inset: 0 auto 0 0;
    border-radius: inherit;
    background: linear-gradient(90deg, var(--teal), var(--blue) 55%, var(--coral));
    box-shadow: 0 0 12px color-mix(in srgb, var(--teal) 60%, transparent);
    transition: width 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  .indeterminate .fill {
    width: 40%;
    animation: sweep 1.3s cubic-bezier(0.45, 0, 0.55, 1) infinite;
  }
  @keyframes sweep {
    from {
      transform: translateX(-100%);
    }
    to {
      transform: translateX(250%);
    }
  }
</style>
