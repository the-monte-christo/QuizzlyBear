<script lang="ts">
  // Schieberegler mit einem oder zwei Griffen, für Daumen gebaut (große Griffe, ganze Leiste tippbar).
  // Bewegt wird der nächstgelegene Griff. Pfeiltasten verändern den fokussierten Griff schrittweise.
  import { snap } from './scale';

  let {
    min,
    max,
    step,
    values,
    locked,
    onchange,
  }: {
    min: number;
    max: number;
    step: number;
    /** ein Wert (Schätzung) oder zwei (von–bis) */
    values: number[];
    locked: boolean;
    onchange: (values: number[]) => void;
  } = $props();

  let track: HTMLDivElement;
  let active = $state(-1);

  const pct = (v: number) => ((v - min) / (max - min)) * 100;
  const range = $derived(values.length === 2);

  function set(index: number, v: number, force = false) {
    const next = [...values];
    next[index] = snap(v, { min, max, step });
    // Griffe dürfen sich nicht überholen
    if (range) {
      if (index === 0) next[0] = Math.min(next[0], next[1]);
      else next[1] = Math.max(next[1], next[0]);
    }
    // force: Auch ein Tipp genau auf den aktuellen Wert zählt als Eingabe
    if (force || next[index] !== values[index]) onchange(next);
  }

  function valueAt(e: PointerEvent): number {
    const rect = track.getBoundingClientRect();
    return min + Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)) * (max - min);
  }

  function down(e: PointerEvent) {
    if (locked) return;
    const v = valueAt(e);
    active = range && Math.abs(v - values[1]) < Math.abs(v - values[0]) ? 1 : 0;
    // liegen beide Griffe aufeinander, entscheidet die Richtung
    if (range && values[0] === values[1]) active = v > values[0] ? 1 : 0;
    track.setPointerCapture(e.pointerId);
    set(active, v, true);
  }

  function move(e: PointerEvent) {
    if (active >= 0) set(active, valueAt(e));
  }

  function key(e: KeyboardEvent, index: number) {
    if (locked) return;
    const big = (max - min) / 10;
    const delta =
      e.key === 'ArrowRight' || e.key === 'ArrowUp' ? step : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -step : e.key === 'PageUp' ? big : e.key === 'PageDown' ? -big : 0;
    if (!delta) return;
    e.preventDefault();
    set(index, values[index] + delta);
  }
</script>

<div
  class="track"
  class:locked
  role="group"
  bind:this={track}
  onpointerdown={down}
  onpointermove={move}
  onpointerup={() => (active = -1)}
  onpointercancel={() => (active = -1)}
>
  <div class="rail"></div>
  {#if range}
    <div class="span" style="left:{pct(values[0])}%;width:{pct(values[1]) - pct(values[0])}%"></div>
  {:else}
    <div class="span" style="left:0;width:{pct(values[0])}%"></div>
  {/if}
  {#each values as v, i (i)}
    <div
      class="thumb"
      class:on={active === i}
      style="left:{pct(v)}%"
      role="slider"
      tabindex={locked ? -1 : 0}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={v}
      aria-label={range ? (i === 0 ? 'von' : 'bis') : 'Schätzung'}
      onkeydown={(e) => key(e, i)}
    >
      {#if range}<span>{i === 0 ? '◀' : '▶'}</span>{/if}
    </div>
  {/each}
</div>

<style>
  .track {
    position: relative;
    height: 3.4rem;
    margin: 0 1.5rem;
    touch-action: none;
    cursor: pointer;
  }
  .rail,
  .span {
    position: absolute;
    top: 50%;
    height: 1rem;
    translate: 0 -50%;
    border: var(--line) solid var(--ink);
    border-radius: 99rem;
  }
  .rail {
    left: -0.6rem;
    right: -0.6rem;
    background: var(--paper);
  }
  .span {
    background: var(--a0);
    border-radius: 0;
    border-left: 0;
    border-right: 0;
  }
  .thumb {
    position: absolute;
    top: 50%;
    width: 2.9rem;
    height: 2.9rem;
    translate: -50% -50%;
    display: grid;
    place-items: center;
    border: var(--line) solid var(--ink);
    border-radius: 50%;
    background: var(--honey);
    box-shadow: 0 0.22rem 0 var(--ink);
    font-size: 0.9rem;
    transition: scale 0.12s var(--ease-out);
  }
  .thumb.on {
    scale: 1.15;
    background: var(--honey-light);
  }
  .locked {
    cursor: default;
    opacity: 0.7;
  }
</style>
