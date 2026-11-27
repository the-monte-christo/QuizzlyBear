<script lang="ts" module>
  // Figuren als WebP. `small` lädt die Handy-Variante (halbe Kantenlänge).
  //
  // Für manche Posen gibt es eine Animation (lib/anims.json, erzeugt von scripts/build-anim.mjs):
  // ein 4×4-Raster aus 16 Einzelbildern, das per CSS-Keyframe mit Sprüngen abgespielt wird.
  // Bewegt wird nur transform – kein Video-Decoder, kein Filter, die Arbeit macht der Compositor.
  import type { Art } from './art';
  import manifest from './anims.json';
  export type { Art };

  interface Anim {
    /** Breite / Höhe eines Einzelbilds */
    aspect: number;
    /** Dauer eines Durchlaufs in Sekunden */
    dur: number;
    /** vor und zurück abspielen statt im Kreis */
    alternate: boolean;
  }
  const ANIMS: Record<string, Anim | undefined> = manifest;

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
    still = false,
  }: {
    name: Art;
    small?: boolean;
    alt?: string;
    /** Position, Größe und --tilt gelten für die ganze Figur; bob/wiggle nur für das Bild. Verzögerung über --delay. */
    class?: string;
    /** Weicher Bodenschatten unter der Figur. */
    ground?: boolean;
    /** Standbild erzwingen, auch wenn es zur Pose eine Animation gibt. */
    still?: boolean;
  } = $props();

  const tokens = $derived(cls.split(/\s+/).filter(Boolean));
  const outer = $derived(tokens.filter((t) => !MOTION.has(t) && !ENTER.has(t)).join(' '));
  const enter = $derived(tokens.filter((t) => ENTER.has(t)).join(' '));
  const motion = $derived(tokens.filter((t) => MOTION.has(t)).join(' '));
  const anim = $derived(still ? undefined : ANIMS[name]);
</script>

<span class="sticker {outer}">
  <span class="pose {enter}">
    {#if ground}<span class="ground" class:breathe={motion.includes('bob')}></span>{/if}
    {#if anim}
      <span class="sprite {motion}" style="aspect-ratio:{anim.aspect}">
        <img
          class="frames"
          class:alternate={anim.alternate}
          src="/art/anim-{name}{small ? '-s' : ''}.webp"
          style="animation-duration:{anim.dur}s"
          {alt}
          decoding="async"
          draggable="false"
        />
      </span>
    {:else}
      <img class={motion} src="/art/{name}{small ? '-s' : ''}.webp" {alt} decoding="async" draggable="false" />
    {/if}
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

  /* Animation: Fenster auf ein Einzelbild, dahinter springt das Raster weiter */
  .sprite {
    display: block;
    position: relative;
    width: 100%;
    overflow: hidden;
  }
  .frames {
    width: 400%;
    max-width: none;
    animation: sprite-16 linear infinite;
    will-change: transform;
  }
  .frames.alternate {
    animation-direction: alternate;
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
