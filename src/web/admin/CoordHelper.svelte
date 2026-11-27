<script lang="ts">
  // Koordinaten-Helfer für pin und circle: Bild wählen, Ziel anklicken, fertiges JSON kopieren.
  // Das Bild bleibt im Browser – es wird nicht hochgeladen. Koordinaten sind normiert (0–1),
  // genau wie in der quiz.json.
  type Pt = [number, number];

  let src = $state('');
  let mode = $state<'point' | 'area'>('point');
  let point = $state<Pt | null>(null);
  let polygons = $state<Pt[][]>([[]]);
  let copied = $state(false);
  let pad = $state<HTMLDivElement>();

  const round = (v: number) => Math.round(v * 1000) / 1000;
  const done = $derived(polygons.filter((p) => p.length >= 3));
  const current = $derived(polygons[polygons.length - 1]);

  const json = $derived.by(() => {
    if (mode === 'point') return point ? `"answer": { "x": ${point[0]}, "y": ${point[1]} }` : '';
    if (done.length === 0) return '';
    const area = done.map((p) => `[${p.map(([x, y]) => `[${x}, ${y}]`).join(', ')}]`).join(',\n    ');
    return `"answer": {\n  "area": [\n    ${area}\n  ]\n}`;
  });

  function load(file: File | undefined) {
    if (!file) return;
    if (src) URL.revokeObjectURL(src);
    src = URL.createObjectURL(file);
    clear();
  }

  function click(e: MouseEvent) {
    if (!pad) return;
    const rect = pad.getBoundingClientRect();
    const p: Pt = [round(Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))), round(Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)))];
    copied = false;
    if (mode === 'point') point = p;
    else polygons = [...polygons.slice(0, -1), [...current, p]];
  }

  function undo() {
    copied = false;
    if (current.length > 0) polygons = [...polygons.slice(0, -1), current.slice(0, -1)];
    else if (polygons.length > 1) polygons = polygons.slice(0, -1);
  }

  function nextPolygon() {
    if (current.length >= 3) polygons = [...polygons, []];
  }

  function clear() {
    point = null;
    polygons = [[]];
    copied = false;
  }

  async function copy() {
    await navigator.clipboard.writeText(json);
    copied = true;
  }
</script>

<details class="card helper">
  <summary>Koordinaten-Helfer für „Punkt setzen“ und „Kreis ziehen“</summary>
  <div class="body">
    <p>
      Wähle das Bild der Frage und klicke das Ziel an. Unten entsteht das <code>answer</code>-Objekt zum Einfügen in die
      <code>quiz.json</code>. Das Bild bleibt auf deinem Rechner.
    </p>
    <div class="row">
      <input type="file" accept="image/*" onchange={(e) => load(e.currentTarget.files?.[0])} />
      <div class="modes" role="group" aria-label="Art des Ziels">
        <button class="btn small" class:plain={mode !== 'point'} onclick={() => (mode = 'point')}>Punkt</button>
        <button class="btn small" class:plain={mode !== 'area'} onclick={() => (mode = 'area')}>Fläche</button>
      </div>
    </div>

    {#if src}
      {#if mode === 'area'}
        <p class="hint">
          Klicke den Umriss der Reihe nach ab (mindestens drei Ecken). Für ein weiteres Stück, etwa eine Insel: „Weitere Fläche“.
        </p>
      {:else}
        <p class="hint">Ein Klick setzt den Zielpunkt. Für <code>circle</code> genügen ebenfalls <code>x</code> und <code>y</code>.</p>
      {/if}
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
      <div class="pad" bind:this={pad} onclick={click}>
        <img {src} alt="Bild der Frage" draggable="false" />
        <svg viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
          {#if mode === 'area'}
            {#each polygons as poly, i (i)}
              {#if poly.length >= 3}
                <polygon class="fill" points={poly.map((p) => p.join(',')).join(' ')} />
              {/if}
              {#if poly.length >= 2}
                <polyline class="outer" points={[...poly, ...(poly.length >= 3 ? [poly[0]] : [])].map((p) => p.join(',')).join(' ')} />
                <polyline class="inner" points={[...poly, ...(poly.length >= 3 ? [poly[0]] : [])].map((p) => p.join(',')).join(' ')} />
              {/if}
            {/each}
          {/if}
        </svg>
        {#if mode === 'area'}
          {#each polygons as poly, i (i)}
            {#each poly as p, k (k)}
              <i class="vertex" style="left:{p[0] * 100}%;top:{p[1] * 100}%"></i>
            {/each}
          {/each}
        {:else if point}
          <i class="vertex big" style="left:{point[0] * 100}%;top:{point[1] * 100}%"></i>
        {/if}
      </div>

      <div class="row">
        {#if mode === 'area'}
          <button class="btn small plain" onclick={undo}>Punkt zurück</button>
          <button class="btn small plain" disabled={current.length < 3} onclick={nextPolygon}>Weitere Fläche</button>
        {/if}
        <button class="btn small plain" onclick={clear}>Leeren</button>
        <button class="btn small ok" disabled={!json} onclick={copy}>{copied ? 'Kopiert ✓' : 'JSON kopieren'}</button>
      </div>
      {#if json}<pre>{json}</pre>{/if}
    {/if}
  </div>
</details>

<style>
  .helper {
    padding: 0.9rem 1.1rem;
  }
  summary {
    cursor: pointer;
    font-weight: 700;
    font-size: 1.1rem;
  }
  .body {
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
    margin-top: 0.8rem;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.6rem;
  }
  .modes {
    display: flex;
    gap: 0.4rem;
  }
  .hint {
    color: var(--ink-2);
    font-weight: 600;
  }
  .pad {
    position: relative;
    align-self: flex-start;
    max-width: 100%;
    border: var(--line) solid var(--ink);
    border-radius: var(--r-s);
    overflow: hidden;
    cursor: crosshair;
    line-height: 0;
  }
  .pad img {
    display: block;
    max-width: 100%;
    max-height: 70vh;
    height: auto;
  }
  svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
  svg * {
    fill: none;
    stroke-linejoin: round;
    vector-effect: non-scaling-stroke;
  }
  .fill {
    fill: rgba(0, 143, 104, 0.3);
  }
  .outer {
    stroke: #2e1a0b;
    stroke-width: 5px;
  }
  .inner {
    stroke: #fff;
    stroke-width: 2px;
  }
  .vertex {
    position: absolute;
    width: 0.8rem;
    height: 0.8rem;
    translate: -50% -50%;
    border: 0.14rem solid #fff;
    border-radius: 50%;
    background: var(--a1);
    box-shadow: 0 0 0 0.1rem var(--ink);
    pointer-events: none;
  }
  .vertex.big {
    width: 1.3rem;
    height: 1.3rem;
  }
  pre {
    margin: 0;
    padding: 0.7rem 0.9rem;
    border-radius: var(--r-s);
    background: rgba(46, 26, 11, 0.08);
    font-family: ui-monospace, Consolas, monospace;
    font-size: 0.9rem;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    user-select: all;
  }
  code {
    font-family: ui-monospace, Consolas, monospace;
    font-size: 0.9em;
    padding: 0.05rem 0.35rem;
    border-radius: 0.35rem;
    background: rgba(46, 26, 11, 0.1);
  }
</style>
