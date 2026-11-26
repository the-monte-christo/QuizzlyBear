<script lang="ts">
  // QR-Code als ein einziger SVG-Pfad (scharf in jeder Auflösung, kein Bild-Request).
  import qrcode from 'qrcode-generator';

  let { text }: { text: string } = $props();

  const qr = $derived.by(() => {
    const code = qrcode(0, 'M');
    code.addData(text);
    code.make();
    const n = code.getModuleCount();
    let d = '';
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (!code.isDark(y, x)) continue;
        // zusammenhängende dunkle Module einer Zeile zu einem Rechteck verbinden
        let run = 1;
        while (x + run < n && code.isDark(y, x + run)) run++;
        d += `M${x} ${y}h${run}v1h-${run}z`;
        x += run - 1;
      }
    }
    return { n, d };
  });
</script>

<svg class="qr" viewBox="-2 -2 {qr.n + 4} {qr.n + 4}" role="img" aria-label="QR-Code zum Mitspielen" shape-rendering="crispEdges">
  <rect x="-2" y="-2" width={qr.n + 4} height={qr.n + 4} fill="#fff" />
  <path d={qr.d} fill="#2e1a0b" />
</svg>

<style>
  .qr {
    display: block;
    width: 100%;
    height: auto;
    border-radius: 0.8rem;
  }
</style>
