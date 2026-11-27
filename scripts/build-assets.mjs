// Baut die Grafik-Assets: stellt die generierten Sticker-Bilder (einfarbig hellgrauer
// Hintergrund, weißer Sticker-Rand) frei und schreibt sie als WebP nach src/web/public/art.
//
//   node scripts/build-assets.mjs            alle Quellen aus art/src
//   node scripts/build-assets.mjs --debug    zusätzlich PNG-Vorschau nach art/debug
//
// Quellen:  art/src/bear-<pose>.jpg   → bear-<pose>.webp (+ -s.webp fürs Handy)
//           art/src/sheet-<name>.jpg  → Einzelsticker <name>-<nr>.webp (per Zusammenhangsanalyse),
//                                       je Sticker drei Tiefenebenen: -far (klein, blass, unscharf),
//                                       ohne Zusatz (Mitte) und -near (groß, leicht unscharf).
//                                       Schlagschatten und Unschärfe sind eingerechnet – kein CSS-Filter nötig.
//           art/src/bg-<name>.jpg     → bg-host.webp (16:9) und bg-phone.webp (Hochformat-Ausschnitt)
import sharp from 'sharp';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { join, basename, extname } from 'node:path';
import { cutout } from './lib/cutout.mjs';

const SRC = 'art/src';
const OUT = 'src/web/public/art';
const DEBUG = process.argv.includes('--debug');

// Nur bei diesen Motiven gibt es eingeschlossene Hintergrundflächen (Pokalhenkel).
// Überall sonst würde der Schritt helle Flächen wie Zähne oder Zifferblätter ausstanzen.
const ISLANDS = new Set(['bear-trophy']);

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

const DEPTH = [
  { suffix: '-far', size: 150, blur: 1.5, saturation: 0.78, brightness: 1.1, quality: 78 },
  { suffix: '', size: 320, blur: 0, saturation: 1, brightness: 1, quality: 84 },
  { suffix: '-near', size: 620, blur: 4.2, saturation: 1, brightness: 1, quality: 76 },
];

/** Sticker mit weichem Schlagschatten; optional unscharf und blasser (für die Tiefenebenen). */
async function writeDeco(raw, w, h, name, { suffix, size, blur, saturation, brightness, quality }) {
  const top = await sharp(raw, { raw: { width: w, height: h, channels: 4 } })
    .trim()
    .resize({ width: size, height: size, fit: 'inside' })
    .png()
    .toBuffer({ resolveWithObject: true });
  const sw = top.info.width, sh = top.info.height;
  const pad = Math.round(Math.max(sw, sh) * 0.16);
  const off = Math.round(pad * 0.5); // Schatten fällt nach unten
  const W = sw + pad * 2, H = sh + pad * 2;
  // Schatten = Silhouette des Stickers, nach unten versetzt und weichgezeichnet
  const rgba = await sharp(top.data).ensureAlpha().raw().toBuffer();
  const mask = Buffer.alloc(W * H);
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) mask[(y + pad + off) * W + x + pad] = rgba[(y * sw + x) * 4 + 3];
  }
  const soft = await sharp(mask, { raw: { width: W, height: H, channels: 1 } })
    .blur(Math.max(sw, sh) * 0.04)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const step = soft.info.channels;
  const shadow = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    shadow[i * 4] = 0x2e;
    shadow[i * 4 + 1] = 0x1a;
    shadow[i * 4 + 2] = 0x0b;
    shadow[i * 4 + 3] = Math.round(soft.data[i * step] * 0.36);
  }
  const flat = await sharp(shadow, { raw: { width: W, height: H, channels: 4 } })
    .composite([{ input: top.data, left: pad, top: pad }])
    .png()
    .toBuffer();
  let img = sharp(flat);
  if (blur) img = img.blur(blur);
  if (saturation !== 1 || brightness !== 1) img = img.modulate({ saturation, brightness });
  const buf = await img.webp({ quality, alphaQuality: 85, effort: 6 }).toBuffer();
  await writeFile(join(OUT, `${name}${suffix}.webp`), buf);
  if (DEBUG) {
    await mkdir('art/debug', { recursive: true });
    await sharp(buf).flatten({ background: '#9ec77a' }).png().toFile(join('art/debug', `${name}${suffix}.png`));
  }
  return buf.length;
}

/** Hintergrundmotiv: volle Breite für den Host, Hochformat-Ausschnitt fürs Handy. */
async function writeBackground(file) {
  const meta = await sharp(file).metadata();
  const host = await sharp(file).resize({ width: 2560 }).webp({ quality: 74, effort: 6 }).toBuffer();
  await writeFile(join(OUT, 'bg-host.webp'), host);
  // Ausschnitt links der Mitte: unten Honigglas und Waben, oben Licht
  const cw = Math.round((meta.height * 9) / 16);
  const phone = await sharp(file)
    .extract({ left: Math.round(meta.width * 0.095), top: 0, width: cw, height: meta.height })
    .resize({ width: 720 })
    .webp({ quality: 72, effort: 6 })
    .toBuffer();
  await writeFile(join(OUT, 'bg-phone.webp'), phone);
  console.log(`bg-host.webp ${(host.length / 1024).toFixed(0)} kB, bg-phone.webp ${(phone.length / 1024).toFixed(0)} kB`);
}

await mkdir(OUT, { recursive: true });
const files = (await readdir(SRC)).filter((f) => /\.(jpe?g|png)$/i.test(f)).sort();
for (const f of files) {
  const name = basename(f, extname(f));
  if (name.startsWith('bg-')) {
    await writeBackground(join(SRC, f));
    continue;
  }
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
      const id = `${prefix}-${String(nr).padStart(2, '0')}`;
      const sizes = [];
      for (const depth of DEPTH) sizes.push(`${depth.suffix || 'mid'} ${((await writeDeco(raw, bw, bh, id, depth)) / 1024).toFixed(1)} kB`);
      console.log(`${id}: ${sizes.join(', ')}`);
    }
  } else {
    const big = await writeWebp(Buffer.from(cut.px), cut.w, cut.h, name, 760);
    const small = await writeWebp(Buffer.from(cut.px), cut.w, cut.h, `${name}-s`, 380, 82);
    console.log(`${name}.webp ${(big / 1024).toFixed(1)} kB, ${name}-s.webp ${(small / 1024).toFixed(1)} kB`);
  }
}
