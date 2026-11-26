<script lang="ts">
  // Sortierbare Liste fürs Handy: Zeile anfassen und ziehen. Die übrigen Zeilen rücken animiert nach.
  // Für Tastatur und Screenreader: Zeile fokussieren, Pfeil hoch/runter verschiebt.
  import { flip } from 'svelte/animate';
  import Icon from '../../web/lib/Icon.svelte';

  interface Row {
    id: number;
    text: string;
  }

  let {
    items,
    locked,
    onmove,
    numbered = false,
  }: {
    items: Row[];
    locked: boolean;
    onmove: (next: Row[]) => void;
    /** Positionsnummer vor jeder Zeile zeigen. */
    numbered?: boolean;
  } = $props();

  let list: HTMLOListElement;
  let dragging = $state<number | null>(null);

  function moveTo(id: number, target: number) {
    const from = items.findIndex((r) => r.id === id);
    const to = Math.min(items.length - 1, Math.max(0, target));
    if (from < 0 || from === to) return;
    const next = [...items];
    const [row] = next.splice(from, 1);
    next.splice(to, 0, row);
    onmove(next);
  }

  function down(e: PointerEvent, id: number) {
    if (locked) return;
    dragging = id;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function move(e: PointerEvent) {
    if (dragging === null) return;
    const rect = list.getBoundingClientRect();
    moveTo(dragging, Math.floor(((e.clientY - rect.top) / rect.height) * items.length));
  }

  function key(e: KeyboardEvent, id: number, index: number) {
    if (locked) return;
    if (e.key === 'ArrowUp') moveTo(id, index - 1);
    else if (e.key === 'ArrowDown') moveTo(id, index + 1);
    else return;
    e.preventDefault();
  }
</script>

<ol class="sort" class:locked bind:this={list}>
  {#each items as row, i (row.id)}
    <!-- Die Zeile selbst ist der Griff: ziehen per Finger, verschieben per Pfeiltasten -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
    <li
      class:drag={dragging === row.id}
      animate:flip={{ duration: 170 }}
      tabindex={locked ? -1 : 0}
      aria-label="{row.text}, Position {i + 1} von {items.length}"
      onpointerdown={(e) => down(e, row.id)}
      onpointermove={move}
      onpointerup={() => (dragging = null)}
      onpointercancel={() => (dragging = null)}
      onkeydown={(e) => key(e, row.id, i)}
    >
      {#if numbered}<span class="pos">{i + 1}</span>{/if}
      <span class="text">{row.text}</span>
      <span class="grip"><Icon name="grip" /></span>
    </li>
  {/each}
</ol>

<style>
  .sort {
    list-style: none;
    margin: 0;
    padding: 0;
    flex: 1;
    min-height: 0;
    display: grid;
    grid-auto-rows: minmax(0, 1fr);
    gap: 0.5rem;
  }
  li {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    min-height: 0;
    padding: 0.2rem 0.6rem 0.2rem 0.7rem;
    border: var(--line) solid var(--ink);
    border-radius: var(--r-s);
    background: var(--paper);
    box-shadow: 0 0.2rem 0 var(--ink);
    font-weight: 650;
    font-size: 1.05rem;
    line-height: 1.12;
    touch-action: none;
    cursor: grab;
    user-select: none;
    -webkit-user-select: none;
  }
  li.drag {
    background: var(--honey-light);
    box-shadow: 0 0.45rem 0 var(--ink);
    transform: scale(1.03);
    z-index: 2;
    position: relative;
  }
  .pos {
    flex: none;
    width: 1.7rem;
    height: 1.7rem;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: var(--ink);
    color: #fff;
    font-size: 0.95rem;
    font-variant-numeric: tabular-nums;
  }
  .text {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
  }
  .grip {
    flex: none;
    color: var(--ink-2);
    font-size: 1.2rem;
  }
  .locked li {
    cursor: default;
    opacity: 0.75;
  }
  .locked .grip {
    visibility: hidden;
  }
</style>
