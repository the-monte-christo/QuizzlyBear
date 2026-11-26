<script lang="ts">
  import Backdrop from '../lib/Backdrop.svelte';
  import Icon from '../lib/Icon.svelte';
  import Sticker from '../lib/Sticker.svelte';
  import { TYPE_LABELS } from '../../types/labels';
  import { game } from './game.svelte';
  import Join from './Join.svelte';
  import QuestionView from './QuestionView.svelte';
  import ResultView from './ResultView.svelte';

  const s = $derived(game.state);
  const view = $derived(game.view);

  // Countdown-Zahl lokal herunterzählen
  let count = $state(3);
  $effect(() => {
    if (view !== 'countdown') return;
    const tick = () => (count = Math.max(1, Math.ceil((game.revealAt - performance.now()) / 1000)));
    tick();
    const t = setInterval(tick, 100);
    return () => clearInterval(t);
  });

  const medal = (rank: number) => (rank === 1 ? 'bear-trophy' : rank <= 3 ? 'bear-cheer' : 'bear-wave');
</script>

<Backdrop variant="phone" deco={view === 'join' || view === 'lobby' || view === 'final'} />

<main class="phone">
  {#if game.restoring && !s}
    <div class="center"><Sticker name="bear-think" small class="mascot bob" /><p class="big">Verbinde …</p></div>
  {:else if !s}
    <Join />
  {:else if view === 'lobby'}
    <div class="center">
      <Sticker name="bear-wave" small class="mascot bob" />
      <div class="card note pop-in">
        <p class="big">Du bist dabei,<br />{s.me.name}!</p>
        <p class="muted">Dein Name steht jetzt auf dem großen Bildschirm.</p>
      </div>
      <p class="pill"><Icon name="users" /> {s.playerCount} im Spiel</p>
      <p class="muted">Gleich geht's los …</p>
    </div>
  {:else if view === 'countdown' && s.question}
    <div class="center">
      <p class="pill">Frage {s.question.index + 1} von {s.question.total}</p>
      {#key count}
        <div class="count pop-in">{count}</div>
      {/key}
      <p class="big">{TYPE_LABELS[s.question.type].label}</p>
      <p class="muted">{TYPE_LABELS[s.question.type].hint}</p>
    </div>
  {:else if view === 'question' && s.question}
    <QuestionView />
  {:else if view === 'reveal' && s.question}
    <ResultView />
  {:else if view === 'leaderboard'}
    <div class="center">
      <Sticker name={s.me.rank === 1 ? 'bear-cheer' : 'bear-think'} small class="mascot bob" />
      <div class="card note pop-in">
        <p class="muted">Du bist auf</p>
        <p class="rank">Platz {s.me.rank}</p>
        {#if s.ahead}
          <p class="gap">Noch <b>{s.ahead.gap}</b> Punkte bis {s.ahead.name}</p>
        {:else}
          <p class="gap">Ganz vorn – halt die Stellung!</p>
        {/if}
      </div>
    </div>
  {:else if view === 'final' && s.final}
    <div class="center">
      {#if !s.final.revealed}
        <Sticker name="herry-shock" small class="mascot wiggle" />
        <div class="card note pop-in">
          <p class="big">Du bist unter den Besten!</p>
          <p class="muted">Schau auf den großen Bildschirm …</p>
        </div>
      {:else}
        <Sticker name={medal(s.final.rank)} small class="mascot bob" />
        <div class="card note pop-in">
          <p class="muted">Endstand</p>
          <p class="rank">Platz {s.final.rank}</p>
          <p class="gap">von {s.final.total} · {s.final.score} Punkte</p>
          <div class="stats">
            <span class="pill"><Icon name="check" /> {s.final.correct} richtig</span>
            <span class="pill"><Icon name="flame" /> Beste Serie {s.final.maxStreak}</span>
          </div>
        </div>
        <button class="btn plain small" onclick={() => game.leave()}>Neues Spiel</button>
      {/if}
    </div>
  {/if}

  {#if s}
    <footer class="me">
      <span class="name">{s.me.name}</span>
      {#if s.me.streak >= 2}
        <span class="streak" title="Serie"><Icon name="flame" />{s.me.streak}</span>
      {/if}
      <span class="score">{s.me.score}</span>
    </footer>
  {/if}

  {#if s && !game.online}
    <div class="offline pop-in" role="status"><Icon name="wifi-off" /> Verbindung weg – ich versuche es weiter …</div>
  {/if}
</main>

<style>
  .phone :global(.mascot) {
    width: min(11rem, 44vw);
    max-height: 30dvh;
    object-fit: contain;
    --tilt: -3deg;
  }
  .note {
    width: 100%;
    padding: 1.1rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    --tilt: -1deg;
  }
  .count {
    width: 9rem;
    height: 9rem;
    display: grid;
    place-items: center;
    border: 0.3rem solid var(--ink);
    border-radius: 50%;
    background: var(--paper);
    box-shadow: var(--drop-l);
    font-size: 6rem;
    font-weight: 700;
    line-height: 1;
    --tilt: -4deg;
  }
  .rank {
    font-size: 3.4rem;
    font-weight: 700;
    line-height: 1;
  }
  .gap {
    font-weight: 600;
  }
  .stats {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.5rem;
    margin-top: 0.5rem;
    font-size: 0.95rem;
  }
  .me {
    flex: none;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin: 0 -0.8rem;
    padding: 0.55rem 1rem max(0.55rem, env(safe-area-inset-bottom));
    background: var(--ink);
    color: #fff;
    font-weight: 650;
    font-size: 1.05rem;
  }
  .name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .streak {
    display: inline-flex;
    align-items: center;
    gap: 0.15rem;
    padding: 0.05rem 0.55rem;
    border-radius: 99rem;
    background: var(--a1);
  }
  .score {
    padding: 0.05rem 0.7rem;
    border-radius: 99rem;
    background: var(--honey);
    color: var(--ink);
    font-variant-numeric: tabular-nums;
  }
  .offline {
    position: absolute;
    left: 0.8rem;
    right: 0.8rem;
    top: max(0.7rem, env(safe-area-inset-top));
    z-index: 10;
    padding: 0.6rem 0.9rem;
    border: var(--line) solid var(--ink);
    border-radius: var(--r-m);
    background: var(--bad);
    color: #fff;
    font-weight: 650;
    text-align: center;
  }
</style>
