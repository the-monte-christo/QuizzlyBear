<script lang="ts">
  // Bild-Eingabe fürs Handy. pin: tippen (und ziehen) setzt den Punkt. circle: tippen setzt den
  // Mittelpunkt, ziehen bestimmt den Radius. Alle Koordinaten sind normiert (0–1), der Radius
  // zählt in Bildbreiten – unabhängig davon, wie groß das Bild gerade angezeigt wird.
  import type { ImageRef } from '../../shared/quiz';

  interface Mark {
    x: number;
    y: number;
    r?: number;
  }

  let {
    image,
    mode,
    mark,
    locked,
    minRadius = 0.04,
    maxRadius = 0.4,
    onchange,
  }: {
    image: ImageRef;
    mode: 'pin' | 'circle';
    mark: Mark | null;
    locked: boolean;
    minRadius?: number;
    maxRadius?: number;
    onchange: (mark: Mark) => void;
  } = $props();

  let pad: HTMLDivElement;
  let drawing = $state(false);
  let center = { x: 0, y: 0 };

  const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

  function point(e: PointerEvent) {
    const rect = pad.getBoundingClientRect();
    return { x: clamp01((e.clientX - rect.left) / rect.width), y: clamp01((e.clientY - rect.top) / rect.height), rect };
  }

  function down(e: PointerEvent) {
    if (locked) return;
    const p = point(e);
    drawing = true;
    pad.setPointerCapture(e.pointerId);
    if (mode === 'pin') {
      onchange({ x: p.x, y: p.y });
    } else {
      center = { x: p.x, y: p.y };
      // Startgröße: der zuletzt gewählte Radius, sonst ein mittlerer
      onchange({ ...center, r: mark?.r ?? Math.min(maxRadius, minRadius * 3) });
    }
  }

  function move(e: PointerEvent) {
    if (!drawing) return;
    const p = point(e);
    if (mode === 'pin') return onchange({ x: p.x, y: p.y });
    // Abstand in Pixeln, umgerechnet in Bildbreiten
    const dx = (p.x - center.x) * p.rect.width;
    const dy = (p.y - center.y) * p.rect.height;
    const r = Math.hypot(dx, dy) / p.rect.width;
    if (r > minRadius * 0.6) onchange({ ...center, r: Math.min(maxRadius, Math.max(minRadius, r)) });
  }
</script>

<div class="frame">
  <div
    class="pad"
    class:locked
    bind:this={pad}
    style="--ratio:{image.w / image.h}"
    onpointerdown={down}
    onpointermove={move}
    onpointerup={() => (drawing = false)}
    onpointercancel={() => (drawing = false)}
    role="application"
    aria-label={mode === 'pin' ? 'Bild: tippen, um den Punkt zu setzen' : 'Bild: tippen und ziehen, um einen Kreis zu zeichnen'}
  >
    <img src={image.src} alt="" width={image.w} height={image.h} draggable="false" />
    {#if mark}
      {#if mode === 'circle' && mark.r}
        <div class="ring" style="left:{mark.x * 100}%;top:{mark.y * 100}%;width:{mark.r * 200}%"></div>
      {/if}
      <div class="dot" class:small={mode === 'circle'} style="left:{mark.x * 100}%;top:{mark.y * 100}%"></div>
    {/if}
  </div>
</div>

<style>
  /* Die Fläche nimmt den verfügbaren Platz; das Bild passt sich im Seitenverhältnis ein */
  .frame {
    flex: 1;
    min-height: 0;
    display: grid;
    place-items: center;
    container-type: size;
  }
  .pad {
    position: relative;
    width: min(100cqw, 100cqh * var(--ratio));
    aspect-ratio: var(--ratio);
    border: var(--line) solid var(--ink);
    border-radius: var(--r-s);
    box-shadow: var(--drop);
    overflow: hidden;
    touch-action: none;
    cursor: crosshair;
    background: #fff;
  }
  img {
    display: block;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
  /* Markierung: weißer Ring + dunkle Kontur + farbiger Kern – auf jedem Bild sichtbar */
  .dot {
    position: absolute;
    width: 1.7rem;
    height: 1.7rem;
    translate: -50% -50%;
    border: 0.26rem solid #fff;
    border-radius: 50%;
    background: var(--a1);
    box-shadow:
      0 0 0 0.14rem var(--ink),
      0 0.25rem 0.5rem rgba(0, 0, 0, 0.4);
    pointer-events: none;
  }
  .dot.small {
    width: 0.9rem;
    height: 0.9rem;
    border-width: 0.16rem;
  }
  .ring {
    position: absolute;
    aspect-ratio: 1;
    translate: -50% -50%;
    border: 0.22rem solid #fff;
    border-radius: 50%;
    background: rgba(213, 94, 0, 0.3);
    box-shadow:
      0 0 0 0.12rem var(--ink),
      inset 0 0 0 0.12rem var(--ink);
    pointer-events: none;
  }
  .locked {
    cursor: default;
  }
</style>
