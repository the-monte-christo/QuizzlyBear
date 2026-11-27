<script lang="ts">
  // Siegerehrung. Die Reihenfolge, in der die Plätze enthüllt werden, kommt aus dem Quiz
  // (settings.ranking.reveal, z. B. [3, 2, 1]); der Host enthüllt mit „weiter“ Platz für Platz.
  import CountUp from '../lib/CountUp.svelte';
  import Icon from '../lib/Icon.svelte';
  import Sticker from '../lib/Sticker.svelte';
  import Confetti from './Confetti.svelte';
  import { game } from './game.svelte';

  const f = $derived(game.state!.final!);
  const done = $derived(f.step >= f.reveal.length);
  const revealed = $derived(new Set(f.reveal.slice(0, f.step)));
  const visible = (rank: number) => done || revealed.has(rank);

  // Podest: 2 – 1 – 3, soweit es so viele Spieler gibt
  const podium = $derived([2, 1, 3].map((rank) => f.rows.find((r) => r.rank === rank)).filter((r) => !!r));
  const others = $derived(f.rows.filter((r) => r.rank > 3 && visible(r.rank)).slice(0, 8));
  const winnerShown = $derived(f.rows.length > 0 && visible(1));
</script>

{#if winnerShown}<Confetti />{/if}

<div class="final">
  <h2 class="title-sticker title drop-in">Siegerehrung</h2>

  <div class="layout">
    <div class="podium">
      {#each podium as r (r.id)}
        <div class="col p{r.rank}">
          <div class="who">
            {#if visible(r.rank)}
              <div class="card winner pop-in" style="--tilt:{r.rank === 1 ? -2 : r.rank === 2 ? 2 : -1}deg">
                <span class="wname">{r.name}</span>
                <span class="wscore"><CountUp value={r.score} from={0} duration={1200} /> Punkte</span>
              </div>
            {:else}
              <div class="card mystery wiggle">?</div>
            {/if}
          </div>
          <div class="block"><span>{r.rank}</span></div>
        </div>
      {/each}
      {#if winnerShown}
        <Sticker name="bear-trophy" class="bear pop-in" />
      {/if}
    </div>

    <aside class="side">
      {#if others.length}
        <ol class="others">
          {#each others as r (r.id)}
            <li class="card row rise-in">
              <span class="rank">{r.rank}</span>
              <span class="name">{r.name}</span>
              <span class="score">{r.score.toLocaleString('de-DE')}</span>
            </li>
          {/each}
        </ol>
      {/if}
      {#if done && f.awards.longestStreak}
        <div class="card award pop-in">
          <Icon name="flame" />
          <span>Längste Serie: <b>{f.awards.longestStreak.name}</b> mit {f.awards.longestStreak.streak} in Folge</span>
        </div>
      {/if}
      {#if !done}
        <p class="hint pill pulse">Gleich: Platz {f.reveal[f.step]}</p>
      {/if}
    </aside>
  </div>

  {#if done}
    <Sticker name="herry-wow" class="herry pop-in" />
  {/if}
</div>

<style>
  .final {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    position: relative;
  }
  .title {
    --tilt: 2deg;
    background: var(--a1);
    color: #fff;
    font-size: 4rem;
  }
  .layout {
    flex: 1;
    min-height: 0;
    width: 100%;
    display: grid;
    grid-template-columns: 1fr 34rem;
    gap: 3rem;
  }
  .podium {
    position: relative;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    gap: 1.4rem;
    padding-bottom: 0.5rem;
  }
  .col {
    width: 18.5rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }
  .who {
    min-height: 9.5rem;
    width: 100%;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }
  .winner {
    width: 100%;
    padding: 0.9rem 1rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    border-width: 0.26rem;
    box-shadow: var(--drop-l);
    text-align: center;
  }
  .wname {
    font-size: 2.5rem;
    font-weight: 700;
    line-height: 1.1;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .wscore {
    font-size: 1.7rem;
    font-weight: 600;
    color: var(--ink-2);
  }
  .mystery {
    width: 7rem;
    height: 7rem;
    display: grid;
    place-items: center;
    border-width: 0.26rem;
    border-radius: 50%;
    font-size: 4.6rem;
    font-weight: 700;
    background: var(--cream);
  }
  .block {
    width: 100%;
    display: grid;
    place-items: start center;
    padding-top: 1rem;
    border: 0.28rem solid var(--ink);
    border-bottom: 0;
    border-radius: 1.6rem 1.6rem 0 0;
    color: #fff;
    font-size: 6.5rem;
    font-weight: 700;
    line-height: 1;
  }
  .p1 .block { height: 21rem; background: var(--a1); }
  .p2 .block { height: 15rem; background: var(--a0); }
  .p3 .block { height: 10.5rem; background: var(--a2); }
  .p1 .winner { background: var(--honey-light); }
  .podium :global(.bear) {
    position: absolute;
    right: -10.5rem;
    bottom: 0;
    width: 13rem;
    --tilt: 3deg;
    --delay: 0.4s;
  }

  .side {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 1.2rem;
    padding-bottom: 6rem;
  }
  .others {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 0.9rem;
    padding: 0.35rem 1.2rem 0.35rem 0.5rem;
    border-radius: 99rem;
    font-size: 1.9rem;
    font-weight: 650;
  }
  .rank {
    flex: none;
    width: 2.7rem;
    height: 2.7rem;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: var(--ink);
    color: #fff;
    font-variant-numeric: tabular-nums;
  }
  .name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .score {
    font-variant-numeric: tabular-nums;
  }
  .award {
    display: flex;
    align-items: center;
    gap: 0.8rem;
    padding: 0.9rem 1.2rem;
    background: var(--a1);
    color: #fff;
    font-size: 1.7rem;
    font-weight: 600;
    --tilt: -2deg;
  }
  .award :global(.icon) {
    font-size: 2.6rem;
  }
  .hint {
    align-self: center;
    font-size: 2rem;
    --tilt: -2deg;
  }
  .final :global(.herry) {
    position: absolute;
    left: -6.2rem;
    bottom: -3rem;
    width: 8.5rem;
    --tilt: 8deg;
    --delay: 0.8s;
  }
</style>
