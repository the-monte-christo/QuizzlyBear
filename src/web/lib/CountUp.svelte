<script lang="ts">
  import { untrack } from 'svelte';

  // Zählt eine Zahl weich auf den Zielwert hoch (oder herunter).
  let { value, from = value, duration = 900, delay = 0 }: { value: number; from?: number; duration?: number; delay?: number } =
    $props();

  let shown = $state(untrack(() => from));

  $effect(() => {
    const target = value;
    const start = untrack(() => shown); // nur der Zielwert soll die Animation neu starten
    if (start === target) return;
    let raf = 0;
    const t0 = performance.now() + delay;
    const step = (now: number) => {
      const p = Math.min(1, Math.max(0, (now - t0) / duration));
      const eased = 1 - Math.pow(1 - p, 3);
      shown = Math.round(start + (target - start) * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  });
</script>

<span class="n">{shown.toLocaleString('de-DE')}</span>

<style>
  .n {
    font-variant-numeric: tabular-nums;
  }
</style>
