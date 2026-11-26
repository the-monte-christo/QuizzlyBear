<script lang="ts">
  // Paare auf dem Host: links fest (Farbe + Symbol), rechts gemischt. Bei der Auflösung rutscht
  // jede rechte Karte neben ihren Partner und übernimmt dessen Farbe und Symbol.
  import { flip } from 'svelte/animate';
  import Icon from '../../web/lib/Icon.svelte';
  import Shape from '../../web/lib/Shape.svelte';
  import type { HostProps } from '../ui';
  import type { MatchPublic, MatchSummary } from './logic';

  let { q, reveal }: HostProps = $props();
  const data = $derived(q.data as MatchPublic);
  const summary = $derived(reveal?.summary as MatchSummary | undefined);

  let paired = $state(false);
  $effect(() => {
    if (!reveal) return void (paired = false);
    const t = setTimeout(() => (paired = true), 800);
    return () => clearTimeout(t);
  });
  const right = $derived(paired ? [...data.right].sort((a, b) => a.id - b.id) : data.right);
</script>

<div class="match" class:tight={data.left.length > 4}>
  <ol class="left">
    {#each data.left as text, i (i)}
      <li class="opt-{i} rise-in" style="animation-delay:{i * 70}ms"><Shape index={i} /><span>{text}</span></li>
    {/each}
  </ol>
  <ol class="right">
    {#each right as item, i (item.id)}
      <li class="card rise-in {paired ? `opt-${item.id} on` : ''}" animate:flip={{ duration: 800 }} style="animation-delay:{i * 70 + 150}ms">
        {#if paired}<Shape index={item.id} />{/if}
        <span class="text">{item.text}</span>
        {#if paired && summary}
          <span class="count pop-in" style="animation-delay:{0.5 + i * 0.08}s"><Icon name="check" /> {summary.pairs[i]}</span>
        {/if}
      </li>
    {/each}
  </ol>
</div>

<style>
  .match {
    flex: 1;
    min-width: 0;
    min-height: 0;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2.6rem;
    font-size: 2.7rem;
  }
  .match.tight {
    font-size: 2.1rem;
  }
  ol {
    list-style: none;
    margin: 0;
    padding: 0;
    min-height: 0;
    display: grid;
    grid-auto-rows: minmax(0, 1fr);
    gap: 1rem;
  }
  li {
    display: flex;
    align-items: center;
    gap: 1rem;
    min-height: 0;
    padding: 0 1.6rem;
    border: 0.24rem solid var(--ink);
    font-weight: 650;
    line-height: 1.1;
    animation-fill-mode: backwards;
  }
  .left li {
    border-radius: 1.6rem 99rem 99rem 1.6rem;
    background: var(--c);
    color: var(--c-ink);
    box-shadow: var(--drop);
  }
  .right li {
    border-radius: 99rem 1.6rem 1.6rem 99rem;
    padding-left: 2.2rem;
  }
  .right li.on {
    background: var(--c);
    color: var(--c-ink);
  }
  .text,
  .left span {
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
    color: var(--ink);
    font-size: 0.72em;
    font-variant-numeric: tabular-nums;
  }
</style>
