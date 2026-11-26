<script lang="ts">
  // Antwortkarten auf dem Host-Screen (mcsa, mcma, poll). Bei der Auflösung:
  // richtige Karten mit Haken hervorgehoben, falsche abgedunkelt mit Kreuz, dazu die Stimmen.
  import Icon from '../../web/lib/Icon.svelte';
  import Shape from '../../web/lib/Shape.svelte';
  import type { HostProps } from '../ui';

  let { q, reveal, poll = false }: HostProps & { poll?: boolean } = $props();

  const options: string[] = $derived(q.data.options);
  const counts: number[] | null = $derived(reveal ? reveal.summary.counts : null);
  const correct: number[] = $derived(reveal && !poll ? reveal.solution.correct : []);
  const maxCount = $derived(counts ? Math.max(1, ...counts) : 1);
  const votes = $derived(counts ? counts.reduce((a, b) => a + b, 0) : 0);
  const longest = $derived(Math.max(...options.map((o) => o.length)));
  // Schriftgröße nach Textlänge und Anzahl, damit auch lange Antworten passen
  const size = $derived(longest > 70 ? 's' : longest > 36 || options.length > 4 ? 'm' : 'l');
</script>

<div class="grid size-{size}" class:revealed={!!reveal} class:single={!!q.image}>
  {#each options as text, i (i)}
    {@const right = correct.includes(i)}
    {@const state = !reveal || poll ? '' : right ? 'right' : 'wrong'}
    <div class="opt opt-{i} rise-in {state}" style="--tilt:{i % 2 ? 0.5 : -0.5}deg;animation-delay:{i * 90}ms">
      <span class="shape"><Shape index={i} /></span>
      <span class="text">{text}</span>
      {#if reveal && !poll}
        <span class="verdict pop-in" aria-label={right ? 'richtig' : 'falsch'}><Icon name={right ? 'check' : 'cross'} /></span>
      {/if}
      {#if counts}
        <span class="count pop-in">
          {#if poll}{votes ? Math.round((counts[i] / votes) * 100) : 0} %{:else}{counts[i]}{/if}
        </span>
        <span class="bar" style="--w:{counts[i] / maxCount}"></span>
      {/if}
    </div>
  {/each}
</div>

<style>
  .grid {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-auto-rows: minmax(0, 1fr);
    gap: 1.4rem 1.6rem;
  }
  .grid.single {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
  .opt {
    position: relative;
    display: flex;
    align-items: center;
    gap: 1.4rem;
    min-height: 0;
    padding: 0.6rem 1.8rem;
    border: 0.26rem solid var(--ink);
    border-radius: 1.8rem;
    background: var(--c);
    color: var(--c-ink);
    box-shadow: var(--drop-l);
    font-weight: 650;
    line-height: 1.12;
    overflow: hidden;
    transition:
      opacity 0.5s,
      filter 0.5s;
  }
  .size-l .opt { font-size: 3.2rem; }
  .size-m .opt { font-size: 2.5rem; }
  .size-s .opt { font-size: 1.9rem; }
  .shape {
    font-size: 1.5em;
    flex: none;
  }
  .text {
    flex: 1;
    min-width: 0;
  }

  /* Auflösung */
  .wrong {
    opacity: 0.6;
    filter: grayscale(0.85);
  }
  .right {
    animation: pulse 1.1s ease-in-out 3;
    outline: 0.5rem solid #fff;
    outline-offset: -0.9rem;
  }
  .verdict {
    flex: none;
    width: 1.5em;
    height: 1.5em;
    display: grid;
    place-items: center;
    border: 0.2rem solid var(--ink);
    border-radius: 50%;
    background: #fff;
    color: var(--ink);
    font-size: 0.9em;
  }
  .right .verdict {
    background: var(--ok);
    color: #fff;
  }
  .count {
    flex: none;
    min-width: 2.2em;
    padding: 0.1em 0.5em;
    border: 0.2rem solid var(--ink);
    border-radius: 99rem;
    background: #fff;
    color: var(--ink);
    text-align: center;
    font-size: 0.8em;
    font-variant-numeric: tabular-nums;
    animation-delay: 0.25s;
  }
  /* Stimmenanteil als Balken am unteren Kartenrand */
  .bar {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 0.9rem;
    background: rgba(255, 255, 255, 0.8);
    transform-origin: left center;
    transform: scaleX(var(--w));
    animation: grow 0.9s var(--ease-out) backwards 0.2s;
  }
  @keyframes grow {
    from { transform: scaleX(0); }
  }
</style>
