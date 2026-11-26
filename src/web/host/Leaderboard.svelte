<script lang="ts">
  // Zwischen-Rangliste: startet in der alten Reihenfolge und sortiert sich dann sichtbar um.
  import { onMount } from 'svelte';
  import { flip } from 'svelte/animate';
  import CountUp from '../lib/CountUp.svelte';
  import Icon from '../lib/Icon.svelte';
  import Sticker from '../lib/Sticker.svelte';
  import type { LeaderRow } from '../../shared/protocol';
  import { game } from './game.svelte';

  const rows = $derived(game.state!.leaderboard ?? []);
  const moved = $derived(rows.some((r) => r.prevRank !== null && r.prevRank !== r.rank));

  let settled = $state(false);
  onMount(() => {
    const t = setTimeout(() => (settled = true), 1100);
    return () => clearTimeout(t);
  });

  const shown = $derived.by((): LeaderRow[] => {
    if (settled || !moved) return rows;
    return [...rows].sort((a, b) => (a.prevRank ?? a.rank + 0.5) - (b.prevRank ?? b.rank + 0.5));
  });
  const place = (r: LeaderRow, i: number) => (settled || !moved ? r.rank : i + 1);
</script>

<div class="board">
  <h2 class="title-sticker title drop-in">Rangliste</h2>

  <ol>
    {#each shown as r, i (r.id)}
      <li class="row card" class:first={place(r, i) === 1 && settled} animate:flip={{ duration: 750 }}>
        <span class="rank">{place(r, i)}</span>
        <span class="name">{r.name}</span>
        {#if r.streak >= 2}
          <span class="pill streak"><Icon name="flame" />{r.streak}</span>
        {/if}
        {#if r.correct !== null}
          <span class="delta" class:plus={r.delta > 0}>
            <Icon name={r.delta > 0 ? 'check' : 'cross'} />
            {r.delta > 0 ? `+${r.delta}` : '0'}
          </span>
        {/if}
        <span class="score"><CountUp value={r.score} from={r.score - r.delta} delay={300} /></span>
      </li>
    {/each}
  </ol>

  <Sticker name="bear-think" class="bear bob" />
  <!-- Herry hängt frech an der Ecke der Rangliste -->
  <Sticker name="herry-tongue" class="herry wiggle" />
</div>

<style>
  .board {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.6rem;
    position: relative;
  }
  .title {
    --tilt: -2deg;
    background: var(--a0);
    color: #fff;
    font-size: 4rem;
  }
  ol {
    list-style: none;
    margin: 0;
    padding: 0;
    width: 78rem;
    display: flex;
    flex-direction: column;
    gap: 1.1rem;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 1.4rem;
    padding: 0.7rem 1.8rem 0.7rem 0.9rem;
    border-width: 0.24rem;
    border-radius: 99rem;
    box-shadow: var(--drop-l);
    font-size: 2.9rem;
    font-weight: 650;
    will-change: transform;
  }
  .row:nth-child(even) {
    margin-left: 1.2rem;
    margin-right: -1.2rem;
  }
  .first {
    background: var(--honey-light);
  }
  .rank {
    flex: none;
    width: 4.2rem;
    height: 4.2rem;
    display: grid;
    place-items: center;
    border: 0.22rem solid var(--ink);
    border-radius: 50%;
    background: var(--ink);
    color: #fff;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .first .rank {
    background: var(--a1);
  }
  .name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .streak {
    background: var(--a1);
    color: #fff;
    font-size: 0.7em;
    border-width: 0.18rem;
  }
  .delta {
    display: inline-flex;
    align-items: center;
    gap: 0.25em;
    font-size: 0.72em;
    color: var(--bad);
    font-variant-numeric: tabular-nums;
  }
  .delta.plus {
    color: var(--ok);
  }
  .score {
    min-width: 5.2em;
    text-align: right;
    font-weight: 700;
  }
  .board :global(.bear) {
    position: absolute;
    left: -2rem;
    bottom: -1rem;
    width: 15rem;
    --tilt: -5deg;
  }
  .board :global(.herry) {
    position: absolute;
    right: 5.6rem;
    top: 0.4rem;
    width: 8rem;
    transform-origin: 50% 90%;
  }
</style>
