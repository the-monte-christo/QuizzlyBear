// Baut die Grafik-Assets: stellt die generierten Sticker-Bilder (einfarbig hellgrauer
// Hintergrund, weißer Sticker-Rand) frei und schreibt sie als WebP nach src/web/public/art.
//
//   node scripts/build-assets.mjs            alle Quellen aus art/src
//   node scripts/build-assets.mjs --debug    zusätzlich PNG-Vorschau nach art/debug
//
// Quellen:  art/src/bear-<pose>.jpg   → bear-<pose>.webp (+ -s.webp fürs Handy)
//           art/src/sheet-<name>.jpg  → Einzelsticker <name>-<nr>.webp (per Zusammenhangsanalyse)
import sharp from 'sharp';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { join, basename, extname } from 'node:path';

const SRC = 'art/src';
const OUT = 'src/web/public/art';
const DEBUG = process.argv.includes('--debug');

// Nur bei diesen Motiven gibt es eingeschlossene Hintergrundflächen (Pokalhenkel).
// Überall sonst würde der Schritt helle Flächen wie Zähne oder Zifferblätter ausstanzen.
const ISLANDS = new Set(['bear-trophy']);

const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

/** Liefert RGBA-Rohdaten, in denen der Hintergrund transparent ist. */
async function cutout(file, islands = false) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const px = data;
  const n = w * h;

  // Hintergrundfarbe: Median der Randpixel
  const border = [];
  for (let x = 0; x < w; x += 3) border.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y += 3) border.push(y * w, y * w + w - 1);
  const med = (c) => {
    const v = border.map((i) => px[i * 4 + c]).sort((a, b) => a - b);
    return v[v.length >> 1];
  };
  const bg = [med(0), med(1), med(2)];
  const bgLum = lum(...bg);

  // „Sieht aus wie Hintergrund“: wenig Sättigung, heller als die Outlines, dunkler als der weiße Rand
  const whiteCut = Math.min(246, bgLum + (255 - bgLum) * 0.62);
  const bgLike = (i) => {
    const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const l = lum(r, g, b);
    return mx - mn < 30 && l < whiteCut && l > bgLum - 45;
  };

  // 1) Flutfüllung vom Bildrand
  const mask = new Uint8Array(n); // 1 = Hintergrund
  const stack = [];
  const push = (i) => {
    if (!mask[i] && bgLike(i)) {
      mask[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (stack.length) {
    const i = stack.pop();
    const x = i % w, y = (i / w) | 0;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (y > 0) push(i - w);
    if (y < h - 1) push(i + w);
  }

  // 2) Eingeschlossene Hintergrundinseln (z. B. im Henkel eines Pokals): nur sehr
  //    hintergrundnahe, flache Flächen entfernen.
  const strict = (i) => {
    const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2];
    return Math.abs(r - bg[0]) < 16 && Math.abs(g - bg[1]) < 16 && Math.abs(b - bg[2]) < 16;
  };
  const seen = new Uint8Array(n);
  for (let s = 0; islands && s < n; s++) {
    if (mask[s] || seen[s] || !strict(s)) continue;
    const region = [s];
    seen[s] = 1;
    for (let k = 0; k < region.length; k++) {
      const i = region[k];
      const x = i % w, y = (i / w) | 0;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
        if (j >= 0 && !mask[j] && !seen[j] && strict(j)) { seen[j] = 1; region.push(j); }
      }
    }
    if (region.length > n * 0.00012) for (const i of region) mask[i] = 1;
  }

  // 3) Alpha setzen; Kantenpixel weich auslaufen lassen
  for (let i = 0; i < n; i++) {
    if (mask[i]) { px[i * 4 + 3] = 0; continue; }
    const x = i % w, y = (i / w) | 0;
    const edge =
      (x > 0 && mask[i - 1]) || (x < w - 1 && mask[i + 1]) || (y > 0 && mask[i - w]) || (y < h - 1 && mask[i + w]);
    if (edge) {
      const l = lum(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]);
      const a = Math.max(0, Math.min(1, (l - bgLum) / (250 - bgLum)));
      px[i * 4 + 3] = Math.round(120 + 135 * a);
      // Rand in Richtung Weiß ziehen, damit kein grauer Saum bleibt
      px[i * 4] = px[i * 4 + 1] = px[i * 4 + 2] = 255;
    }
  }
  return { px, w, h, mask };
}

/** Zusammenhängende Motive finden (für Sticker-Bögen). */
function components({ w, h, mask }) {
  const n = w * h;
  const label = new Int32Array(n);
  const boxes = [];
  let cur = 0;
  for (let s = 0; s < n; s++) {
    if (mask[s] || label[s]) continue;
    cur++;
    const box = { id: cur, x0: w, y0: h, x1: 0, y1: 0, area: 0 };
    const q = [s];
    label[s] = cur;
    for (let k = 0; k < q.length; k++) {
      const i = q[k];
      const x = i % w, y = (i / w) | 0;
      box.area++;
      if (x < box.x0) box.x0 = x;
      if (x > box.x1) box.x1 = x;
      if (y < box.y0) box.y0 = y;
      if (y > box.y1) box.y1 = y;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
        if (j >= 0 && !mask[j] && !label[j]) { label[j] = cur; q.push(j); }
      }
    }
    if (box.area > n * 0.004) boxes.push(box);
  }
  // zeilenweise sortieren
  const rowH = h / 6;
  boxes.sort((a, b) => {
    const ra = Math.round((a.y0 + a.y1) / 2 / rowH), rb = Math.round((b.y0 + b.y1) / 2 / rowH);
    return Math.abs(ra - rb) > 1 ? ra - rb : a.x0 - b.x0;
  });
  return { label, boxes };
}

async function writeWebp(raw, w, h, name, size, quality = 86) {
  const img = sharp(raw, { raw: { width: w, height: h, channels: 4 } })
    .trim()
    .resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true })
    .webp({ quality, alphaQuality: 90, effort: 6 });
  const buf = await img.toBuffer();
  await writeFile(join(OUT, `${name}.webp`), buf);
  if (DEBUG) {
    await mkdir('art/debug', { recursive: true });
    // Auf Magenta legen: so sieht man Säume und Löcher sofort
    await sharp(buf).flatten({ background: '#ff00ff' }).png().toFile(join('art/debug', `${name}.png`));
  }
  return buf.length;
}

await mkdir(OUT, { recursive: true });
const files = (await readdir(SRC)).filter((f) => /\.(jpe?g|png)$/i.test(f)).sort();
for (const f of files) {
  const name = basename(f, extname(f));
  const cut = await cutout(join(SRC, f), ISLANDS.has(name));
  if (name.startsWith('sheet-')) {
    const prefix = name.slice(6);
    const { label, boxes } = components(cut);
    let nr = 0;
    for (const box of boxes) {
      nr++;
      const bw = box.x1 - box.x0 + 1, bh = box.y1 - box.y0 + 1;
      const raw = Buffer.alloc(bw * bh * 4);
      for (let y = 0; y < bh; y++) {
        for (let x = 0; x < bw; x++) {
          const i = (box.y0 + y) * cut.w + box.x0 + x;
          if (label[i] !== box.id) continue;
          cut.px.copy(raw, (y * bw + x) * 4, i * 4, i * 4 + 4);
        }
      }
      const bytes = await writeWebp(raw, bw, bh, `${prefix}-${String(nr).padStart(2, '0')}`, 320, 84);
      console.log(`${prefix}-${String(nr).padStart(2, '0')}.webp  ${bw}x${bh}  ${(bytes / 1024).toFixed(1)} kB`);
    }
  } else {
    const big = await writeWebp(Buffer.from(cut.px), cut.w, cut.h, name, 760);
    const small = await writeWebp(Buffer.from(cut.px), cut.w, cut.h, `${name}-s`, 380, 82);
    console.log(`${name}.webp ${(big / 1024).toFixed(1)} kB, ${name}-s.webp ${(small / 1024).toFixed(1)} kB`);
  }
}
