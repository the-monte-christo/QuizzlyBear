<script lang="ts">
  import Icon from '../lib/Icon.svelte';
  import TimerBar from '../lib/TimerBar.svelte';
  import { PLAYER_UI } from '../../types/player';
  import { TYPE_LABELS } from '../../types/labels';
  import { game } from './game.svelte';

  const s = $derived(game.state!);
  const q = $derived(s.question!);
  const Ui = $derived(PLAYER_UI[q.type]);
  // Bild-Typen (pin, circle) zeigen ihr Bild selbst
  const ownImage = $derived(q.type === 'pin' || q.type === 'circle');
  const lockText = $derived(
    s.lockReason === 'all' ? 'Alle haben geantwortet!' : s.lockReason === 'host' ? 'Frage beendet' : 'Zeit um!',
  );
</script>

<div class="stage">
  <div class="top">
    <span class="pill count">{q.index + 1}/{q.total}</span>
    <TimerBar deadline={game.deadline} total={q.time * 1000} frozen={s.phase === 'locked'} />
  </div>

  {#if s.phone.showQuestion}
    <div class="card qtext" class:with-img={q.image && !ownImage}>
      {#if q.image && !ownImage}
        <img src={q.image.src} alt="" width={q.image.w} height={q.image.h} />
      {/if}
      <p>{q.text}</p>
    </div>
  {:else}
    <p class="look pill"><Icon name="expand" /> Frage auf dem großen Bildschirm</p>
  {/if}

  {#if Ui}
    {#key q.index}
      <Ui {q} value={game.answer?.value} locked={game.locked} showText={s.phone.showAnswerText} submit={(v) => game.submit(v)} />
    {/key}
  {:else}
    <div class="center"><p>Dieser Fragetyp wird von deiner App-Version nicht unterstützt.</p></div>
  {/if}

  <div class="status" aria-live="polite">
    {#if game.locked}
      <span class="pill lock pop-in"><Icon name="lock" /> {lockText}</span>
    {:else if game.answer && !game.answer.sent}
      <span class="muted">Sende …</span>
    {:else if game.answer && (q.type === 'mcsa' || q.type === 'poll')}
      <span class="pill sent pop-in"><Icon name="check" /> Antwort ist drin – ändern ist erlaubt</span>
    {:else if !game.answer}
      <span class="muted">{TYPE_LABELS[q.type].hint}</span>
    {/if}
  </div>
</div>

<style>
  .top {
    flex: none;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-size: 1.05rem;
  }
  .count {
    font-variant-numeric: tabular-nums;
  }
  .qtext {
    flex: none;
    padding: 0.7rem 0.9rem;
    font-size: 1.15rem;
    font-weight: 600;
    line-height: 1.2;
    max-height: 34%;
    overflow-y: auto;
    transform: rotate(-0.4deg);
  }
  .qtext.with-img {
    display: flex;
    gap: 0.7rem;
    align-items: center;
  }
  .qtext img {
    flex: none;
    width: 34%;
    max-height: 7rem;
    height: auto;
    object-fit: contain;
    border-radius: var(--r-s);
    border: 0.12rem solid var(--ink);
    background: #fff;
  }
  .look {
    align-self: center;
    flex: none;
    font-size: 0.95rem;
  }
  .status {
    flex: none;
    min-height: 2.1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    font-size: 0.98rem;
    font-weight: 600;
  }
  .sent {
    background: var(--ok-bg);
    color: var(--ok);
    border-color: var(--ok);
    white-space: normal;
  }
  .lock {
    background: var(--ink);
    color: #fff;
  }
</style>
