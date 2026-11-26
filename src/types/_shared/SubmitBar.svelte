<script lang="ts">
  // Absende-Leiste für alle Typen mit mehrstufiger Eingabe (Auswahl, Schieberegler, Sortieren …).
  // Nach dem Senden bleibt die Antwort änderbar; jede Änderung muss neu gesendet werden.
  import Icon from '../../web/lib/Icon.svelte';

  let {
    ready,
    dirty,
    sent,
    locked,
    onsend,
    hint = 'Triff zuerst deine Wahl',
  }: {
    /** Eingabe vollständig genug zum Senden. */
    ready: boolean;
    /** Eingabe weicht von der zuletzt gesendeten Antwort ab. */
    dirty: boolean;
    /** Es wurde schon einmal gesendet. */
    sent: boolean;
    locked: boolean;
    onsend: () => void;
    hint?: string;
  } = $props();
</script>

<div class="bar">
  {#if locked}
    <div class="note"><Icon name="lock" /> Gesperrt</div>
  {:else if sent && !dirty}
    <div class="note ok pop-in"><Icon name="check" /> Gesendet – du kannst noch ändern</div>
  {:else}
    <button class="btn ok send" disabled={!ready} onclick={onsend}>
      <Icon name="send" />
      {!ready ? hint : sent ? 'Änderung senden' : 'Antwort senden'}
    </button>
  {/if}
</div>

<style>
  .bar {
    flex: none;
    min-height: 3.6rem;
    display: flex;
    align-items: stretch;
  }
  .send {
    width: 100%;
    font-size: 1.2rem;
  }
  .note {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5em;
    border: var(--line) dashed var(--ink);
    border-radius: var(--r-m);
    background: var(--paper);
    font-weight: 650;
  }
  .note.ok {
    background: var(--ok-bg);
    color: var(--ok);
    border-style: solid;
    border-color: var(--ok);
  }
</style>
