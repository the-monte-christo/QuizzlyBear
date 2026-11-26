<script lang="ts">
  // Honig-Hintergrund mit Wabenmuster und schwebenden Stickern.
  // Die Sticker liegen auf eigenen Compositing-Ebenen und bewegen sich nur per transform.
  import { DECO } from './deco';

  let { variant = 'host', deco = true }: { variant?: 'host' | 'phone'; deco?: boolean } = $props();
</script>

<div class="backdrop" aria-hidden="true">
  <div class="comb"></div>
  {#if deco}
    {#each DECO[variant] as d, i (d.img)}
      <img
        class="deco"
        src="/art/{d.img}.webp"
        alt=""
        decoding="async"
        style="left:{d.x}%;top:{d.y}%;width:{d.size}rem;--tilt:{d.tilt}deg;animation-duration:{d.dur}s;animation-delay:{-i *
          1.7}s"
      />
    {/each}
  {/if}
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: -1;
    overflow: hidden;
    background: radial-gradient(130% 100% at 50% -10%, #ffe488 0%, #ffc838 48%, #f6a21a 100%);
    contain: strict;
  }
  .comb {
    position: absolute;
    inset: 0;
    background-image: url('/art/honeycomb.svg');
    background-size: 5.2rem auto;
    opacity: 0.13;
  }
  .deco {
    position: absolute;
    height: auto;
    margin: 0;
    translate: -50% -50%;
    animation: bob ease-in-out infinite;
    will-change: transform;
    opacity: 0.96;
  }
</style>
