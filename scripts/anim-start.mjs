// Baut das Startbild für eine Figuren-Animation: die Pose aus art/src, mittig auf einer
// hellgrauen Fläche im Videoformat (9:16, bei liegenden Figuren 16:9), mit Platz für Bewegung.
// Das Videomodell beschneidet quadratische Bilder sonst auf sein Format.
//
//   node scripts/anim-start.mjs bear-wave      → art/video/start-bear-wave.jpg
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { bounds, cutout } from './lib/cutout.mjs';

const name = process.argv[2];
if (!name) {
  console.error('Aufruf: node scripts/anim-start.mjs <pose>');
  process.exit(1);
}
const src = `art/src/${name}.jpg`;
const cut = await cutout(src);
const b = bounds(cut);
const bw = b.x1 - b.x0 + 1, bh = b.y1 - b.y0 + 1;
const wide = bw / bh > 1.2;
const W = wide ? 1920 : 1080, H = wide ? 1080 : 1920;
// Die Figur füllt höchstens 68 % der Breite und 60 % der Höhe: Arme und Sprünge brauchen Luft
const scale = Math.min((W * 0.68) / bw, (H * 0.6) / bh);
const margin = 24;
const crop = {
  left: Math.max(0, b.x0 - margin),
  top: Math.max(0, b.y0 - margin),
  width: Math.min(cut.w, b.x1 + margin) - Math.max(0, b.x0 - margin),
  height: Math.min(cut.h, b.y1 + margin) - Math.max(0, b.y0 - margin),
};
const figure = await sharp(src)
  .extract(crop)
  .resize({ width: Math.round(crop.width * scale) })
  .toBuffer({ resolveWithObject: true });
const [r, g, bl] = cut.bg;
await mkdir('art/video', { recursive: true });
const out = `art/video/start-${name}.jpg`;
await sharp({ create: { width: W, height: H, channels: 3, background: { r, g, b: bl } } })
  .composite([{ input: figure.data, left: Math.round((W - figure.info.width) / 2), top: Math.round((H - figure.info.height) / 2) }])
  .jpeg({ quality: 94 })
  .toFile(out);
console.log(`${out}  ${W}x${H}, Figur ${figure.info.width}x${figure.info.height}, Hintergrund rgb(${r},${g},${bl})`);
