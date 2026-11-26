<script lang="ts">
  // Hintergrund in Ebenen, von hinten nach vorn:
  //   1. gemaltes Motiv (WebP), 2. Licht: heller Fleck hinter dem Inhalt + dunklere Ecken,
  //   3. Waben nur als Akzent in den Ecken, 4. Sticker in drei Tiefenebenen.
  // Alles außer den Stickern ist statisch; die Sticker bewegen sich nur per transform.
  import { DECO, decoSrc } from './deco';

  let {
    variant = 'host',
    mood = 'full',
  }: {
    variant?: 'host' | 'phone';
    /** full = Lobby/Siegerehrung, calm = Frage/Auflösung (höchstens 2–3 Sticker), none = keine Sticker */
    mood?: 'full' | 'calm' | 'none';
  } = $props();
</script>

<div class="backdrop {variant}" aria-hidden="true">
  <div class="scene"></div>
  <div class="light"></div>
  <div class="comb"></div>
  {#each DECO[variant] as d, i (d.img + d.layer)}
    <img
      class="deco {d.layer}"
      class:gone={mood === 'none' || (mood === 'calm' && !d.calm)}
      src={decoSrc(d)}
      alt=""
      decoding="async"
      style="left:{d.x}%;top:{d.y}%;width:{d.size * 1.32}rem;--tilt:{d.tilt}deg;animation-duration:{d.dur}s;animation-delay:{-i *
        2.3}s"
    />
  {/each}
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: -1;
    overflow: hidden;
    background: #f1dc92;
    contain: strict;
  }
  .scene,
  .light,
  .comb {
    position: absolute;
    inset: 0;
  }
  .scene {
    background: url('/art/bg-host.webp') center / cover no-repeat;
  }
  .phone .scene {
    background-image: url('/art/bg-phone.webp');
  }
  /* Lichtfleck hinter dem Inhalt, Vignette in den Ecken */
  .light {
    background:
      radial-gradient(ellipse 60% 56% at 50% 47%, rgba(255, 252, 236, 0.86) 0%, rgba(255, 252, 236, 0.5) 46%, rgba(255, 252, 236, 0) 78%),
      radial-gradient(ellipse 78% 82% at 50% 50%, rgba(58, 30, 4, 0) 58%, rgba(58, 30, 4, 0.5) 100%);
  }
  .phone .light {
    background:
      radial-gradient(ellipse 95% 62% at 50% 46%, rgba(255, 252, 236, 0.9) 0%, rgba(255, 252, 236, 0.55) 50%, rgba(255, 252, 236, 0) 85%),
      radial-gradient(ellipse 95% 80% at 50% 50%, rgba(58, 30, 4, 0) 60%, rgba(58, 30, 4, 0.42) 100%);
  }
  /* Waben: doppelt so große Kacheln, zur Mitte hin ausgeblendet – nur in den Ecken sichtbar */
  .comb {
    background-image: url('/art/honeycomb.svg');
    background-size: 10.4rem auto;
    opacity: 0.5;
    -webkit-mask-image: radial-gradient(ellipse 72% 76% at 50% 50%, transparent 66%, #000 100%);
    mask-image: radial-gradient(ellipse 72% 76% at 50% 50%, transparent 66%, #000 100%);
  }

  .deco {
    position: absolute;
    height: auto;
    translate: -50% -50%;
    animation: drift ease-in-out infinite;
    will-change: transform;
    transition: opacity 0.7s ease;
  }
  .deco.gone {
    opacity: 0;
    animation-play-state: paused;
  }
  /* Parallaxe: hinten wenig und langsam, vorn mehr Weg */
  .far {
    --amp: 0.35rem;
    opacity: 0.8;
  }
  .mid {
    --amp: 0.7rem;
  }
  .near {
    --amp: 1.3rem;
  }
  @keyframes drift {
    0%,
    100% {
      transform: translateY(0) rotate(var(--tilt, 0deg));
    }
    50% {
      transform: translateY(calc(var(--amp) * -1)) rotate(calc(var(--tilt, 0deg) + 2.5deg));
    }
  }
</style>
