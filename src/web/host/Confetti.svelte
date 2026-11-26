<script lang="ts">
  // Konfetti auf einem Canvas: ein paar hundert Rechtecke, nach wenigen Sekunden ist Schluss.
  import { onMount } from 'svelte';

  let { duration = 7000 }: { duration?: number } = $props();
  let canvas: HTMLCanvasElement;

  onMount(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = canvas.getContext('2d')!;
    // halbe Auflösung reicht für Konfetti und schont 4K-Bildschirme
    const scale = Math.min(1, 1920 / innerWidth);
    const w = (canvas.width = Math.round(innerWidth * scale));
    const h = (canvas.height = Math.round(innerHeight * scale));
    const colors = ['#0072b2', '#d55e00', '#008f68', '#a8468f', '#56b4e9', '#ffffff', '#2e1a0b'];
    const parts = Array.from({ length: 220 }, (_, i) => ({
      x: Math.random() * w,
      y: -Math.random() * h * 0.6 - 20,
      vx: (Math.random() - 0.5) * 3,
      vy: 2.5 + Math.random() * 4.5,
      size: 8 + Math.random() * 10,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      color: colors[i % colors.length],
      round: i % 4 === 0,
    }));
    const t0 = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      const age = now - t0;
      ctx.clearRect(0, 0, w, h);
      ctx.globalAlpha = Math.min(1, Math.max(0, (duration - age) / 1200));
      for (const p of parts) {
        p.x += p.vx + Math.sin((age + p.size * 90) / 380) * 1.2;
        p.y += p.vy;
        p.rot += p.vr;
        if (p.y > h + 20 && age < duration - 2500) p.y = -20;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.round) {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        }
        ctx.restore();
      }
      if (age < duration) raf = requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, w, h);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  });
</script>

<canvas bind:this={canvas} aria-hidden="true"></canvas>

<style>
  canvas {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100vh;
    pointer-events: none;
    z-index: 50;
  }
</style>
