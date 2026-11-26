<script lang="ts">
  // Auflösung auf dem Handy: richtig/falsch immer mit Symbol + Text, dazu Punkte und Serie.
  import Icon from '../lib/Icon.svelte';
  import Sticker, { type Art } from '../lib/Sticker.svelte';
  import { game } from './game.svelte';

  const s = $derived(game.state!);
  const r = $derived(s.result);
  const q = $derived(s.question!);

  // Herry, der kleine Störenfried, kommentiert Fehlversuche
  const TEASE = [
    'Herry lacht sich schlapp.',
    'Herry meint: Das war wohl nix.',
    'Herry kichert. Einfach ignorieren.',
    'Herry hätte es auch nicht gewusst.',
    'Herry sagt: Knapp daneben ist auch vorbei.',
  ];

  type Mood = { art: Art; title: string; tone: 'ok' | 'bad' | 'mid' | 'none'; line?: string };
  const mood = $derived.by((): Mood => {
    if (!r || !r.answered) return { art: 'bear-clock', title: 'Keine Antwort', tone: 'bad', line: 'Beim nächsten Mal schneller!' };
    if (r.correct === null) return { art: 'bear-wave', title: 'Danke für deine Stimme!', tone: 'none' };
    if (q.scoring === 'proximity') {
      if (r.fraction >= 0.9) return { art: 'bear-cheer', title: 'Volltreffer!', tone: 'ok' };
      if (r.correct) return { art: 'bear-cheer', title: 'Nah dran!', tone: 'ok' };
      if (r.fraction > 0) return { art: 'bear-think', title: 'Knapp daneben', tone: 'mid', line: 'Ein paar Punkte gibt es trotzdem.' };
      return { art: 'herry-laugh', title: 'Daneben', tone: 'bad', line: TEASE[q.index % TEASE.length] };
    }
    if (r.correct) return { art: 'bear-cheer', title: 'Richtig!', tone: 'ok' };
    if (r.fraction > 0) return { art: 'bear-think', title: 'Teilweise richtig', tone: 'mid' };
    return { art: 'herry-laugh', title: 'Leider falsch', tone: 'bad', line: TEASE[q.index % TEASE.length] };
  });

  const total = $derived((r?.points ?? 0) + (r?.bonus ?? 0));
</script>

<div class="stage">
  <div class="center">
    {#key q.index}
      <Sticker name={mood.art} small class="hero pop-in" />
      <div class="card verdict {mood.tone} pop-in">
        <h2>
          {#if mood.tone === 'ok'}<span class="badge"><Icon name="check" /></span>
          {:else if mood.tone === 'bad'}<span class="badge"><Icon name="cross" /></span>{/if}
          {mood.title}
        </h2>
        {#if q.scoring !== 'none'}
          <p class="points">+{total} <small>Punkte</small></p>
          {#if r?.bonus}<p class="bonus"><Icon name="flame" /> davon {r.bonus} Serien-Bonus</p>{/if}
        {/if}
        {#if mood.line}<p class="line">{mood.line}</p>{/if}
      </div>
      {#if s.me.streak >= 2}
        <p class="pill streak pop-in"><Icon name="flame" /> {s.me.streak}er-Serie!</p>
      {/if}
    {/key}
  </div>
</div>

<style>
  .center :global(.hero) {
    width: min(11.5rem, 46vw);
    max-height: 32dvh;
    object-fit: contain;
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
