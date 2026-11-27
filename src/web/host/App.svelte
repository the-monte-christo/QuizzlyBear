<script lang="ts">
  import { onMount } from 'svelte';
  import Backdrop from '../lib/Backdrop.svelte';
  import Icon from '../lib/Icon.svelte';
  import Sticker from '../lib/Sticker.svelte';
  import { TYPE_LABELS } from '../../types/labels';
  import Final from './Final.svelte';
  import { game } from './game.svelte';
  import Leaderboard from './Leaderboard.svelte';
  import Lobby from './Lobby.svelte';
  import QuestionScreen from './QuestionScreen.svelte';

  const s = $derived(game.state);
  const view = $derived(game.view);

  // Adresse für QR-Code und Anzeige. Lokal (localhost) hilft der Server mit der LAN-Adresse aus.
  let joinUrl = $state(location.origin);
  onMount(async () => {
    try {
      const info = await (await fetch('/api/info')).json();
      if (info.publicUrl) joinUrl = info.publicUrl;
      else if (['localhost', '127.0.0.1'].includes(location.hostname) && info.lan?.[0]) {
        joinUrl = `${location.protocol}//${info.lan[0]}${location.port ? `:${location.port}` : ''}`;
      }
    } catch {
      /* dann eben die aktuelle Adresse */
    }
  });

  let count = $state(3);
  $effect(() => {
    if (view !== 'countdown') return;
    const tick = () => (count = Math.max(1, Math.ceil((game.revealAt - performance.now()) / 1000)));
    tick();
    const t = setInterval(tick, 100);
    return () => clearInterval(t);
  });

  /** Beschriftung des Weiter-Knopfs; null = gerade nichts zu tun. */
  const nextLabel = $derived.by((): string | null => {
    if (!s) return null;
    switch (view) {
      case 'lobby':
        return 'Quiz starten';
      case 'question':
        return s.phase === 'locked' ? null : 'Frage beenden';
      case 'reveal':
        if (s.isLast) return 'Zur Siegerehrung';
        return s.question?.scoring === 'none' ? 'Nächste Frage' : 'Rangliste';
      case 'leaderboard':
        return 'Nächste Frage';
      case 'final':
        return s.final && s.final.step < s.final.reveal.length ? `Platz ${s.final.reveal[s.final.step]} enthüllen` : null;
      default:
        return null;
    }
  });
  const quiet = $derived(view === 'question');

  function onkey(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement) return;
    if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight' || e.key === 'PageDown') {
      e.preventDefault();
      if (nextLabel && !e.repeat) game.next();
    } else if (e.key === 'f' || e.key === 'F') {
      fullscreen();
    }
  }

  function fullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  }

  let menu = $state(false);
</script>

<svelte:window onkeydown={onkey} />

<Backdrop variant="host" mood={view === 'question' || view === 'reveal' ? 'calm' : 'full'} />

<div class="screen">
  {#if view === 'gone'}
    <div class="msg">
      <Sticker name="bear-oops" class="bob" />
      <h1 class="title-sticker">Dieses Spiel gibt es nicht (mehr).</h1>
      <a class="btn honey" href="/admin/">Zur Quiz-Übersicht</a>
    </div>
  {:else if !s}
    <div class="msg"><Sticker name="bear-think" class="bob" /><h1 class="title-sticker">Verbinde …</h1></div>
  {:else}
    <header class="top">
      <div class="brand">
        <img src="/art/bear-head-s.webp" alt="" />
        <span>Quizzly<b>Bear</b></span>
      </div>
      <div class="mid">
        {#if s.question && view !== 'final'}
          <span class="pill">Frage {s.question.index + 1} von {s.question.total}</span>
        {:else}
          <span class="pill quiz">{s.quizTitle}</span>
        {/if}
      </div>
      <div class="right">
        {#if view !== 'lobby'}
          <span class="pill pin">PIN {s.pin}</span>
        {/if}
        <button class="tool" title="Einstellungen" aria-label="Einstellungen" onclick={() => (menu = !menu)}><Icon name="gear" /></button>
        <button class="tool" title="Vollbild (F)" aria-label="Vollbild" onclick={fullscreen}><Icon name="expand" /></button>
      </div>
      {#if menu}
        <div class="menu card pop-in">
          <h3><Icon name="phone" /> Auf dem Handy</h3>
          <label>
            <input type="checkbox" checked={s.phone.showQuestion} onchange={(e) => game.setPhone({ showQuestion: e.currentTarget.checked })} />
            Fragetext anzeigen
          </label>
          <label>
            <input
              type="checkbox"
              checked={s.phone.showAnswerText}
              onchange={(e) => game.setPhone({ showAnswerText: e.currentTarget.checked })}
            />
            Antworttexte anzeigen <small>(sonst nur Farbe + Symbol)</small>
          </label>
          <a href="/admin/">Zur Quiz-Übersicht</a>
        </div>
      {/if}
    </header>

    {#if view === 'lobby'}
      <Lobby {joinUrl} />
    {:else if view === 'countdown' && s.question}
      <div class="countdown">
        <p class="title-sticker kind drop-in">{TYPE_LABELS[s.question.type].label}</p>
        {#key count}
          <div class="num pop-in">{count}</div>
        {/key}
        <p class="hint plate">{TYPE_LABELS[s.question.type].hint}</p>
        <!-- Herry schießt einmal quer durchs Bild -->
        {#key s.question.index}
          <Sticker name="herry-swim" class="swim" />
        {/key}
      </div>
    {:else if view === 'question' || view === 'reveal'}
      <QuestionScreen />
    {:else if view === 'leaderboard'}
      <Leaderboard />
    {:else if view === 'final'}
      <Final />
    {/if}

    {#if nextLabel}
      <button class="btn next" class:quiet class:honey={!quiet} class:big={view === 'lobby'} onclick={() => game.next()}>
        {nextLabel}
        <Icon name="next" />
      </button>
    {:else if view === 'final'}
      <a class="btn next plain" href="/admin/">Fertig</a>
    {/if}

    {#if !game.online}
      <div class="offline pop-in"><Icon name="wifi-off" /> Verbindung zum Server verloren – verbinde neu …</div>
    {/if}
  {/if}
</div>

<style>
  .top {
    flex: none;
    height: 4.2rem;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    margin-bottom: 1.3rem;
    position: relative;
    z-index: 5;
  }
  .brand {
    justify-self: start;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.1rem 1.2rem 0.1rem 0.3rem;
    border: 0.2rem solid var(--ink);
    border-radius: 99rem;
    background: var(--paper);
    box-shadow: var(--drop);
    font-size: 2rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    transform: rotate(-1.5deg);
    transform-origin: left center;
  }
  .brand img {
    width: 3.4rem;
    margin: -0.5rem 0 -0.3rem -0.6rem;
  }
  .brand b {
    color: var(--a1);
    font-weight: 700;
  }
  .mid .pill {
    font-size: 1.7rem;
    border-width: 0.2rem;
  }
  .quiz {
    max-width: 50rem;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .right {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 0.7rem;
  }
  .pin {
    font-size: 1.5rem;
    background: var(--honey-light);
    font-variant-numeric: tabular-nums;
  }
  .tool {
    width: 2.9rem;
    height: 2.9rem;
    display: grid;
    place-items: center;
    border: 0.18rem solid var(--ink);
    border-radius: 50%;
    background: var(--paper);
    font-size: 1.5rem;
    box-shadow: var(--drop);
  }
  .tool:hover,
  .tool:focus-visible {
    background: var(--honey-light);
  }
  .menu {
    position: absolute;
    right: 0;
    top: 4.6rem;
    width: 30rem;
    padding: 1.2rem 1.4rem;
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
    font-size: 1.4rem;
    font-weight: 600;
    transform-origin: top right;
  }
  .menu h3 {
    font-size: 1.6rem;
  }
  .menu label {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    cursor: pointer;
  }
  .menu small {
    color: var(--ink-2);
  }
  .menu input {
    width: 1.5rem;
    height: 1.5rem;
    accent-color: var(--a0);
  }
  .menu a {
    color: var(--a0);
  }

  .msg {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2rem;
  }
  .msg :global(.sticker) {
    width: 20rem;
  }

  .countdown {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2.4rem;
    position: relative;
  }
  .kind {
    --tilt: -2deg;
    background: var(--a0);
    color: #fff;
  }
  .num {
    width: 24rem;
    height: 24rem;
    display: grid;
    place-items: center;
    border: 0.5rem solid var(--ink);
    border-radius: 50%;
    background: var(--paper);
    box-shadow: 0 0.9rem 0 var(--ink), 0 2.4rem 3.2rem -0.4rem var(--soft);
    font-size: 17rem;
    font-weight: 700;
    line-height: 1;
    --tilt: -4deg;
  }
  .hint {
    font-size: 2.4rem;
    font-weight: 650;
  }
  .countdown :global(.swim) {
    position: absolute;
    left: 0;
    top: 62%;
    width: 22rem;
    animation: swim 2.7s cubic-bezier(0.4, 0, 0.6, 1) 0.2s both;
    will-change: transform;
  }
  @keyframes swim {
    0% { transform: translate(-40rem, 3rem) rotate(8deg); }
    50% { transform: translate(44rem, -3rem) rotate(-6deg); }
    100% { transform: translate(130rem, 2rem) rotate(6deg); }
  }

  .next {
    position: absolute;
    right: 6.5rem;
    bottom: 0.95rem;
    z-index: 6;
    font-size: 1.5rem;
    padding: 0.4em 1.1em;
    border-width: 0.22rem;
  }
  .next.big {
    font-size: 2.1rem;
    bottom: 1.6rem;
    box-shadow: var(--drop-l);
  }
  /* Während der Frage soll der Knopf nicht ablenken */
  .next.quiet {
    font-size: 1.15rem;
    background: var(--paper);
    color: var(--ink);
    opacity: 0.4;
  }
  .next.quiet:hover {
    opacity: 1;
  }
  .offline {
    position: absolute;
    left: 50%;
    bottom: 0.9rem;
    translate: -50% 0;
    padding: 0.7rem 1.6rem;
    border: 0.22rem solid var(--ink);
    border-radius: 99rem;
    background: var(--bad);
    color: #fff;
    font-size: 1.6rem;
    font-weight: 650;
    z-index: 20;
  }
</style>
