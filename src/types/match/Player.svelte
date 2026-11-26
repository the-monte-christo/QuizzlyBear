<script lang="ts">
  // Paare: Links stehen die festen Einträge (Farbe + Symbol), rechts wird die Liste so sortiert,
  // dass jede Zeile zu ihrem linken Nachbarn passt.
  import { untrack } from 'svelte';
  import Shape from '../../web/lib/Shape.svelte';
  import SortList from '../_shared/SortList.svelte';
  import SubmitBar from '../_shared/SubmitBar.svelte';
  import { same, type PlayerProps } from '../ui';
  import type { Item } from '../order/logic';
  import type { MatchPublic } from './logic';

  let { q, value, locked, submit }: PlayerProps = $props();
  const data = $derived(q.data as MatchPublic);

  let draft = $state<Item[]>(
    untrack(() => {
      const sent = value as number[] | undefined;
      return sent ? sent.map((id) => data.right.find((i) => i.id === id)!) : [...data.right];
    }),
  );
  const ids = $derived(draft.map((i) => i.id));
</script>

<div class="wrap">
  <div class="cols">
    <ol class="left">
      {#each data.left as text, i (i)}
        <li class="opt-{i}"><Shape index={i} /><span>{text}</span></li>
      {/each}
    </ol>
    <SortList items={draft} {locked} onmove={(next) => (draft = next)} />
  </div>
  <SubmitBar ready dirty={!same(ids, value)} sent={value !== undefined} {locked} onsend={() => submit(ids)} />
</div>

<style>
  .wrap {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .cols {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: 42% 1fr;
    gap: 0.35rem;
  }
  .left {
    list-style: none;
    margin: 0;
    padding: 0;
    min-height: 0;
    display: grid;
    grid-auto-rows: minmax(0, 1fr);
    gap: 0.5rem;
  }
  .left li {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    min-height: 0;
    padding: 0.2rem 0.6rem;
    border: var(--line) solid var(--ink);
    /* rechts eine Nase, die auf den Partner zeigt */
    border-radius: var(--r-s) 99rem 99rem var(--r-s);
    background: var(--c);
    color: var(--c-ink);
    font-weight: 650;
    font-size: 1rem;
    line-height: 1.1;
  }
  .left span {
    min-width: 0;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
  }
  .left :global(.shape) {
    font-size: 1.2rem;
  }
</style>
