// Baut Figuren-Animationen aus kurzen Videos (art/video/<name>.mp4, einfarbig hellgrauer Hintergrund):
// 16 Einzelbilder ziehen, freistellen, auf denselben Ausschnitt bringen und als 4×4-Bildraster
// (WebP mit Transparenz) nach src/web/public/art schreiben. Im Browser spielt ein CSS-Keyframe
// mit Sprüngen das Raster ab – nur transform, kein Video-Decoder, kein Filter.
//
//   node scripts/build-anim.mjs --analyze bear-wave [ab]   Schleifen-Kandidaten suchen (Start/Ende in Sekunden,
//                                                          optional erst ab Sekunde „ab“)
//   node scripts/build-anim.mjs [name …]              bauen laut art/video/anims.json
//
// anims.json:  { "bear-wave": { "from": 0.5, "to": 2.5, "alternate": false } }
//   from/to    Ausschnitt in Sekunden. Für eine nahtlose Schleife sollte das Bild bei „to“ dem bei „from“ gleichen.
//   alternate  true = vor und zurück abspielen (wenn es keine saubere Schleifenstelle gibt)
//   islands    true = eingeschlossene Hintergrundflächen entfernen (z. B. Pokalhenkel)
import sharp from 'sharp';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { bounds, cutout } from './lib/cutout.mjs';

const VIDEO = 'art/video';
const OUT = 'src/web/public/art';
const MANIFEST = 'src/web/lib/anims.json';
const TMP = 'art/debug/anim';
const GRID = 4;
const FRAMES = GRID * GRID;
// Ein Einzelbild im Host-Raster passt in dieses Feld; das Handy bekommt die halbe Kantenlänge.
// Größer wird keine Figur auf dem Host gezeigt (höchstens rund 17 rem breit bei 32 px je rem).
const FRAME_W = 480;
const FRAME_H = 560;

const ffmpeg = (args) =>
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 512 * 1024 * 1024 });
const fps = (file) => {
  const out = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=r_frame_rate,nb_frames', '-of', 'csv=p=0', file]).toString().trim();
  const [rate, count] = out.split(',');
  const [a, b] = rate.split('/').map(Number);
  return { rate: a / (b || 1), count: Number(count) };
};

// ------------------------------------------------------------------ Schleifenstelle suchen
async function analyze(name, minStart = 0) {
  const file = join(VIDEO, `${name}.mp4`);
  const { rate, count } = fps(file);
  const probe = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file]).toString().trim().split(',').map(Number);
  const [w, h] = probe[0] > probe[1] ? [160, 90] : [90, 160];
  const raw = ffmpeg(['-i', file, '-vf', `scale=${w}:${h},format=gray`, '-f', 'rawvideo', '-']);
  const size = w * h;
  const n = Math.floor(raw.length / size);
  const diff = (i, j) => {
    let sum = 0;
    for (let k = 0; k < size; k++) sum += Math.abs(raw[i * size + k] - raw[j * size + k]);
    return sum / size;
  };
  const found = [];
  for (let i = Math.round(minStart * rate); i < Math.min(n, Math.round((minStart + 1.5) * rate)); i++) {
    for (let len = Math.round(rate * 1.2); i + len + 1 < n; len++) {
      // Bild UND Bewegungsrichtung sollen an der Nahtstelle zusammenpassen
      found.push({ from: i / rate, to: (i + len) / rate, score: diff(i, i + len) + 0.5 * diff(i + 1, i + len + 1) });
    }
  }
  found.sort((a, b) => a.score - b.score);
  let motion = 0;
  for (let i = 1; i < n; i++) motion += diff(i - 1, i);
  console.log(`${name}: ${count} Bilder, ${rate} fps. Mittlere Änderung von Bild zu Bild: ${(motion / (n - 1)).toFixed(2)}`);
  console.log('Beste Schleifen (kleiner Wert = unauffälligere Naht; unter etwa 1.5 sieht man nichts):');
  const shown = [];
  for (const c of found) {
    if (shown.some((s) => Math.abs(s.from - c.from) < 0.2 && Math.abs(s.to - c.to) < 0.2)) continue;
    shown.push(c);
    console.log(`  from ${c.from.toFixed(2)}  to ${c.to.toFixed(2)}  Länge ${(c.to - c.from).toFixed(2)} s  Naht ${c.score.toFixed(2)}`);
    if (shown.length === 6) break;
  }
}

// ------------------------------------------------------------------ Raster bauen
async function build(name, cfg) {
  const file = join(VIDEO, `${name}.mp4`);
  const { rate } = fps(file);
  const dir = join(TMP, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  ffmpeg(['-ss', String(cfg.from), '-to', String(cfg.to + 1 / rate), '-i', file, join(dir, 'f%03d.png')]);
  const all = readdirSync(dir).filter((f) => /^f\d+\.png$/.test(f)).sort();
  // Schleife: 16 Bilder gleichmäßig über [from, to) – das Bild bei „to“ ist wieder das erste.
  // Vor-und-zurück: beide Enden gehören dazu.
  const span = cfg.alternate ? all.length - 1 : all.length - 1;
  const picks = Array.from({ length: FRAMES }, (_, i) => all[Math.min(all.length - 1, Math.round((i * span) / (cfg.alternate ? FRAMES - 1 : FRAMES)))]);

  const cuts = [];
  const box = { x0: Infinity, y0: Infinity, x1: -1, y1: -1 };
  for (const f of picks) {
    const cut = await cutout(join(dir, f), !!cfg.islands);
    const b = bounds(cut);
    box.x0 = Math.min(box.x0, b.x0);
    box.y0 = Math.min(box.y0, b.y0);
    box.x1 = Math.max(box.x1, b.x1);
    box.y1 = Math.max(box.y1, b.y1);
    cuts.push(cut);
  }
  // gemeinsamer Ausschnitt für alle Bilder, sonst würde die Figur springen
  const pad = 4;
  const left = Math.max(0, box.x0 - pad), top = Math.max(0, box.y0 - pad);
  const width = Math.min(cuts[0].w, box.x1 + pad + 1) - left;
  const height = Math.min(cuts[0].h, box.y1 + pad + 1) - top;

  const info = {};
  const fit = Math.min(FRAME_W / width, FRAME_H / height);
  for (const [suffix, factor, quality] of [['', 1, 80], ['-s', 0.5, 72]]) {
    const fw = Math.round(width * fit * factor);
    const fh = Math.round(height * fit * factor);
    const tiles = [];
    for (let i = 0; i < FRAMES; i++) {
      const c = cuts[i];
      const tile = await sharp(Buffer.from(c.px), { raw: { width: c.w, height: c.h, channels: 4 } })
        .extract({ left, top, width, height })
        .resize(fw, fh)
        .png()
        .toBuffer();
      tiles.push({ input: tile, left: (i % GRID) * fw, top: Math.floor(i / GRID) * fh });
    }
    const sheet = await sharp({ create: { width: fw * GRID, height: fh * GRID, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite(tiles)
      .webp({ quality, alphaQuality: 88, effort: 6 })
      .toBuffer();
    writeFileSync(join(OUT, `anim-${name}${suffix}.webp`), sheet);
    info[suffix || 'host'] = `${fw * GRID}x${fh * GRID}, ${(sheet.length / 1024).toFixed(0)} kB`;
    if (!suffix) {
      // Kontrollblatt auf Magenta: zeigt Säume, Löcher und Sprünge zwischen den Bildern
      await sharp(sheet).flatten({ background: '#ff00ff' }).png().toFile(join(TMP, `_${name}.png`));
    }
  }
  console.log(`anim-${name}: ${picks.length} Bilder aus ${all.length}, Ausschnitt ${width}x${height}, Host ${info.host}, Handy ${info['-s']}`);
  return { aspect: Number((width / height).toFixed(4)), dur: Number((cfg.to - cfg.from).toFixed(3)), alternate: !!cfg.alternate };
}

// ------------------------------------------------------------------ Aufruf
const args = process.argv.slice(2);
if (args[0] === '--analyze') {
  await analyze(args[1], Number(args[2] ?? 0));
} else {
  const config = JSON.parse(readFileSync(join(VIDEO, 'anims.json'), 'utf8'));
  const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {};
  for (const name of args.length ? args : Object.keys(config)) {
    if (!config[name]) throw new Error(`${name} fehlt in ${VIDEO}/anims.json`);
    manifest[name] = await build(name, config[name]);
  }
  for (const name of Object.keys(manifest)) if (!config[name]) delete manifest[name];
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
}
