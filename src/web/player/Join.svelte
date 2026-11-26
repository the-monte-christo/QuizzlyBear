<script lang="ts">
  import Sticker from '../lib/Sticker.svelte';
  import { game } from './game.svelte';

  // Der QR-Code auf dem Host-Screen führt auf /?pin=123456
  let pin = $state(new URLSearchParams(location.search).get('pin')?.replace(/\D/g, '').slice(0, 6) ?? '');
  let name = $state(game.savedName);

  const ready = $derived(pin.length === 6 && name.trim().length > 0 && !game.joining);

  function go(e: SubmitEvent) {
    e.preventDefault();
    if (ready) game.join(pin, name.trim());
  }
</script>

<div class="join">
  <div class="logo drop-in">
    <Sticker name="bear-wave" small alt="Quizzly, der Quizzlybär" class="bob" />
    <h1>Quizzly<span>Bear</span></h1>
  </div>

  <form class="card form rise-in" onsubmit={go}>
    <label>
      <span>Spiel-PIN</span>
      <input
        class="field pin"
        inputmode="numeric"
        autocomplete="off"
        pattern="[0-9]*"
        maxlength="6"
        placeholder="123456"
        value={pin}
        oninput={(e) => (pin = e.currentTarget.value = e.currentTarget.value.replace(/\D/g, '').slice(0, 6))}
      />
    </label>
    <label>
      <span>Dein Name</span>
      <input class="field" maxlength="16" autocomplete="nickname" autocapitalize="words" placeholder="z. B. Honigdachs" bind:value={name} />
    </label>
    {#if game.error}
      <p class="error shake" role="alert">{game.error}</p>
    {/if}
    <button class="btn go" disabled={!ready}>{game.joining ? 'Moment …' : "Los geht's!"}</button>
  </form>

  <img class="herry" src="/art/herry-hey-s.webp" alt="" />
</div>

<style>
  .join {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 1.2rem;
    padding-bottom: 1.5rem;
    position: relative;
  }
  .logo {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .logo :global(.sticker) {
    width: min(9.5rem, 22dvh);
    --tilt: -3deg;
  }
  h1 {
    font-size: 2.9rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    transform: rotate(-2deg);
    margin-top: 0.5rem;
    padding: 0 1.1rem;
    border: var(--line) solid var(--ink);
    border-radius: 99rem;
    background: var(--paper);
    box-shadow: var(--drop);
    color: var(--ink);
  }
  h1 span {
    color: var(--a1);
  }
  .form {
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
    padding: 1.1rem;
    transform: rotate(0.6deg);
    z-index: 1;
  }
  label span {
    display: block;
    font-weight: 650;
    margin: 0 0 0.25rem 0.3rem;
  }
  .pin {
    font-size: 2rem;
    letter-spacing: 0.22em;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }
  .go {
    font-size: 1.35rem;
    padding: 0.75em;
  }
  .error {
    padding: 0.6rem 0.8rem;
    border: var(--line) solid var(--bad);
    border-radius: var(--r-s);
    background: var(--bad-bg);
    color: var(--bad);
    font-weight: 600;
  }
  /* Herry lugt frech von unten rechts herein */
  .herry {
    position: absolute;
    right: -0.6rem;
    bottom: -3.4rem;
    width: 6rem;
    transform: rotate(-14deg);
    pointer-events: none;
  }
</style>
