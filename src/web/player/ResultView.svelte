<script lang="ts">
  // Auflösung auf dem Handy: richtig/falsch immer mit Symbol + Text, dazu Punkte und Serie.
  // Welche Figur mit welchem Spruch erscheint, kommt aus den Pools in lib/moods.ts.
  import Icon from '../lib/Icon.svelte';
  import { pick, RESULT, seedOf, type Mood } from '../lib/moods';
  import Sticker from '../lib/Sticker.svelte';
  import { game } from './game.svelte';

  const s = $derived(game.state!);
  const r = $derived(s.result);
  const q = $derived(s.question!);

  type Tone = 'ok' | 'bad' | 'mid' | 'none';
  type Verdict = { title: string; tone: Tone; pool: readonly Mood[] };

  const verdict = $derived.by((): Verdict => {
    if (!r || !r.answered) return { title: 'Keine Antwort', tone: 'bad', pool: RESULT.none };
    if (r.correct === null) return { title: 'Danke für deine Stimme!', tone: 'none', pool: RESULT.poll };
    if (q.scoring === 'proximity') {
      if (r.fraction >= 0.9) return { title: 'Volltreffer!', tone: 'ok', pool: RESULT.bullseye };
      if (r.correct) return { title: 'Nah dran!', tone: 'ok', pool: RESULT.close };
      if (r.fraction > 0) return { title: 'Knapp daneben', tone: 'mid', pool: RESULT.near };
      return { title: 'Daneben', tone: 'bad', pool: RESULT.wrong };
    }
    if (r.correct) return { title: 'Richtig!', tone: 'ok', pool: s.me.streak >= 3 ? RESULT.streak : RESULT.correct };
    if (r.fraction > 0) return { title: 'Teilweise richtig', tone: 'mid', pool: RESULT.partial };
    return { title: 'Leider falsch', tone: 'bad', pool: RESULT.wrong };
  });

  // Jeder Spieler startet an anderer Stelle im Pool, mit jeder Frage geht es einen Schritt weiter
  const mood = $derived(pick(verdict.pool, seedOf(s.me.id), q.index));
  const total = $derived((r?.points ?? 0) + (r?.bonus ?? 0));
</script>

<div class="stage">
  <div class="center">
    {#key q.index}
      <Sticker name={mood.art} small class="hero pop-in" />
      <div class="card verdict {verdict.tone} pop-in">
        <h2>
          {#if verdict.tone === 'ok'}<span class="badge"><Icon name="check" /></span>
          {:else if verdict.tone === 'bad'}<span class="badge"><Icon name="cross" /></span>{/if}
          {verdict.title}
        </h2>
        {#if q.scoring !== 'none'}
          <p class="points">+{total} <small>Punkte</small></p>
          {#if r?.bonus}<p class="bonus"><Icon name="flame" /> davon {r.bonus} Serien-Bonus</p>{/if}
        {/if}
        <p class="line">{mood.line}</p>
      </div>
      {#if s.me.streak >= 2}
        <p class="pill streak pop-in"><Icon name="flame" /> {s.me.streak}er-Serie!</p>
      {/if}
    {/key}
  </div>
</div>

<style>
  .center :global(.hero) {
    width: min(11.5rem, 46vw, 26dvh);
    --tilt: -3deg;
  }
  .verdict {
    width: 100%;
    padding: 1rem 1rem 1.1rem;
    --tilt: 1deg;
    animation-delay: 0.12s;
  }
  h2 {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    font-size: 1.9rem;
    font-weight: 700;
  }
  .badge {
    display: inline-flex;
    width: 2.3rem;
    height: 2.3rem;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    color: #fff;
    font-size: 1.35rem;
    border: var(--line) solid var(--ink);
  }
  .ok {
    background: var(--ok-bg);
  }
  .ok .badge {
    background: var(--ok);
  }
  .bad {
    background: var(--bad-bg);
  }
  .bad .badge {
    background: var(--bad);
  }
  .points {
    font-size: 2.6rem;
    font-weight: 700;
    line-height: 1.1;
    margin-top: 0.3rem;
    font-variant-numeric: tabular-nums;
  }
  .points small {
    font-size: 1.1rem;
    font-weight: 600;
  }
  .bonus {
    font-weight: 650;
    color: var(--a1);
  }
  .line {
    margin-top: 0.4rem;
    color: var(--ink-2);
    font-weight: 600;
  }
  .streak {
    background: var(--a1);
    color: #fff;
    font-size: 1.2rem;
    --tilt: -3deg;
    animation-delay: 0.3s;
  }
</style>
