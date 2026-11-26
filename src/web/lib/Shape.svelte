<script lang="ts">
  // Festes Symbol je Antwortoption: Farbe allein trägt nie die Bedeutung.
  // 0 Stern · 1 Kreis · 2 Dreieck · 3 Quadrat · 4 Raute · 5 Sechseck
  let { index, label = false }: { index: number; label?: boolean } = $props();

  const NAMES = ['Stern', 'Kreis', 'Dreieck', 'Quadrat', 'Raute', 'Sechseck'];
  const i = $derived(((index % 6) + 6) % 6);
</script>

<svg class="shape" viewBox="0 0 24 24" role={label ? 'img' : undefined} aria-label={label ? NAMES[i] : undefined} aria-hidden={label ? undefined : 'true'}>
  {#if i === 0}
    <path d="M12 1.8l2.9 6.5 7.1.7-5.3 4.8 1.5 7-6.2-3.6-6.2 3.6 1.5-7L2 9l7.1-.7z" />
  {:else if i === 1}
    <circle cx="12" cy="12" r="9.6" />
  {:else if i === 2}
    <path d="M12 2.6L22.2 20.6H1.8z" />
  {:else if i === 3}
    <rect x="3" y="3" width="18" height="18" rx="2.6" />
  {:else if i === 4}
    <path d="M12 1.4L22.4 12 12 22.6 1.6 12z" />
  {:else}
    <path d="M12 1.8l8.9 5.1v10.2L12 22.2l-8.9-5.1V6.9z" />
  {/if}
</svg>

<style>
  .shape {
    display: block;
    width: 1em;
    height: 1em;
    flex: none;
    fill: currentColor;
    stroke: currentColor;
    stroke-width: 1.4;
    stroke-linejoin: round;
  }
</style>
