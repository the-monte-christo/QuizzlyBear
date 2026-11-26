<script lang="ts">
  // Reihenfolge auf dem Host: erst gemischt, bei der Auflösung sortieren sich die Karten sichtbar um.
  import { flip } from 'svelte/animate';
  import Icon from '../../web/lib/Icon.svelte';
  import type { HostProps } from '../ui';
  import type { OrderPublic, OrderSummary } from './logic';

  let { q, reveal }: HostProps = $props();
  const data = $derived(q.data as OrderPublic);
  const summary = $derived(reveal?.summary as OrderSummary | undefined);

  let sorted = $state(false);
  $effect(() => {
    if (!reveal) return void (sorted = false);
    const t = setTimeout(() => (sorted = true), 800);
    return () => clearTimeout(t);
  });
  const rows = $derived(sorted ? [...data.items].sort((a, b) => a.id - b.id) : data.items);
</script>

<div class="order" class:tight={rows.length > 5}>
  {#if data.first}<p class="end">▲ {data.first}</p>{/if}
  <ol>
    {#each rows as item, i (item.id)}
      <li class="card rise-in" class:done={sorted} animate:flip={{ duration: 800 }} style="animation-delay:{i * 70}ms">
        <span class="pos">{sorted ? i + 1 : '?'}</span>
        <span class="text">{item.text}</span>
        {#if sorted && summary}
          <span class="count pop-in" style="animation-delay:{0.5 + i * 0.08}s"><Icon name="check" /> {summary.positions[i]}</span>
        {/if}
      </li>
    {/each}
  </ol>
  {#if data.last}<p class="end">▼ {data.last}</p>{/if}
</div>

<style>
  .order {
    flex: 1;
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.7rem;
    font-size: 2.7rem;
  }
  .order.tight {
    font-size: 2.1rem;
  }
  ol {
    list-style: none;
    margin: 0;
    padding: 0;
    flex: 1;
    min-height: 0;
    width: min(100%, 78rem);
    display: grid;
    grid-auto-rows: minmax(0, 1fr);
    gap: 0.9rem;
  }
  li {
    display: flex;
    align-items: center;
    gap: 1.2rem;
    min-height: 0;
    padding: 0 1.6rem 0 0.9rem;
    border-width: 0.24rem;
    border-radius: 99rem;
    font-weight: 650;
    line-height: 1.1;
    animation-fill-mode: backwards;
  }
  li:nth-child(odd) {
    margin-right: 1.2rem;
  }
  li:nth-child(even) {
    margin-left: 1.2rem;
  }
  .done {
    background: var(--ok-bg);
  }
  .pos {
    flex: none;
    width: 1.5em;
    height: 1.5em;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: var(--ink);
    color: #fff;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .done .pos {
    background: var(--ok);
  }
  .text {
    flex: 1;
    min-width: 0;
  }
  .count {
    flex: none;
    display: inline-flex;
    align-items: center;
    gap: 0.25em;
    padding: 0.05em 0.6em;
    border: 0.18rem solid var(--ink);
    border-radius: 99rem;
    background: #fff;
    font-size: 0.72em;
    font-variant-numeric: tabular-nums;
  }
  .end {
    flex: none;
    padding: 0.1rem 1.2rem;
    border-radius: 99rem;
    background: var(--ink);
    color: #fff;
    font-size: 1.5rem;
    font-weight: 600;
  }
</style>
