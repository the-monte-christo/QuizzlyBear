// Freistellen der generierten Sticker-Bilder: einfarbig hellgrauer Hintergrund, weißer Sticker-Rand.
// Flutfüllung vom Bildrand; der weiße Rand und die dunklen Konturen halten sie auf.
import sharp from 'sharp';

export const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

/**
 * Liefert RGBA-Rohdaten, in denen der Hintergrund transparent ist.
 * @param {string | Buffer} input Datei oder Bilddaten
 * @param {boolean} islands auch eingeschlossene Hintergrundflächen entfernen (z. B. Pokalhenkel)
 */
export async function cutout(input, islands = false) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
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

  // 2) Eingeschlossene Hintergrundinseln: nur sehr hintergrundnahe, flache Flächen entfernen.
  //    Überall sonst würde der Schritt helle Flächen wie Zähne oder Zifferblätter ausstanzen.
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
  return { px, w, h, mask, bg };
}

/** Umschließendes Rechteck aller nicht transparenten Pixel. */
export function bounds({ w, h, mask }) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (mask[y * w + x]) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return { x0, y0, x1, y1 };
}
