<script lang="ts">
  import { untrack } from 'svelte';
  import RangeTrack from '../_shared/RangeTrack.svelte';
  import { formatNumber, snap, type ScalePublic } from '../_shared/scale';
  import SubmitBar from '../_shared/SubmitBar.svelte';
  import { same, type PlayerProps } from '../ui';

  let { q, value, locked, submit }: PlayerProps = $props();
  const p = $derived(q.data as ScalePublic);

  let range = $state<number[]>(
    untrack(() => (value as number[] | undefined) ?? [snap(p.min + (p.max - p.min) * 0.25, p), snap(p.min + (p.max - p.min) * 0.75, p)]),
  );
  let touched = $state(untrack(() => value !== undefined));

  // So viele Punkte gäbe es, wenn die Lösung im Bereich liegt
  const possible = $derived(Math.round(q.maxPoints * Math.max(0, 1 - (range[1] - range[0]) / (p.max - p.min))));
</script>

<div class="wrap">
  <div class="card readout">
    <div class="num" class:idle={!touched}>
      {formatNumber(range[0], p.step)}<span class="dash">–</span>{formatNumber(range[1], p.step)}{#if p.unit}<small>{p.unit}</small>{/if}
    </div>
    <p class="worth">Treffer bringt <b>{possible}</b> Punkte</p>
  </div>

  <div class="slider">
    <RangeTrack
      min={p.min}
      max={p.max}
      step={p.step}
      values={range}
      {locked}
      onchange={(v) => {
        range = v;
        touched = true;
      }}
    />
    <div class="ends"><span>{formatNumber(p.min, p.step)}</span><span>{formatNumber(p.max, p.step)}</span></div>
  </div>

  <SubmitBar ready={touched} dirty={!same(range, value)} sent={value !== undefined} {locked} onsend={() => submit(range)} hint="Zieh die beiden Griffe" />
</div>

<style>
  .wrap {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 1.2rem;
  }
  .readout {
    padding: 0.9rem 0.8rem;
    text-align: center;
    transform: rotate(0.8deg);
  }
  .num {
    font-size: 2.7rem;
    font-weight: 700;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  .num.idle {
    color: #b79c7c;
  }
  .dash {
    margin: 0 0.2em;
  }
  .num small {
    font-size: 1.2rem;
    font-weight: 600;
    margin-left: 0.25em;
  }
  .worth {
    margin-top: 0.5rem;
    font-weight: 600;
    color: var(--ink-2);
  }
  .worth b {
    color: var(--ink);
    font-variant-numeric: tabular-nums;
  }
  .slider {
    padding: 0.6rem 0.2rem 0.5rem;
    border-radius: var(--r-m);
    background: rgba(255, 251, 240, 0.88);
  }
  .ends {
    display: flex;
    justify-content: space-between;
    padding: 0 0.8rem;
    font-weight: 650;
    font-variant-numeric: tabular-nums;
  }
</style>
