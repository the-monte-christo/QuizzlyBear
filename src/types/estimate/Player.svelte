<script lang="ts">
  import { untrack } from 'svelte';
  import Icon from '../../web/lib/Icon.svelte';
  import RangeTrack from '../_shared/RangeTrack.svelte';
  import { formatNumber, snap, type ScalePublic } from '../_shared/scale';
  import SubmitBar from '../_shared/SubmitBar.svelte';
  import type { PlayerProps } from '../ui';

  let { q, value, locked, submit }: PlayerProps = $props();
  const p = $derived(q.data as ScalePublic);

  // Startet in der Mitte der Skala; gesendet werden kann erst nach einer eigenen Bewegung
  let guess = $state(untrack(() => (value as number | undefined) ?? snap((p.min + p.max) / 2, p)));
  let touched = $state(untrack(() => value !== undefined));

  function set(v: number) {
    guess = snap(v, p);
    touched = true;
  }
</script>

<div class="wrap">
  <div class="card readout">
    <button class="nudge" disabled={locked} aria-label="kleiner" onclick={() => set(guess - p.step)}><Icon name="minus" /></button>
    <div class="num" class:idle={!touched}>
      {formatNumber(guess, p.step)}{#if p.unit}<small>{p.unit}</small>{/if}
    </div>
    <button class="nudge" disabled={locked} aria-label="größer" onclick={() => set(guess + p.step)}><Icon name="plus" /></button>
  </div>

  <div class="slider">
    <RangeTrack min={p.min} max={p.max} step={p.step} values={[guess]} {locked} onchange={(v) => set(v[0])} />
    <div class="ends"><span>{formatNumber(p.min, p.step)}</span><span>{formatNumber(p.max, p.step)}</span></div>
  </div>

  <SubmitBar ready={touched} dirty={guess !== value} sent={value !== undefined} {locked} onsend={() => submit(guess)} hint="Schieb den Regler" />
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
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.8rem;
    transform: rotate(-0.8deg);
  }
  .num {
    flex: 1;
    text-align: center;
    font-size: 3.2rem;
    font-weight: 700;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  .num.idle {
    color: #b79c7c;
  }
  .num small {
    font-size: 1.3rem;
    font-weight: 600;
    margin-left: 0.25em;
  }
  .nudge {
    flex: none;
    width: 3.2rem;
    height: 3.2rem;
    display: grid;
    place-items: center;
    border: var(--line) solid var(--ink);
    border-radius: 50%;
    background: var(--honey);
    box-shadow: 0 0.2rem 0 var(--ink);
    font-size: 1.4rem;
  }
  .nudge:active:not(:disabled) {
    transform: translateY(0.15rem);
    box-shadow: 0 0.05rem 0 var(--ink);
  }
  .nudge:disabled {
    opacity: 0.4;
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
