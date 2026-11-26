<script lang="ts">
  // Antwort-Buttons fürs Handy: eine Wahl (mcsa, poll) oder mehrere (mcma).
  // Jede Option hat Farbe UND Symbol; die Auswahl wird zusätzlich mit Haken und Rahmen markiert.
  import Icon from '../../web/lib/Icon.svelte';
  import Shape from '../../web/lib/Shape.svelte';
  import { same, type PlayerProps } from '../ui';
  import SubmitBar from './SubmitBar.svelte';

  let { q, value, locked, showText, submit, multi = false }: PlayerProps & { multi?: boolean } = $props();

  const options: string[] = $derived(q.data.options);
  const sentList = $derived<number[]>(value === undefined ? [] : multi ? (value as number[]) : [value as number]);
  // Entwurf bei Mehrfachauswahl; startet mit der schon gesendeten Antwort (Reconnect)
  let draft = $state<number[]>([]);
  let seeded = -1;
  $effect.pre(() => {
    if (seeded !== q.index) {
      seeded = q.index;
      draft = multi && Array.isArray(value) ? [...(value as number[])] : [];
    }
  });

  const chosen = $derived(multi ? draft : sentList);
  const dense = $derived(showText && options.some((o) => o.length > 24));

  function tap(i: number) {
    if (locked) return;
    if (!multi) return submit(i); // Tippen = antworten; erneutes Tippen ändert die Antwort
    draft = draft.includes(i) ? draft.filter((x) => x !== i) : [...draft, i].sort((a, b) => a - b);
  }
</script>

<div class="wrap">
  <div class="grid" class:dense class:symbols={!showText} class:has-choice={chosen.length > 0}>
    {#each options as text, i (i)}
      {@const on = chosen.includes(i)}
      <button
        class="opt opt-{i} rise-in"
        class:on
        style="animation-delay:{i * 60}ms"
        disabled={locked}
        aria-pressed={on}
        onclick={() => tap(i)}
      >
        <span class="shape"><Shape index={i} label /></span>
        {#if showText}<span class="text">{text}</span>{/if}
        <span class="mark" class:box={multi}>{#if on}<Icon name="check" />{/if}</span>
      </button>
    {/each}
  </div>
  {#if multi}
    <SubmitBar
      ready={draft.length > 0}
      dirty={!same(draft, value)}
      sent={value !== undefined}
      {locked}
      onsend={() => submit(draft)}
      hint="Wähle mindestens eine Antwort"
    />
  {/if}
</div>

<style>
  .wrap {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
  }
  .grid {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-auto-rows: 1fr;
    gap: 0.7rem;
  }
  .grid.dense {
    grid-template-columns: 1fr;
  }
  .opt {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    min-height: 3.6rem;
    padding: 0.6rem 0.7rem;
    border: var(--line) solid var(--ink);
    border-radius: var(--r-m);
    background: var(--c);
    color: var(--c-ink);
    box-shadow: var(--drop);
    font-weight: 650;
    font-size: 1.15rem;
    line-height: 1.15;
    text-align: center;
    /* Nach der Einblend-Animation gelten wieder die normalen transform-Regeln */
    animation-fill-mode: backwards;
    transition:
      transform 0.14s var(--ease-out),
      opacity 0.18s,
      box-shadow 0.14s;
  }
  .dense .opt {
    flex-direction: row;
    justify-content: flex-start;
    text-align: left;
    gap: 0.8rem;
    padding-right: 2.6rem;
  }
  .shape {
    font-size: 2.2rem;
  }
  .dense .shape {
    font-size: 1.7rem;
  }
  .symbols .shape {
    font-size: 4rem;
  }
  .text {
    min-width: 0;
  }
  .opt:active:not(:disabled) {
    transform: translateY(0.2rem) scale(0.98);
    box-shadow: 0 0.08rem 0 var(--ink);
  }
  /* Auswahl: nicht gewählte treten zurück, die gewählte bekommt Haken + Innenrahmen */
  .has-choice .opt:not(.on) {
    opacity: 0.45;
    transform: scale(0.96);
  }
  .opt.on {
    outline: 0.28rem solid #fff;
    outline-offset: -0.55rem;
  }
  .mark {
    position: absolute;
    top: 0.45rem;
    right: 0.45rem;
    width: 1.7rem;
    height: 1.7rem;
    display: none;
    align-items: center;
    justify-content: center;
    border: 0.16rem solid var(--ink);
    border-radius: 50%;
    background: #fff;
    color: var(--ink);
    font-size: 1rem;
  }
  .mark.box {
    display: flex;
    border-radius: 0.45rem;
  }
  .on .mark {
    display: flex;
  }
  .opt:disabled {
    cursor: default;
  }
</style>
