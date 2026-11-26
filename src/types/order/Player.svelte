<script lang="ts">
  import { untrack } from 'svelte';
  import SortList from '../_shared/SortList.svelte';
  import SubmitBar from '../_shared/SubmitBar.svelte';
  import { same, type PlayerProps } from '../ui';
  import type { Item, OrderPublic } from './logic';

  let { q, value, locked, submit }: PlayerProps = $props();
  const data = $derived(q.data as OrderPublic);

  // Startet in der gemischten Reihenfolge – oder mit der schon gesendeten Antwort (Reconnect)
  let draft = $state<Item[]>(
    untrack(() => {
      const sent = value as number[] | undefined;
      return sent ? sent.map((id) => data.items.find((i) => i.id === id)!) : [...data.items];
    }),
  );
  const ids = $derived(draft.map((i) => i.id));
</script>

<div class="wrap">
  {#if data.first}<p class="end">▲ {data.first}</p>{/if}
  <SortList items={draft} {locked} numbered onmove={(next) => (draft = next)} />
  {#if data.last}<p class="end">▼ {data.last}</p>{/if}
  <SubmitBar ready dirty={!same(ids, value)} sent={value !== undefined} {locked} onsend={() => submit(ids)} />
</div>

<style>
  .wrap {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .end {
    flex: none;
    align-self: center;
    padding: 0.05rem 0.8rem;
    border-radius: 99rem;
    background: var(--ink);
    color: #fff;
    font-size: 0.9rem;
    font-weight: 600;
  }
</style>
