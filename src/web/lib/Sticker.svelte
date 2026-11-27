<script lang="ts" module>
  // Figuren als WebP. `small` lädt die Handy-Variante (halbe Kantenlänge).
  import type { Art } from './art';
  export type { Art };

  // Diese Klassen bewegen nur die Figur selbst – ihr Bodenschatten bleibt liegen
  const MOTION = new Set(['bob', 'wiggle']);
  // Einblend-Animationen laufen auf einer inneren Hülle, damit Position und Neigung außen bleiben
  const ENTER = new Set(['pop-in', 'rise-in', 'drop-in']);
</script>

<script lang="ts">
  let {
    name,
    small = false,
    alt = '',
    class: cls = '',
    ground = name !== 'bear-head' && name !== 'herry-swim',
  }: {
    name: Art;
    small?: boolean;
    alt?: string;
    /** Position, Größe und --tilt gelten für die ganze Figur; bob/wiggle nur für das Bild. Verzögerung über --delay. */
    class?: string;
    /** Weicher Bodenschatten unter der Figur. */
    ground?: boolean;
  } = $props();

  const tokens = $derived(cls.split(/\s+/).filter(Boolean));
  const outer = $derived(tokens.filter((t) => !MOTION.has(t) && !ENTER.has(t)).join(' '));
  const enter = $derived(tokens.filter((t) => ENTER.has(t)).join(' '));
  const motion = $derived(tokens.filter((t) => MOTION.has(t)).join(' '));
</script>

<span class="sticker {outer}">
  <span class="pose {enter}">
    {#if ground}<span class="ground" class:breathe={motion.includes('bob')}></span>{/if}
    <img class={motion} src="/art/{name}{small ? '-s' : ''}.webp" {alt} decoding="async" draggable="false" />
  </span>
</span>

<style>
  .sticker {
    display: block;
    position: relative;
    pointer-events: none;
    rotate: var(--tilt, 0deg);
  }
  .pose {
    display: block;
    position: relative;
    /* die Neigung trägt schon die Hülle */
    --tilt: 0deg;
    animation-delay: var(--delay, 0s);
  }
  img {
    display: block;
    position: relative;
    width: 100%;
    height: auto;
  }
  /* Bodenschatten als weicher Verlauf – kein Filter, kein Blur zur Laufzeit */
  .ground {
    position: absolute;
    left: 6%;
    right: 6%;
    bottom: -4.5%;
    height: 13%;
    background: radial-gradient(ellipse closest-side, rgba(46, 26, 11, 0.42) 0%, rgba(46, 26, 11, 0.22) 55%, rgba(46, 26, 11, 0) 100%);
  }
  /* Schwebt die Figur nach oben, wird ihr Schatten kleiner und blasser */
  .breathe {
    animation: breathe 3.6s ease-in-out infinite;
  }
  @keyframes breathe {
    0%,
    100% {
      transform: scaleX(1);
      opacity: 1;
    }
    50% {
      transform: scaleX(0.86);
      opacity: 0.7;
    }
  }
</style>
