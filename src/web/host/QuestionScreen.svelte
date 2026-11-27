<script lang="ts">
  // Frage und Auflösung auf dem Host-Screen. Die Typ-Komponente bleibt von der Frage bis zur
  // Auflösung dieselbe Instanz, damit sie ihren Übergang selbst animieren kann.
  import Icon from '../lib/Icon.svelte';
  import { HOST_REVEAL, pick, type Mood } from '../lib/moods';
  import Sticker from '../lib/Sticker.svelte';
  import TimerBar from '../lib/TimerBar.svelte';
  import { HOST_UI } from '../../types/host';
  import { TYPE_LABELS } from '../../types/labels';
  import { game } from './game.svelte';

  const s = $derived(game.state!);
  const q = $derived(s.question!);
  const reveal = $derived(s.phase === 'reveal' ? (s.reveal ?? null) : null);
  const Ui = $derived(HOST_UI[q.type]);
  const ownImage = $derived(q.type === 'pin' || q.type === 'circle');
  const online = $derived(s.players.filter((p) => p.connected).length);
  const textSize = $derived(q.text.length > 150 ? 's' : q.text.length > 80 ? 'm' : 'l');

  const lockText = $derived(
    s.lockReason === 'all' ? 'Alle haben geantwortet!' : s.lockReason === 'host' ? 'Frage beendet' : 'Zeit um!',
  );

  // Wer kommentiert die Auflösung? Meist Quizzly – manchmal funkt Herry dazwischen.
  const reaction = $derived.by((): Mood | null => {
    if (!reveal) return null;
    const share = reveal.correct / Math.max(1, reveal.players);
    const pool =
      q.scoring === 'none'
        ? HOST_REVEAL.poll
        : reveal.answered === 0
          ? HOST_REVEAL.nobody
          : share >= 0.99
            ? HOST_REVEAL.all
            : share >= 0.6
              ? HOST_REVEAL.most
              : share > 0.25
                ? HOST_REVEAL.some
                : share > 0
                  ? HOST_REVEAL.few
                  : HOST_REVEAL.zero;
    return pick(pool, q.index);
  });
</script>

<div class="q">
  <div class="head card size-{textSize}" class:has-note={reveal?.explanation}>
    <span class="kind pill">{TYPE_LABELS[q.type].label}</span>
    <h2>{q.text}</h2>
    {#if reveal?.explanation}<p class="explain rise-in">{reveal.explanation}</p>{/if}
  </div>

  <div class="meter">
    {#if reveal}
      <div class="stats rise-in">
        {#if q.scoring !== 'none'}
          <span class="pill good"><Icon name="check" /> {reveal.correct} von {reveal.players} richtig</span>
        {/if}
        <span class="pill"><Icon name="users" /> {reveal.answered} {reveal.answered === 1 ? 'Antwort' : 'Antworten'}</span>
      </div>
      {#if reaction}
        <!-- Kommentar von Quizzly oder Herry: Sprechblase in der Zeile, Figur im rechten Rand -->
        <div class="reaction">
          <span class="bubble pop-in">{reaction.line}</span>
          <Sticker name={reaction.art} class="pop-in" />
        </div>
      {/if}
    {:else}
      <div class="timer">
        <TimerBar deadline={game.deadline} total={q.time * 1000} frozen={s.phase === 'locked'} />
      </div>
      {#if s.phase === 'locked'}
        <span class="pill locked pop-in"><Icon name="lock" /> {lockText}</span>
      {:else}
        <span class="pill answered"><Icon name="users" /> {game.answered} / {online}</span>
      {/if}
    {/if}
  </div>

  <div class="body" class:with-image={q.image && !ownImage}>
    {#if q.image && !ownImage}
      <div class="image drop-in">
        <img src={q.image.src} alt="" width={q.image.w} height={q.image.h} />
      </div>
    {/if}
    {#if Ui}
      {#key q.index}
        <Ui {q} {reveal} />
      {/key}
    {:else}
      <p class="unsupported">Fragetyp „{q.type}“ wird noch nicht unterstützt.</p>
    {/if}
  </div>
</div>

<style>
  .q {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 1.2rem;
    position: relative;
  }
  .head {
    flex: none;
    position: relative;
    padding: 1.5rem 2.4rem 1.3rem;
    border-width: 0.26rem;
    border-radius: 2rem;
    box-shadow: var(--drop-l);
    text-align: center;
    transform: rotate(-0.35deg);
  }
  .kind {
    position: absolute;
    top: -1.1rem;
    left: 2rem;
    font-size: 1.3rem;
    background: var(--honey);
    transform: rotate(-2.5deg);
  }
  h2 {
    font-weight: 700;
    line-height: 1.12;
  }
  .size-l h2 { font-size: 4rem; }
  .size-m h2 { font-size: 3.1rem; }
  .size-s h2 { font-size: 2.4rem; }
  .explain {
    margin-top: 0.6rem;
    font-size: 1.9rem;
    font-weight: 600;
    color: var(--ink-2);
  }

  .meter {
    flex: none;
    height: 3.6rem;
    display: flex;
    align-items: center;
    gap: 1.4rem;
    font-size: 1.9rem;
  }
  .timer {
    flex: 1;
    font-size: 2rem;
  }
  .answered {
    font-variant-numeric: tabular-nums;
  }
  .locked {
    background: var(--ink);
    color: #fff;
    --tilt: -2deg;
  }
  .stats {
    display: flex;
    gap: 1rem;
  }
  .good {
    background: var(--ok);
    color: #fff;
  }

  .body {
    flex: 1;
    min-height: 0;
    display: flex;
    gap: 2rem;
  }
  .image {
    flex: 0 1 44%;
    min-width: 0;
    display: grid;
    place-items: center;
    --tilt: -1deg;
  }
  .image img {
    max-width: 100%;
    max-height: 100%;
    width: auto;
    height: auto;
    object-fit: contain;
    border: 0.26rem solid var(--ink);
    border-radius: 1.6rem;
    box-shadow: var(--drop-l);
    background: #fff;
  }
  .unsupported {
    margin: auto;
    font-size: 2.4rem;
    font-weight: 600;
  }

  .reaction {
    position: relative;
    margin-left: auto;
    padding-right: 4.2rem;
    z-index: 3;
    pointer-events: none;
  }
  .reaction :global(.sticker) {
    position: absolute;
    right: -6.1rem;
    top: 50%;
    width: 9.4rem;
    translate: 0 -50%;
    --tilt: 6deg;
    --delay: 0.7s;
  }
  .bubble {
    display: block;
    padding: 0.25rem 1.1rem;
    border: 0.2rem solid var(--ink);
    border-radius: 1.2rem 1.2rem 0.2rem 1.2rem;
    background: #fff;
    font-size: 1.6rem;
    font-weight: 650;
    box-shadow: var(--drop);
    --tilt: -1.5deg;
    animation-delay: 0.5s;
  }
</style>
