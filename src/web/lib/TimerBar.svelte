<script lang="ts">
  // Restzeit als „Honigbalken“. Der Balken läuft als reine CSS-Animation (transform),
  // nur die Sekundenzahl wird ein paarmal pro Sekunde aktualisiert.
  import Icon from './Icon.svelte';

  let {
    deadline,
    total,
    frozen = false,
  }: {
    /** Zeitpunkt (performance.now()), an dem die Zeit abläuft. */
    deadline: number;
    /** Gesamtzeit in ms. */
    total: number;
    /** Angehalten (gesperrt): Balken bleibt stehen. */
    frozen?: boolean;
  } = $props();

  let now = $state(performance.now());
  $effect(() => {
    if (frozen) return;
    now = performance.now();
    const t = setInterval(() => (now = performance.now()), 200);
    return () => clearInterval(t);
  });

  const left = $derived(Math.max(0, deadline - now));
  const seconds = $derived(Math.ceil(left / 1000));
  const urgent = $derived(seconds <= 5 && !frozen);
  // Startwerte der Animation nur beim (Neu-)Start festlegen
  const start = $derived.by(() => {
    void deadline;
    const remaining = Math.max(0, deadline - performance.now());
    return { from: Math.min(1, remaining / total), dur: remaining };
  });
</script>

<div class="timer" class:urgent class:frozen role="timer" aria-label="Restzeit {seconds} Sekunden">
  <div class="num" class:pulse={urgent}>
    <Icon name="clock" /><span>{seconds}</span>
  </div>
  <div class="track">
    {#key deadline}
      <div class="fill" style="--from:{start.from};animation-duration:{start.dur}ms"></div>
    {/key}
  </div>
</div>

<style>
  .timer {
    display: flex;
    align-items: center;
    gap: 0.7em;
    width: 100%;
  }
  .num {
    display: flex;
    align-items: center;
    gap: 0.3em;
    min-width: 3.4em;
    justify-content: center;
    padding: 0.15em 0.6em;
    border: var(--line) solid var(--ink);
    border-radius: 99rem;
    background: var(--paper);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .track {
    flex: 1;
    height: 0.9em;
    border: var(--line) solid var(--ink);
    border-radius: 99rem;
    background: var(--paper);
    overflow: hidden;
  }
  .fill {
    height: 100%;
    background: var(--a2);
    transform-origin: left center;
    animation: drain linear both;
    will-change: transform;
  }
  .urgent .fill {
    background: var(--a1);
  }
  .urgent .num {
    background: var(--a1);
    color: #fff;
  }
  .frozen .fill {
    animation-play-state: paused;
  }
</style>
