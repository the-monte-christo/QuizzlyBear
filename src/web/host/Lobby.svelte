<script lang="ts">
  import Icon from '../lib/Icon.svelte';
  import Sticker from '../lib/Sticker.svelte';
  import { game } from './game.svelte';
  import Qr from './Qr.svelte';

  let { joinUrl }: { joinUrl: string } = $props();

  const s = $derived(game.state!);
  const shortUrl = $derived(joinUrl.replace(/^https?:\/\//, '').replace(/\/$/, ''));
  const digits = $derived(s.pin.split(''));

  // feste, „zufällige“ Neigung je Spieler, damit die Namen nicht bei jedem Update springen
  const tilt = (id: string) => {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
    return ((h % 9) + 9) % 9 - 4;
  };
  const many = $derived(s.players.length > 24);
</script>

<div class="lobby">
  <section class="join card drop-in">
    <h2>Mach mit!</h2>
    <div class="how">
      <div class="qr"><Qr text="{joinUrl}/?pin={s.pin}" /></div>
      <ol>
        <li><span class="step">1</span> QR-Code scannen</li>
        <li class="or">oder <b>{shortUrl}</b> öffnen</li>
        <li><span class="step">2</span> PIN eingeben:</li>
      </ol>
    </div>
    <div class="pin" aria-label="Spiel-PIN {s.pin}">
      {#each digits as d, i (i)}
        <span class="digit pop-in" style="--tilt:{i % 2 ? 3 : -3}deg;animation-delay:{0.25 + i * 0.07}s">{d}</span>
      {/each}
    </div>
  </section>

  <section class="who">
    <div class="who-head">
      <span class="title-sticker count"><Icon name="users" /> {s.players.length}</span>
      <span class="title-sticker label">{s.players.length === 1 ? 'ist dabei' : 'sind dabei'}</span>
    </div>
    <div class="names" class:many>
      {#each s.players as p (p.id)}
        <button
          class="name pop-in opt-{Math.abs(tilt(p.id) + 4) % 6}"
          class:off={!p.connected}
          style="--tilt:{tilt(p.id)}deg"
          title="Klicken, um {p.name} zu entfernen"
          onclick={() => game.kick(p.id)}
        >
          {p.name}
        </button>
      {:else}
        <p class="waiting">Warte auf die ersten Mitspieler …</p>
      {/each}
    </div>
  </section>

  <Sticker name="bear-wave" class="bear bob" />
  <Sticker name="herry-hey" class="herry" ground={false} />
</div>

<style>
  .lobby {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: 46rem 1fr;
    gap: 3rem;
    padding-top: 1rem;
    position: relative;
  }
  .join {
    align-self: start;
    padding: 1.6rem 2.2rem 2.2rem;
    --tilt: -1.5deg;
    transform: rotate(-1.5deg);
    border-width: 0.26rem;
    box-shadow: var(--drop-l);
  }
  h2 {
    font-size: 4rem;
    font-weight: 700;
    line-height: 1;
    margin-bottom: 1.2rem;
  }
  .how {
    display: flex;
    gap: 1.8rem;
    align-items: center;
  }
  .qr {
    flex: none;
    width: 17rem;
    padding: 0.5rem;
    border: 0.22rem solid var(--ink);
    border-radius: 1.2rem;
    background: #fff;
  }
  ol {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
    font-size: 1.9rem;
    font-weight: 600;
    line-height: 1.2;
  }
  .step {
    display: inline-grid;
    place-items: center;
    width: 1.5em;
    height: 1.5em;
    margin-right: 0.3em;
    border-radius: 50%;
    background: var(--ink);
    color: #fff;
    font-weight: 700;
  }
  .or {
    padding-left: 2.2em;
    font-size: 1.55rem;
    color: var(--ink-2);
  }
  .or b {
    color: var(--ink);
    font-weight: 700;
  }
  .pin {
    display: flex;
    justify-content: center;
    gap: 0.9rem;
    margin-top: 1.8rem;
  }
  .digit {
    width: 5.6rem;
    height: 7.2rem;
    display: grid;
    place-items: center;
    border: 0.26rem solid var(--ink);
    border-radius: 1.2rem;
    background: var(--honey);
    box-shadow: var(--drop-l);
    font-size: 5.6rem;
    font-weight: 700;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  .digit:nth-child(3n + 2) {
    background: var(--a4);
  }
  .digit:nth-child(3n) {
    background: var(--paper);
  }

  .who {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1.6rem;
    padding-bottom: 8rem;
  }
  .who-head {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  .count {
    background: var(--a1);
    color: #fff;
    transform: rotate(-3deg);
  }
  .label {
    transform: rotate(1.5deg);
    font-size: 2.6rem;
  }
  .names {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-wrap: wrap;
    align-content: flex-start;
    gap: 1.1rem 1.1rem;
    overflow: hidden;
    padding: 0.6rem 0.4rem;
    font-size: 2.3rem;
  }
  .names.many {
    font-size: 1.6rem;
    gap: 0.7rem;
  }
  .name {
    padding: 0.2em 0.75em;
    border: 0.22rem solid var(--ink);
    border-radius: 99rem;
    background: var(--c);
    color: var(--c-ink);
    box-shadow: var(--drop);
    font-weight: 650;
    font-size: inherit;
    animation-fill-mode: backwards;
    transform: rotate(var(--tilt));
  }
  .name.off {
    opacity: 0.45;
  }
  .name:hover {
    text-decoration: line-through;
  }
  .waiting {
    align-self: flex-start;
    margin-top: 1.5rem;
    padding: 0.4em 1em;
    border-radius: 99rem;
    background: rgba(255, 251, 240, 0.88);
    font-size: 2.2rem;
    font-weight: 600;
  }
  .lobby :global(.bear) {
    position: absolute;
    left: 33rem;
    bottom: -3rem;
    width: 15rem;
    --tilt: 4deg;
  }
  /* Herry lugt vom rechten Rand herein */
  .lobby :global(.herry) {
    position: absolute;
    right: -9rem;
    bottom: 16rem;
    width: 11rem;
    transform: rotate(-24deg);
  }
</style>
