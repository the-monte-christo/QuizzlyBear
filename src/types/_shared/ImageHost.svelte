<script lang="ts">
  // Bild auf dem Host für pin und circle. Bei der Auflösung liegen alle Antworten der Runde
  // halbtransparent übereinander, darüber die Lösung.
  import Icon from '../../web/lib/Icon.svelte';
  import type { HostProps } from '../ui';

  let { q, reveal, mode }: HostProps & { mode: 'pin' | 'circle' } = $props();
  const image = $derived(q.image!);

  interface Mark {
    x: number;
    y: number;
    r?: number;
  }
  const marks = $derived<Mark[]>(reveal ? (mode === 'pin' ? reveal.summary.points : reveal.summary.circles) : []);
  const solution = $derived(reveal ? (reveal.solution as { x: number; y: number; tolerance?: number }) : null);
</script>

<div class="frame">
  {#if image}
    <div class="pic drop-in" style="--ratio:{image.w / image.h}">
      <img src={image.src} alt="" width={image.w} height={image.h} />
      {#each marks as m, i (i)}
        {#if mode === 'circle'}
          <i class="guess ring" style="left:{m.x * 100}%;top:{m.y * 100}%;width:{(m.r ?? 0) * 200}%;animation-delay:{Math.min(1.2, i * 0.05)}s"></i>
        {:else}
          <i class="guess pin" style="left:{m.x * 100}%;top:{m.y * 100}%;animation-delay:{Math.min(1.2, i * 0.05)}s"></i>
        {/if}
      {/each}
      {#if solution}
        {#if mode === 'pin' && solution.tolerance}
          <i class="zone" style="left:{solution.x * 100}%;top:{solution.y * 100}%;width:{solution.tolerance * 200}%"></i>
        {/if}
        <div class="target" style="left:{solution.x * 100}%;top:{solution.y * 100}%">
          <span class="badge"><Icon name="check" /></span>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .frame {
    flex: 1;
    min-width: 0;
    min-height: 0;
    display: grid;
    place-items: center;
    container-type: size;
  }
  .pic {
    position: relative;
    width: min(100cqw, 100cqh * var(--ratio));
    aspect-ratio: var(--ratio);
    border: 0.26rem solid var(--ink);
    border-radius: 1.4rem;
    box-shadow: var(--drop-l);
    overflow: hidden;
    background: #fff;
    --tilt: 0deg;
  }
  img {
    display: block;
    width: 100%;
    height: 100%;
  }
  .guess {
    position: absolute;
    translate: -50% -50%;
    border-radius: 50%;
    animation: guess-in 0.4s var(--ease-pop) backwards;
  }
  @keyframes guess-in {
    from {
      transform: scale(0.2);
      opacity: 0;
    }
  }
  .pin {
    width: 1.9rem;
    height: 1.9rem;
    border: 0.22rem solid #fff;
    background: rgba(0, 114, 178, 0.6);
    box-shadow: 0 0 0 0.12rem rgba(46, 26, 11, 0.7);
  }
  .ring {
    aspect-ratio: 1;
    border: 0.2rem solid rgba(255, 255, 255, 0.9);
    background: rgba(0, 114, 178, 0.2);
    box-shadow: 0 0 0 0.1rem rgba(46, 26, 11, 0.6);
  }
  /* Bereich mit vollen Punkten */
  .zone {
    position: absolute;
    aspect-ratio: 1;
    translate: -50% -50%;
    border: 0.22rem dashed #fff;
    border-radius: 50%;
    box-shadow: 0 0 0 0.12rem var(--ink);
    animation: fade-in 0.5s 1.3s backwards;
  }
  /* Lösung: Haken-Marke, auf jedem Bild erkennbar */
  .target {
    position: absolute;
    width: 0;
    height: 0;
    z-index: 2;
  }
  .badge {
    position: absolute;
    left: 0;
    top: 0;
    width: 3.4rem;
    height: 3.4rem;
    margin: -1.7rem 0 0 -1.7rem;
    display: grid;
    place-items: center;
    border: 0.3rem solid #fff;
    border-radius: 50%;
    background: var(--ok);
    color: #fff;
    font-size: 1.8rem;
    box-shadow:
      0 0 0 0.2rem var(--ink),
      0 0.5rem 1rem rgba(0, 0, 0, 0.45);
    animation:
      pop-in 0.5s var(--ease-pop) 1.3s backwards,
      pulse 1.1s ease-in-out 1.8s 3;
  }
</style>
