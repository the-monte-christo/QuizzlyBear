<script lang="ts">
  import { untrack } from 'svelte';
  import ImagePad from '../_shared/ImagePad.svelte';
  import SubmitBar from '../_shared/SubmitBar.svelte';
  import { same, type PlayerProps } from '../ui';
  import type { Point } from './logic';

  let { q, value, locked, submit }: PlayerProps = $props();
  let mark = $state<Point | null>(untrack(() => (value as Point | undefined) ?? null));
  const rounded = $derived(mark && { x: Number(mark.x.toFixed(4)), y: Number(mark.y.toFixed(4)) });
</script>

<div class="wrap">
  {#if q.image}
    <ImagePad image={q.image} mode="pin" {mark} {locked} onchange={(m) => (mark = { x: m.x, y: m.y })} />
  {/if}
  <SubmitBar ready={!!mark} dirty={!same(rounded, value)} sent={value !== undefined} {locked} onsend={() => submit(rounded)} hint="Tippe ins Bild" />
</div>

<style>
  .wrap {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
  }
</style>
