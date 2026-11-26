<script lang="ts">
  import { untrack } from 'svelte';
  import ImagePad from '../_shared/ImagePad.svelte';
  import RangeTrack from '../_shared/RangeTrack.svelte';
  import SubmitBar from '../_shared/SubmitBar.svelte';
  import { same, type PlayerProps } from '../ui';
  import type { Circle, CirclePublic } from './logic';

  let { q, value, locked, submit }: PlayerProps = $props();
  const p = $derived(q.data as CirclePublic);

  let mark = $state<Circle | null>(untrack(() => (value as Circle | undefined) ?? null));
  const rounded = $derived(mark && { x: Number(mark.x.toFixed(4)), y: Number(mark.y.toFixed(4)), r: Number(mark.r.toFixed(4)) });
  const possible = $derived(mark ? Math.round(q.maxPoints * Math.min(1, Math.max(0, 1 - (mark.r - p.minRadius) / (p.maxRadius - p.minRadius)))) : 0);
</script>

<div class="wrap">
  {#if q.image}
    <ImagePad
      image={q.image}
      mode="circle"
      {mark}
      {locked}
      minRadius={p.minRadius}
      maxRadius={p.maxRadius}
      onchange={(m) => (mark = { x: m.x, y: m.y, r: m.r ?? p.minRadius })}
    />
  {/if}
  {#if mark}
    <!-- Feinjustierung des Radius; die Punktevorschau zeigt, was ein Treffer wert wäre -->
    <div class="size">
      <RangeTrack min={p.minRadius} max={p.maxRadius} step={0.005} values={[mark.r]} {locked} onchange={(v) => (mark = { ...mark!, r: v[0] })} />
      <span class="worth">Treffer: <b>{possible}</b></span>
    </div>
  {/if}
  <SubmitBar
    ready={!!mark}
    dirty={!same(rounded, value)}
    sent={value !== undefined}
    {locked}
    onsend={() => submit(rounded)}
    hint="Tippe ins Bild und zieh den Kreis auf"
  />
</div>

<style>
  .wrap {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .size {
    flex: none;
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 0.3rem;
    padding-right: 0.8rem;
    border-radius: var(--r-m);
    background: rgba(255, 251, 240, 0.88);
  }
  .worth {
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    min-width: 6.2rem;
    text-align: right;
  }
</style>
