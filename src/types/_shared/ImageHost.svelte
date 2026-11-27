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
  type Polygon = [number, number][];
  const solution = $derived(reveal ? (reveal.solution as { x?: number; y?: number; area?: Polygon[]; tolerance?: number }) : null);
  const area = $derived(solution?.area ?? null);

  // Haken-Marken: am Zielpunkt bzw. in der Mitte jedes Vielecks
  const badges = $derived.by((): { x: number; y: number }[] => {
    if (!solution) return [];
    if (!area) return solution.x === undefined || solution.y === undefined ? [] : [{ x: solution.x, y: solution.y }];
    return area.map((poly) => ({
      x: poly.reduce((s, p) => s + p[0], 0) / poly.length,
      y: poly.reduce((s, p) => s + p[1], 0) / poly.length,
    }));
  });
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
      {#if area}
        <!-- Zielfläche: doppelte Kontur (dunkel + hell), damit sie auf jedem Bild sichtbar ist -->
        <svg class="area" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
          {#each area as poly, i (i)}
            <polygon class="fill" points={poly.map((p) => p.join(',')).join(' ')} />
            <polygon class="outer" points={poly.map((p) => p.join(',')).join(' ')} />
            <polygon class="inner" points={poly.map((p) => p.join(',')).join(' ')} />
          {/each}
        </svg>
      {:else if solution && mode === 'pin' && solution.tolerance && badges[0]}
        <i class="zone" style="left:{badges[0].x * 100}%;top:{badges[0].y * 100}%;width:{solution.tolerance * 200}%"></i>
      {/if}
      {#each badges as b, i (i)}
        <div class="target" class:small={badges.length > 1} style="left:{b.x * 100}%;top:{b.y * 100}%">
          <span class="badge"><Icon name="check" /></span>
        </div>
      {/each}
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
  .area {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    animation: fade-in 0.6s 1.2s backwards;
  }
  .area polygon {
    fill: none;
    stroke-linejoin: round;
    vector-effect: non-scaling-stroke;
  }
  .area .fill {
    fill: rgba(0, 143, 104, 0.24);
  }
  .area .outer {
    stroke: var(--ink);
    stroke-width: 0.5rem;
  }
  .area .inner {
    stroke: #fff;
    stroke-width: 0.22rem;
  }
  /* Lösung: Haken-Marke, auf jedem Bild erkennbar */
  .target {
    position: absolute;
    width: 0;
    height: 0;
    z-index: 2;
  }
  .small {
    font-size: 0.7rem;
    scale: 0.7;
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
