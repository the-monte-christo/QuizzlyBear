<script lang="ts">
  // Zahlenstrahl auf dem Host für estimate und interval. Bei der Auflösung erscheinen alle
  // Antworten der Runde (Punkte bzw. halbtransparente Balken) und die Lösung als Fahne.
  import Icon from '../../web/lib/Icon.svelte';
  import type { HostProps } from '../ui';
  import { formatNumber, type ScalePublic } from './scale';

  let { q, reveal, mode }: HostProps & { mode: 'estimate' | 'interval' } = $props();
  const p = $derived(q.data as ScalePublic);
  const pct = (v: number) => ((v - p.min) / (p.max - p.min)) * 100;
  const fmt = (v: number) => formatNumber(v, p.step);
  const correct = $derived(reveal ? (reveal.solution.correct as number) : null);
  const ticks = $derived([0, 0.25, 0.5, 0.75, 1].map((f) => p.min + (p.max - p.min) * f));

  // Schätzungen: gleiche Stellen stapeln sich nach oben
  const dots = $derived.by(() => {
    if (!reveal || mode !== 'estimate') return [];
    const stacks = new Map<number, number>();
    return (reveal.summary.values as number[]).map((v) => {
      const slot = Math.round(pct(v) / 1.7);
      const level = stacks.get(slot) ?? 0;
      stacks.set(slot, level + 1);
      return { x: slot * 1.7, level: Math.min(level, 11) };
    });
  });

  const ROWS = 10;
  const bars = $derived.by(() => {
    if (!reveal || mode !== 'interval' || correct === null) return [];
    return (reveal.summary.ranges as [number, number][]).map(([lo, hi], i) => ({
      left: pct(lo),
      width: pct(hi) - pct(lo),
      row: i % ROWS,
      hit: correct >= lo && correct <= hi,
    }));
  });
  const median = $derived(reveal && mode === 'estimate' ? (reveal.summary.median as number | null) : null);
</script>

<div class="scale card">
  <div class="plot">
    {#if !reveal}
      <div class="waiting bob">
        <span>?</span>
        <p>{mode === 'estimate' ? 'Schätzt auf dem Handy!' : 'Wählt euren Bereich auf dem Handy!'}</p>
      </div>
    {/if}

    {#each dots as d, i (i)}
      <i class="dot pop-in" style="left:{d.x}%;bottom:{d.level * 1.75}rem;animation-delay:{Math.min(1.2, i * 0.04)}s"></i>
    {/each}

    {#each bars as b, i (i)}
      <i class="bar pop-in" class:hit={b.hit} style="left:{b.left}%;width:{b.width}%;bottom:{b.row * 1.9}rem;animation-delay:{Math.min(1.2, i * 0.05)}s">
        {#if b.hit}<Icon name="check" />{/if}
      </i>
    {/each}

    {#if correct !== null}
      <div class="answer" style="left:{pct(correct)}%">
        <span class="flag pop-in">{fmt(correct)}{#if p.unit}<small>{p.unit}</small>{/if}</span>
        <span class="stem"></span>
      </div>
    {/if}
  </div>

  <div class="line"></div>
  <div class="ticks">
    {#each ticks as t, i (i)}
      <span style="left:{i * 25}%">{fmt(t)}{#if p.unit && (i === 0 || i === 4)}<small> {p.unit}</small>{/if}</span>
    {/each}
  </div>

  {#if median !== null}
    <p class="pill median rise-in">Median der Runde: {fmt(median)} {p.unit}</p>
  {/if}
</div>

<style>
  /* eigene Karte: Punkte und Balken brauchen einen ruhigen Grund */
  .scale {
    flex: 1;
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    padding: 1.6rem 6rem 0.6rem;
    border-width: 0.26rem;
    border-radius: 2rem;
    box-shadow: var(--drop-l);
    position: relative;
  }
  .plot {
    flex: 1;
    min-height: 0;
    position: relative;
    margin-bottom: 0.9rem;
  }
  .line {
    flex: none;
    height: 1.5rem;
    margin: 0 -1.2rem;
    border: 0.24rem solid var(--ink);
    border-radius: 99rem;
    background: var(--honey);
  }
  .ticks {
    flex: none;
    position: relative;
    height: 4.6rem;
    margin-top: 0.8rem;
  }
  .ticks span {
    position: absolute;
    translate: -50% 0;
    font-size: 2.2rem;
    font-weight: 700;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  .ticks small {
    font-size: 0.7em;
    font-weight: 600;
  }

  .waiting {
    position: absolute;
    left: 50%;
    bottom: 1rem;
    translate: -50% 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }
  .waiting span {
    width: 9rem;
    height: 9rem;
    display: grid;
    place-items: center;
    border: 0.3rem solid var(--ink);
    border-radius: 50%;
    background: var(--honey);
    box-shadow: var(--drop-l);
    font-size: 6rem;
    font-weight: 700;
  }
  .waiting p {
    font-size: 2.2rem;
    font-weight: 650;
    white-space: nowrap;
  }

  /* Schätzungen der Runde */
  .dot {
    position: absolute;
    width: 1.9rem;
    height: 1.9rem;
    margin-left: -0.95rem;
    border: 0.2rem solid var(--ink);
    border-radius: 50%;
    background: var(--a4);
    opacity: 0.9;
  }
  /* gewählte Bereiche, halbtransparent übereinander; Treffer zusätzlich mit Haken und durchgezogenem Rand */
  .bar {
    position: absolute;
    min-width: 1.4rem;
    height: 1.7rem;
    display: grid;
    place-items: center;
    border: 0.18rem dashed var(--ink);
    border-radius: 99rem;
    background: rgba(86, 180, 233, 0.5);
    font-size: 1.1rem;
    transform-origin: left center;
  }
  .bar.hit {
    border-style: solid;
    background: rgba(0, 143, 104, 0.6);
    color: #fff;
  }

  /* Lösung */
  .answer {
    position: absolute;
    top: 0;
    bottom: -1.2rem;
    width: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    z-index: 2;
  }
  .flag {
    flex: none;
    padding: 0.1rem 1.4rem;
    border: 0.26rem solid var(--ink);
    border-radius: 1.4rem;
    background: var(--ok);
    color: #fff;
    box-shadow: var(--drop-l);
    font-size: 4rem;
    font-weight: 700;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
    animation-delay: 1.1s;
  }
  .flag small {
    font-size: 0.55em;
    font-weight: 600;
    margin-left: 0.25em;
  }
  .stem {
    flex: 1;
    width: 0.5rem;
    background: var(--ink);
    border-radius: 0 0 99rem 99rem;
    transform-origin: top center;
    animation: stem 0.5s var(--ease-out) 1.2s backwards;
  }
  @keyframes stem {
    from {
      transform: scaleY(0);
    }
  }
  .median {
    position: absolute;
    left: 1.4rem;
    top: 1.2rem;
    background: var(--cream);
    font-size: 1.6rem;
    animation-delay: 1.5s;
  }
</style>
